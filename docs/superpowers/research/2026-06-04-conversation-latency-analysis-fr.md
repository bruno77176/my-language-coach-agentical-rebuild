# Latence de conversation — analyse complète et plan pour rendre la boucle vocale rapide

**Date :** 2026-06-04
**Auteur :** Claude (à la demande de Bruno)
**Pourquoi :** La conversation dans l'app est beaucoup trop lente — trop de latence entre les messages. C'est le cœur du produit (un coach vocal temps réel), donc il faut l'améliorer drastiquement. Ce document met **toutes les options sur la table**, puis recommande un plan séquencé : d'abord optimiser le pipeline actuel, ensuite le saut vers le temps réel.

> ⚠️ Les chiffres de latence sont des estimations issues d'une lecture complète du code + benchmarks fournisseurs 2026, pas des mesures de production. La toute première étape d'implémentation est d'**instrumenter les vrais temps** pour régler sur des données, pas au doigt mouillé.

---

## 1. Comment fonctionne la boucle vocale aujourd'hui

C'est une boucle **tour par tour / push-to-talk** :

1. L'utilisateur appuie sur le micro, parle, ré-appuie pour arrêter → l'app enregistre **un seul clip audio complet**.
2. Le clip est uploadé vers l'API (machine Fly unique, Stockholm).
3. **STT** (Deepgram nova-3) transcrit le clip entier.
4. **LLM** (OpenAI gpt-4o-mini) génère la réponse du coach en streaming, token par token.
5. **TTS** synthétise la réponse — déjà **pipeliné** : chaque phrase terminée part en TTS immédiatement pendant que le LLM continue d'écrire.
6. Chaque chunk audio est **uploadé sur Supabase Storage**, une URL signée est créée, et cette URL est envoyée au client.
7. Le client **télécharge** chaque chunk depuis son URL et les joue à la suite.

**Deux choses sont déjà bien faites :** le TTS est pipeliné avec le LLM (on n'attend pas toute la réponse pour parler), et le client joue le premier chunk dès son arrivée. Donc ce n'est **pas** une réécriture — il s'agit de supprimer les attentes en série.

---

## 2. Le diagnostic — où passent ~3 secondes

« Latence entre les messages » = **temps jusqu'au premier son (TTFA)** : du moment où tu arrêtes de parler jusqu'au moment où le coach se met à parler. Chemin critique, avec les vraies attentes en série trouvées dans le code :

| Étape                                                                                 | Coût        | Où                                   |
| ------------------------------------------------------------------------------------- | ----------- | ------------------------------------ |
| Client : arrêt de l'enregistrement + aller-retour POST                                | 50–200 ms   | `api-client.ts`                      |
| Serveur : **appel réseau auth** vers Supabase, à chaque tour                          | 50–200 ms   | `middleware/auth.ts:25`              |
| Serveur : **4 requêtes DB séquentielles** (conversation, quota, profil, mémoire)      | 40–120 ms   | `routes/voice.ts:157–247`            |
| Serveur : **STT en BATCH** (clip entier uploadé, puis transcrit)                      | 300–1500 ms | `providers/deepgram.ts:49`           |
| Serveur : sauvegarde message user + **chargement de TOUT l'historique** (sans limite) | 40–300 ms   | `voice.ts:293,300`                   |
| Serveur : LLM jusqu'à la 1ʳᵉ phrase (streamé)                                         | 200–800 ms  | `providers/openai.ts`                |
| Serveur : **TTS + upload Storage + signature URL** (2 appels réseau) par chunk        | 400–1500 ms | `voice.ts:361` → `lib/storage.ts:59` |
| Client : **re-téléchargement** du chunk depuis l'URL, décodage, lecture               | 50–300 ms   | `audio-controller.ts:75`             |

**Total ≈ 2–3,5 s avant le premier mot.**

### Les plus gros coûts supprimables

1. 🔴 **L'aller-retour Storage sur le chemin audio.** Chaque chunk est uploadé sur Supabase + signé (2 appels réseau), PUIS le client le re-télécharge. C'est un aller-retour réseau complet par chunk qui n'apporte **rien** à l'expérience. Le plus gros gaspillage.
2. 🔴 **Gemini comme voix TTS par défaut.** Gemini est un appel REST non-streaming — tu attends tout l'audio de la phrase avant qu'un son ne sorte. Excellente qualité, mauvais pour la latence.
3. 🟠 **Appel réseau auth à chaque tour** vers Supabase (c'est aussi la cause des erreurs « 401 / token invalide » sous charge).
4. 🟠 **STT en batch** — uploader tout le clip puis transcrire, au lieu de streamer pendant que l'utilisateur parle.
5. 🟡 **Historique sans limite** envoyé au LLM à chaque tour — grossit indéfiniment, ralentit le premier token et coûte plus cher.

---

## 3. Les options — deux horizons

### Horizon 1 — Optimiser le pipeline actuel (rapide, pas cher, faible risque)

**Cible : ~3 s → ~1,2 s.** Aucun nouveau fournisseur, surtout côté serveur.

| #   | Changement                                                                                                                                                        | Gain                                            | Effort        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------- |
| 1   | **Envoyer l'audio inline dans le flux** (base64 dans l'événement) ; faire l'upload Storage en arrière-plan, hors du chemin critique                               | ~400–900 ms **par chunk, y compris le premier** | Moyen         |
| 2   | **Passer la voix par défaut à un fournisseur streaming rapide** (ElevenLabs Flash ~75 ms, déjà intégré) et le streamer vraiment ; garder Gemini en option premium | 200–1500 ms sur le premier son                  | Moyen         |
| 3   | **Vérifier le token de connexion en local** au lieu d'appeler Supabase à chaque tour                                                                              | 50–200 ms/tour + corrige les 401                | Petit         |
| 4   | **Lancer les 4 requêtes DB de démarrage en parallèle**                                                                                                            | 60–90 ms                                        | Petit         |
| 5   | **Plafonner l'historique** envoyé au LLM (N derniers tours + résumé mémoire)                                                                                      | premier token plus rapide, coût réduit          | Petit         |
| 6   | **Passer les écritures DB de fin de tour en arrière-plan** (ne pas bloquer la fin du tour)                                                                        | fin de tour plus nerveuse                       | Petit         |
| 7   | **Machine plus grosse** (la machine 256 Mo s'étouffe sous faible charge, ajoutant de la latence partout) + multi-région ensuite                                   | cohérence mondiale                              | Petit (infra) |

### Horizon 2 — Capture en streaming + mode « Live » temps réel (le saut)

**Cible : sub-1 s, interruptible.** Planifié APRÈS l'Horizon 1.

- **2a. STT en streaming :** l'app streame l'audio micro **pendant** que tu parles (Deepgram streaming + détection d'activité vocale), pour que la transcription soit prête à l'instant où tu t'arrêtes — au lieu de « enregistrer tout le clip → uploader → transcrire ». Réduit le STT de 300–1500 ms à ~100–300 ms.
- **2b. Speech-to-speech temps réel :** une seule connexion WebSocket qui fait voix-entrée → voix-sortie en **moins de 500 ms**, avec la possibilité d'interrompre le coach (barge-in). Idéal en **mode « Live » réservé au tier Pro**, à côté de (pas à la place de) la boucle tour par tour.

---

## 4. Fournisseurs temps réel — comparatif mis à jour (vérifié le 2026-06-04)

Ta recherche précédente concluait que « seul Inworld expose le texte » (dont on a besoin pour les corrections, le feedback, la mémoire). **C'est désormais dépassé** — les options natives exposent aussi les transcriptions :

| Option                            | Latence                | Expose le texte ?                                | Coût        | Notes                                                                                                      |
| --------------------------------- | ---------------------- | ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Cascade optimisée (Horizon 1)** | ~1,0–1,4 s             | ✅ texte LLM faisant autorité                    | actuel      | Aucun nouveau fournisseur, risque minimal                                                                  |
| **Inworld Realtime**              | sub-500 ms voix-à-voix | ✅ oui (transcriptions propres)                  | ~0,01 $/min | Ta piste initiale ; fort sur le coût + clarté du texte ; concurrence typiquement ≥4× la limite de requêtes |
| **OpenAI Realtime**               | la plus basse          | ✅ streame désormais les deltas de transcription | plus cher   | Audio natif ; le texte est une transcription de l'audio (légèrement imprécis)                              |
| **Gemini Live**                   | la plus basse          | ✅ config transcription entrée + sortie          | moyen       | Audio natif ; même réserve sur le texte imprécis                                                           |

**À retenir :** les trois options temps réel sont maintenant viables pour un coach qui a besoin du texte. Inworld reste devant sur le coût + la propreté du texte. Mais **on n'a pas besoin de choisir maintenant** — l'Horizon 1 apporte l'essentiel de l'amélioration ressentie sans engager de nouveau fournisseur ni nouvelle infra.

---

## 5. Arbitrage des fournisseurs TTS (le cœur de la question « voix par défaut »)

| Fournisseur                     | Qualité        | **Latence (TTFA)**               | Coût           | Intégré ?                        |
| ------------------------------- | -------------- | -------------------------------- | -------------- | -------------------------------- |
| **Gemini Kore** (défaut actuel) | #1, excellente | ❌ lent (REST, pas de streaming) | 💚 bon marché  | ✅                               |
| **ElevenLabs Flash v2.5**       | très bonne     | ✅ ~75 ms, streaming             | 🟠 plus cher   | ✅ (mais bufferisé actuellement) |
| **Cartesia Sonic 4**            | bonne          | ✅✅ ~40 ms                      | 🟠 à confirmer | ❌                               |
| **OpenAI tts**                  | correcte       | ❌ lent                          | moyen          | ✅ (secours)                     |

**Recommandation :** pour l'objectif latence, faire du défaut un fournisseur **streaming à faible TTFA** — **ElevenLabs Flash v2.5** (déjà intégré, il suffit d'arrêter de le bufferiser) — et garder **Gemini comme voix « qualité premium » sélectionnable**. Évaluer **Cartesia** pour un plancher encore plus bas. ⚠️ ElevenLabs coûte plus cher que Gemini, donc à croiser avec l'économie free/pro (les gratuits coûtent déjà cher — voir le doc monétisation) ; issue probable : **un défaut rapide pour tous, Gemini premium en upgrade**.

---

## 6. Plan recommandé & résultat attendu

1. **Faire l'Horizon 1 d'abord** (le tableau du §3) — plus grosse amélioration ressentie pour le moins de risque. Ordre par impact : audio inline (1) → TTS rapide streamé (2) → vérif token local (3) → requêtes parallèles (4) → plafond historique (5) → écritures en arrière-plan (6) → machine plus grosse (7).
2. **Instrumenter les vrais temps** avant/après chaque changement (ne pas benchmarker sur la machine de prod — elle s'étouffe et fausse les mesures).
3. **Ensuite décider de l'Horizon 2** — le STT en streaming est la prochaine plus grosse coupe ; le mode « Live » temps réel est une feature Pro à choisir (Inworld vs natif) une fois les données de l'Horizon 1 en main.

**Attendu après l'Horizon 1 :** temps jusqu'au premier mot **~1,0–1,4 s** (depuis ~3 s), aucun nouveau fournisseur, faible risque.
**Attendu après l'Horizon 2 :** **sub-1 s, interruptible** — compétitif avec Speak / Babbel-Speak.

---

## 7. Questions ouvertes / risques

- Audio inline : confirmer que l'app joue un clip temporaire fraîchement écrit assez vite (coût d'écriture minime) vs l'ancien téléchargement — mesurer.
- Streaming ElevenLabs : garder l'ordre des chunks correct pour que les phrases ne se chevauchent pas.
- La vérification locale du token doit toujours bloquer les comptes à email non confirmé (un bug passé).
- Le plafond d'historique ne doit pas casser la continuité du coach — s'appuyer sur le résumé mémoire pour les tours plus anciens.
- Le changement de TTS par défaut chevauche le travail Voice Lab en cours et le correctif Gemini-GA TTS séparé — coordonner pour qu'ils n'entrent pas en collision.

---

_Complément de l'audit de scalabilité (`2026-06-03-scaling-and-bottlenecks-audit.md`), de l'investigation Inworld S2S (`2026-06-03-inworld-realtime-speech-to-speech-investigation.md`), et du doc monétisation. À mettre à jour une fois les vrais temps mesurés._
