# Audit de montée en charge — combien d'utilisateurs aujourd'hui, et quoi changer pour scaler

**Date :** 2026-06-03
**Question de Bruno :** « Combien d'utilisateurs mon système actuel peut-il tenir ? Quels sont tous les goulots d'étranglement ? Que dois-je changer pour quelque chose de solide et robuste à l'échelle mondiale (des milliers d'utilisateurs) ? »

> ⚠️ Les chiffres ci-dessous sont des **estimations** avec hypothèses explicites, pas des garanties. Une appli **voix temps réel** est un cas dur : chaque tour = STT + LLM + TTS, donc on est limité par le maillon le plus faible, fournisseurs IA compris.

---

## 1. Ton infra actuelle (faits relevés dans le code)

| Élément                      | Réalité                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Serveur API                  | **1 seule machine** Fly `shared-cpu-1x`, **256 Mo RAM**, région **unique** `arn` (Stockholm)         |
| Redondance                   | `min_machines_running = 1`, pas d'autoscaling configuré → **point de défaillance unique**            |
| Concurrence déclarée         | soft 200 / hard 250 requêtes — **irréaliste** sur 256 Mo                                             |
| Framework                    | Hono (Node)                                                                                          |
| Auth                         | Supabase JWT vérifié via **appel réseau `getUser()` à chaque requête**                               |
| Base de données              | Supabase Postgres (eu-north-1), pool **10 connexions/machine**, `prepare:false` (pooler transaction) |
| Stockage audio               | Supabase Storage (chunks coach + greetings), cache greeting existant                                 |
| Fournisseurs IA              | OpenAI (LLM + Whisper), Deepgram (STT), Gemini / ElevenLabs / Inworld / OpenAI (TTS)                 |
| Autres services              | RevenueCat (billing), Resend (email), Sentry, push notifications, pg_cron                            |
| Garde-fou coût               | ✅ Quotas voix par user déjà en place (`FREE_TIER_VOICE_SECONDS_PER_DAY/MONTH`, cap pro)             |
| Rate limiting / backpressure | ❌ **Aucun** au niveau applicatif                                                                    |

---

## 2. Combien d'utilisateurs aujourd'hui ?

Il faut distinguer deux métriques. Elles n'ont rien à voir.

### a) Utilisateurs inscrits (total)

Ce ne sont que des lignes en base. Postgres en tient **des millions** sans broncher.
→ **Aucune limite pratique** ici. Tu peux avoir 100 000 inscrits, ce n'est pas le sujet.

### b) Sessions voix **actives en même temps** (le vrai plafond)

C'est ça qui casse. Une session voix tient des buffers audio en mémoire et brûle du CPU.

Indices concrets observés :

- L'event-loop s'est **étouffé avec ~2 process Node** sur la machine (timers déclenchés à 15-19 s au lieu de 7 s).
- 256 Mo + 1 vCPU partagé, sans rate limiting, avec un appel réseau auth par requête.

**Estimation honnête : ~5 à 20 conversations voix simultanées** avant dégradation sérieuse (audio qui rate, 401, latence). Disons **~10 en zone sûre**.

### Traduction en utilisateurs actifs mensuels (MAU)

Avec une hypothèse de **1 à 3 % des MAU actifs en pic simultané** (typique d'une appli d'apprentissage) :

| Concurrence sûre | MAU approximatifs\*     | Verdict                            |
| ---------------- | ----------------------- | ---------------------------------- |
| ~10 simultanés   | **≈ 300 – 1 000 MAU**   | Confortable                        |
|                  | **≈ 1 000 – 2 000 MAU** | Sous tension, ça commence à casser |
|                  | **> quelques milliers** | Casse, surtout en mondial          |

\* Très approximatif, et **optimiste** car suppose des pics étalés sur les fuseaux horaires. En mondial depuis **une seule région EU**, les utilisateurs US/Asie ont une **mauvaise latence** en plus.

> **Verdict tête de gondole : ta config actuelle est un palier "beta / early access".** Solide pour quelques centaines de MAU, sous tension vers 1-2k, cassée bien avant « des milliers en simultané dans le monde ». Ce n'est pas un défaut — c'est exactement ce qu'il faut pour valider le produit à coût quasi nul. Mais ça ne scale pas tel quel.

---

## 3. Tous les goulots d'étranglement, par ordre de gravité

### 🔴 Bloquants (cassent en premier)

1. **La machine 256 Mo / 1 vCPU partagé.** Plafond physique. La voix mange RAM + CPU ; quelques tours simultanés suffisent à saturer (déjà constaté). La concurrence 200 est un mensonge.

2. **Région unique (Stockholm).** Utilisateurs US/Asie = latence élevée sur une appli où la latence se _ressent_ (l'utilisateur attend la voix). Mondial depuis 1 région EU = mauvaise UX.

3. **Auth = appel réseau Supabase à chaque requête.** Met une dépendance externe dans le chemin critique → latence + mode de panne (les 401 d'aujourd'hui). Une machine saturée n'arrive plus à vérifier les tokens → « token invalide ».

4. **Aucun rate limiting ni plafond de concurrence par user.** Un seul utilisateur (ou un abuseur) peut lancer des appels IA illimités. Risque **capacité** ET **coût**. C'est exactement le burst de chunks qui a cassé le TTS.

### 🟠 Importants (cassent au palier suivant)

5. **Quotas des fournisseurs IA — LE vrai plafond à l'échelle.** À des milliers d'utilisateurs, tu heurtes les limites RPM/TPM d'OpenAI / Gemini / Deepgram / ElevenLabs **avant** de saturer ton serveur. Le bug TTS actuel (modèle preview bridé) en est l'avant-goût.

6. **Connexions DB : 10/machine.** Si tu passes à N machines → N×10 connexions vers Supabase. Les tiers Supabase plafonnent les connexions. À surveiller via le pooler.

7. **Point de défaillance unique.** 1 machine = si elle crash, appli **down**. Déploiement = risque de coupure.

8. **Pas de CDN audio.** Audio servi depuis Supabase Storage (EU). Utilisateur en Asie = chaque clip traverse la planète.

### 🟡 À terme

9. **Travaux async dans le chemin requête.** Extraction mémoire, génération de feedback, résumés hebdo — s'ils tournent en synchrone, ils alourdissent la latence. À pousser en tâches de fond.

10. **Cron / push-runner sur la même machine** → compétition pour les 256 Mo.

11. **Coût unitaire.** STT+LLM+TTS par tour, c'est cher (surtout TTS). Tes quotas voix existants aident déjà. À surveiller vu le plafond ~1k MRR visé (side-hustle).

---

## 4. Feuille de route — du robuste, par paliers, sans sur-ingénierie

> Principe : la plupart des gains **précoces sont quasi gratuits** (quelques $/mois ou du code). Le coûteux (multi-région, tiers entreprise) **seulement quand le trafic le justifie**. On ne construit pas pour 100k users tant qu'on en a 500.

### Palier 1 — Robustesse immédiate (cheap, à faire bientôt) → vise ~2-5k MAU

- **Grossir la machine** : 512 Mo–1 Go + CPU dédié (`performance-1x`). Tue l'OOM et l'étouffement event-loop. **Coût : quelques $/mois.** Le meilleur rapport effort/gain.
- **Vérifier le JWT en local** (clé/secret Supabase) au lieu de `getUser()` réseau. Supprime latence + le mode de panne 401. **Gratuit, gros gain de fiabilité.**
- **Ajouter rate limiting + plafond de concurrence par user** (ex. N tours voix simultanés/user, N requêtes/min). Protège coût ET capacité. **Gratuit.**
- **Corriger le TTS** (modèle stable, cf. `TTS-FIX-HANDOFF.md`) + **backpressure** sur la synthèse de chunks (file d'attente, pas de burst). **Gratuit.**
- **Ne plus jamais tester/croner sur la machine de prod.**

### Palier 2 — Scale horizontal → vise ~10-30k MAU

- **Plusieurs machines Fly + autoscaling.** L'API est stateless → scale horizontalement. Pré-requis : zéro état local sur la machine (pas de fichier temp ; tout en streaming/Storage).
- **Multi-région Fly** (ajouter US + Asie) pour la latence. ⚠️ Supabase reste mono-région (eu-north-1) → les requêtes DB depuis régions lointaines prennent de la latence. Le JWT local (palier 1) enlève déjà le coût auth cross-région. Envisager des **read replicas** plus tard.
- **Surveiller les connexions DB** (N×10) → baisser `max` par machine, s'appuyer sur le pooler Supabase.

### Palier 3 — Scale des fournisseurs IA (le vrai plafond) → indispensable au-delà

- **Gestion des quotas fournisseurs** : tiers supérieurs/entreprise, **plusieurs clés API**, pools de concurrence par fournisseur, **file d'attente avec backpressure**.
- **Cache agressif** : greetings (déjà), phrases récurrentes, TTS de contenu répété. Prompt caching côté LLM pour les system prompts. (STT/LLM sur entrée unique = peu cachables.)
- **Routage par tier** : free → modèles cheap, pro → premium (tu traques déjà ça — cf. mémoire benchmarking).
- **Garde-fous coût** : quotas durs (déjà là), alertes de dépassement, plafond $/jour.

### Palier 4 — Données & médias

- **CDN devant l'audio** (Cloudflare / edge Fly) → l'utilisateur tire l'audio depuis un point proche.
- **Upgrade tier Supabase** (connexions, stockage, bande passante). À très haute échelle : Postgres dédié / read replicas.
- **Tout l'async hors chemin requête** : mémoire, feedback, résumés → workers/queue de fond.

### Palier 5 — Observabilité & résilience

- **Métriques + alertes** : latence, taux d'erreur, échecs fournisseurs, **coût par tour**. Tu as Sentry — ajoute le métier.
- **Autoscaling basé santé**, **rolling deploys** propres (plusieurs machines = plus de coupure).
- **Circuit breakers** sur les fournisseurs (si Gemini TTS rame, bascule ou file, pas de cascade).

---

## 5. Résumé en une page

- **Inscrits** : pas de limite réelle (lignes en base).
- **Sessions voix simultanées** : **~10 en sûr** aujourd'hui → grosso modo **quelques centaines à ~1-2k MAU** confortablement, ça casse au-delà, surtout en mondial.
- **Le plafond se déplace** au fil des paliers : d'abord ta **machine 256 Mo**, puis la **région unique**, puis les **quotas des fournisseurs IA** (le mur final pour une appli voix).
- **Quick wins quasi gratuits** qui changent tout dès maintenant : machine plus grosse, JWT local, rate limiting, fix TTS + backpressure.
- **Ne construis pas pour 100k tout de suite.** Fais le palier 1 (cheap, énorme gain de robustesse), valide la traction, puis monte palier par palier quand les chiffres le justifient — cohérent avec un side-hustle visant ~1k MRR.

---

_Audit généré à la demande de Bruno. À relire/mettre à jour quand l'archi évolue (notamment si l'API passe multi-machine ou si Supabase change de tier)._
