# Stratégie et paris produit — Round 2 (analyse approfondie)

_Bruno a demandé une réflexion plus lente et plus profonde que le brouillon du Round 1 (2026-05-29). La voici._

_Le document du Round 1 se trouve à `2026-05-29-strategy-and-product-bets.md` dans ce dossier — il reste comme brouillon antérieur. Ce document le remplace. La version anglaise est à `2026-05-30-strategy-round-2.md`._

---

## Contexte

Tu as livré les Plans 1 à 7 d'une reconstruction greenfield de My Language Coach (Expo SDK 54 + Hono + Supabase, build dev actif sur ton appareil Android, peaufinage de l'identité visuelle du Plan 7 terminé). Tu veux :

1. Évaluer honnêtement s'il existe un véritable potentiel commercial pour cette app sur le marché 2026 du coaching conversationnel par IA — pas « est-ce possible » mais « est-ce probable, et quelle est la forme réaliste du succès vs de l'échec ? »
2. Décider ce que les Plans 8 / 9 / 10 livrent réellement, dans quel ordre, avec quelle monétisation
3. Atteindre rapidement un lancement Play Store + App Store (la deadline Play du 2026-07-04 approche)
4. Éviter de brûler des semaines sur les mauvais paris

Le Round 1 de cette analyse a été « un peu rapide ». Il a affirmé des prix et des positions concurrentielles avec assurance, sans sources. Il a sous-estimé le travail technique du Plan 8. Il a sous-estimé les vents contraires concurrentiels (en particulier le lancement gratuit de Babbel Speak que j'avais manqué). Ce round comble ces lacunes en ancrant chaque affirmation dans deux enquêtes parallèles :

- Une **enquête de réalité technique** qui a lu les chemins de code, les schémas et les documents de Plan existants
- Une **enquête de veille marché** qui a rassemblé les données 2026 de prix, financement, adoption et conversion à partir de 40+ sources

Chaque affirmation majeure ci-dessous est sourcée ou étiquetée comme inférence.

---

## Comment ce round diffère du Round 1

| Le Round 1 disait                                                     | Le Round 2 corrige par                                                                                                                                                                              | Pourquoi c'est important                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speak est à ~14,99 $/mois                                             | **Speak est à 20 $/mois ou 99 $/an** (Série C 2024-12, valorisation 1 G$, 10M utilisateurs, 4,8★ iOS)                                                                                               | Le plafond de prix marché pour un « coach IA premium » est plus haut que je le pensais ; 9,99 $ est confortablement milieu de marché, pas un sous-positionnement                                                          |
| La concurrence est « Speak / Talkpal / Praktika / ELSA »              | **Ajouter Babbel Speak (gratuit, lancé sept. 2025) et l'expansion IA de Duolingo**                                                                                                                  | Deux acteurs bien dotés offrent maintenant la fonctionnalité conversation gratuitement ou presque dans le cadre de leurs abonnements existants. L'indé ne peut pas rivaliser sur « conversation IA » comme offre autonome |
| Duolingo Max est la référence IA-premium                              | **Duolingo Max n'a que 9 % d'adoption** après 2+ ans, et croît lentement                                                                                                                            | Signal fort que la « voix IA » seule ne vaut pas un prix premium pour les consommateurs. Reformule notre exigence de différenciation                                                                                      |
| Conversion free→paid 1–3 % indé / 5–8 % best-in-class                 | **Trial→paid 38–54 %, download→subscriber global 1,7 %** (données RevenueCat 2025 sur des milliers d'apps)                                                                                          | Les maths du funnel diffèrent de ce que j'ai cité — l'action se joue dans la conversion de l'essai, pas dans le saut large install→paid                                                                                   |
| Speak brûle ~300 $ de CAC                                             | **Plutôt 15–30 $ canal mixte ; 30–50 $ payant pur**                                                                                                                                                 | Le cadre « l'indé ne peut pas concurrencer » est en partie vrai mais exagéré. Les canaux payants restent chers mais pas catastrophiques à cinq chiffres                                                                   |
| Coût variable ~0,025 $/min                                            | **API seule 0,025 $/min, avec infra/stockage/marge 0,05–0,10 $/min côté utilisateur**                                                                                                               | Mes maths de marge étaient roses. À 10 $/mois avec un utilisateur intensif (60 min/mois), la marge brute est de ~30 %, pas les ~70 % que je citais                                                                        |
| « Mémoire du coach + feedback + jeu de rôle = différenciateur clair » | **Toujours vrai, mais le déploiement de la mémoire ChatGPT Voice est un point de veille** — actuellement aucune persistance vocale par langue, mais OpenAI déploie la mémoire largement             | La fenêtre de différenciation est réelle mais pas illimitée. Le temps est un facteur                                                                                                                                      |
| Plan 8 = ~3-4 semaines                                                | **Plan 8 = 4-5 semaines** sur la base de la réalité technique (pas d'abstraction de provider, pas de logique de feature-gating, pas de scaffolding mémoire/feedback/scénarios — tout en greenfield) | L'honnêteté temporelle compte pour gérer le burnout. Ne promets pas 3 semaines pour ensuite glisser                                                                                                                       |
| La suppression de compte est « une préoccupation parallèle »          | **La suppression de compte est un BLOCAGE DUR pour la soumission App Store** — actuellement en cours sur la branche `worktree-account-deletion`                                                     | La spec du Plan 8 peut être rédigée en parallèle mais l'implémentation du Plan 8 ne peut pas démarrer avant que la suppression de compte ne soit fusionnée                                                                |
| Le jeu de cartes vocab demande une conception de table complète       | **La table `vocab_items` existe déjà** avec `userId, language, term, translation, firstSeenMessageId, mastery` — le Plan 9 a une vraie avance                                                       | L'estimation du Plan 9 peut tomber de 4 semaines à 3                                                                                                                                                                      |
| Le gating des entitlements « a juste besoin de câblage »              | **`entitlements` a un champ `plan` mais ZÉRO logique de feature-gating câblée** — quota de secondes vocales uniquement. Construire le feature-gating est une vraie tâche du Plan 8                  | Ajoute 3 à 5 jours à l'estimation du Plan 8                                                                                                                                                                               |
| Le swap de provider TTS « facile »                                    | **Appels de fonction directs, pas de pattern stratégie** — swapper la TTS pour le tier Pro nécessite une tâche de refactor avant le Plan 10                                                         | Mettre ce refactor dans le Plan 8 comme Tâche 1, ou vivre avec OpenAI TTS jusqu'au Plan 9                                                                                                                                 |

---

## Constats — Réalité technique (ancrée dans le code)

Voici les constats sol-vérité dont j'avais besoin avant toute recommandation.

### La boucle vocale est prête pour la prod et prête à être étendue

- **Endpoint de fin de session :** `apps/api/src/routes/voice.ts:345-418` — `POST /sessions/:id/end` vérifie la propriété, calcule la durée wall-clock, fait l'upsert de la streak, retourne `{ seconds_spoken, goal_reached }`. Le bon point de greffe pour les appels d'extraction de mémoire et de génération de feedback.
- **Protocole SSE** dans `apps/api/src/routes/voice.ts:163-342` émet les événements `transcription` / `reply-chunk` / `done` / `error`. Le payload `done` est actuellement `{ messageId, userMessageId }` — trop léger pour porter le feedback. Décision : le feedback obtient son propre endpoint, sans être tassé dans le flux SSE. (`POST /sessions/:id/feedback` polled par le client mobile à l'ouverture de la sheet de fin de session, ou retourné dans la réponse du handler `/end`.)
- **Constructeur du system prompt du coach :** `packages/shared/src/prompts.ts:8-23` (`buildCoachSystemPrompt`) prend actuellement `{ targetLanguage, userDisplayName }`. L'étendre à `{ ..., memory?: CoachMemory }` et injecter conditionnellement un bloc `<context>...</context>` est le chemin le plus propre. **Aucun placeholder de mémoire n'existe encore** — tout est en greenfield.

### État du schéma de base de données

Schéma actuel (issu des migrations 0000–0009) :

| Table           | Rôle                                                                 | Usage Plan 8/9/10                                   |
| --------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| `profiles`      | userId, displayName, langs, dailyGoalMinutes, timezone               | L'éditeur de mémoire vit ici (Plan 8)               |
| `conversations` | id, userId, language, topicId, startedAt, endedAt, secondsSpoken     | Cible FK du feedback (Plan 8)                       |
| `messages`      | id, conversationId, role, text, translation, audioStoragePath        | Source d'extraction du vocab (Plan 9)               |
| `vocab_items`   | id, userId, language, term, translation, firstSeenMessageId, mastery | **Existe déjà — avance du Plan 9 !**                |
| `entitlements`  | userId, plan (free/pro), proUntil, monthlyVoiceSecondsUsed           | Besoin de feature flags + quota quotidien (Plan 8)  |
| `usage_events`  | userId, platform, provider, operation, units, costUsd, rateCardId    | Déjà câblé ; les nouveaux SKU s'insèrent proprement |
| `rate_cards`    | $/unité versionnés par opération de provider                         | Supporte déjà les SKU TTS du tier Pro               |

Manquant pour le Plan 8 :

- `coach_memory` (par utilisateur, par langue, profil structuré)
- `session_feedback` (par conversation, JSON 3-panneaux structuré)
- Une migration pour étendre `entitlements` avec des feature flags ou remplacer la vérif plan-only par un module de feature-gating

### Le pattern RLS est cohérent

Depuis `0001_rls_policies.sql:12-58` : pattern standard direct-owned (`USING (auth.uid() = user_id)`) plus pattern imbriqué (`USING (EXISTS (SELECT 1 FROM conversations ...))`) pour `messages`. **Rappel critique de ta mémoire :** les politiques UPDATE ont besoin à la fois des clauses `USING` ET `WITH CHECK` ou les updates affectent silencieusement 0 lignes. Appliquer cohéremment sur les nouvelles tables.

### Le module entitlements ne gère que le quota vocal

`apps/api/src/lib/quota.ts:13-29` vérifie `plan + proUntil` contre `monthlyVoiceSecondsUsed`. **Aucune logique de feature-gating n'existe encore.** Le Plan 8 doit construire :

1. Un module de feature-gating (`canUseFeature(userId, feature)`) qui enrobe le lookup d'entitlement
2. Des constantes de feature (`COACH_MEMORY`, `DEEP_FEEDBACK`, `ROLE_PLAY_PREMIUM`, etc.)
3. Un wrapper de quota quotidien pour le tier gratuit (10 min/jour de conversation, 3 jeux de rôle/jour, etc.)

C'est 3 à 5 jours de travail à lui seul.

### Architecture mobile pour les nouveaux écrans

- Routes : `(auth)/`, `(onboarding)/`, `(tabs)/` (home, practice, progress, profile). Pas de routes vocab, library, ou memory.
- Styling : **Confirmé — chaque écran utilise `StyleSheet.create({...})` en inline**, pas NativeWind. Ne combats pas ça — épouse le pattern.
- Design tokens à `packages/design-tokens/src/colors.ts:1-31` : palette Sunrise (peach/coral/mauve/accent/ink/cream/danger/glass/shadowTint) avec gradients sunrise/warmth/glow. **Pas de variante dark mode.**
- **Décision :** le jeu de cartes vocab obtient une palette dark isolée, contenue dans le composant du jeu. Ne pollue pas les tokens globaux tant qu'on ne sait pas si on veut un thème dark global.

### Pattern de structure des Plans (à imiter)

Les Plans existants (`auth-social-and-password-reset`, `cost-revenue-dashboard`, `universal-links-email-verification`, `account-deletion`) suivent tous cette forme :

1. Phrase d'objectif (1–2 lignes)
2. Paragraphe d'architecture
3. Section tech stack
4. Vue d'ensemble de la structure des fichiers (nouveaux / modifiés / out-of-band)
5. Découpage numéroté en tâches — tâches atomiques de 1–2h, chacune avec : commentaire de scope, fichiers, checklist `- [ ]`, snippets prêts pour le code, étape run/test/commit
6. Section de conventions propre au Plan

Les specs et plans 8/9/10 doivent matcher exactement. N'innove pas sur la structure du plan.

### L'abstraction des providers est directe, pas en pattern stratégie

`apps/api/src/providers/{openai,deepgram,elevenlabs}.ts` exportent un factory + des fonctions d'opération. Il n'y a pas de couche d'interface pour swapper la TTS selon l'entitlement. **Implication :** si le Plan 8 veut une TTS premium pour le tier Pro (Inworld 1.5 Max ou Gemini 3.1 Flash), la Tâche 1 du Plan 8 est un petit refactor de stratégie TTS. Alternative : différer et livrer le Plan 8 avec une seule TTS, refactor au Plan 10.

### La suppression de compte bloque le Plan 8

En cours sur `worktree-account-deletion`. Dernier commit sur main : `4ffa0e1 fix(mobile): delete-account sheet renders correctly on iPad` (29 mai). **La rédaction de la spec du Plan 8 peut se faire en parallèle ; l'implémentation du Plan 8 ne peut pas démarrer avant le merge.** Recommandation : brainstormer la spec du Plan 8 pendant qu'on finit le plan de suppression.

### Zéro scaffolding existant pour mémoire / feedback / jeu de rôle

Le grep confirme : aucun code `coach_memory`, aucun `session_feedback`, aucun `role_play` / `scenario`. Vocab est la seule avance. C'est une bonne nouvelle (pas de dette) mais ça veut dire que les estimations réalistes ne sont pas « étendre X » mais « construire de zéro ».

### L'intégration de l'enregistrement des coûts est propre

Pattern fire-and-forget via le callback `onUsage` (`apps/api/src/lib/usage-bridge.ts`). Ajouter de nouvelles opérations (extraction mémoire à gpt-4o-mini, feedback à gpt-4o, TTS premium) consiste à insérer un callback au site d'appel + mettre à jour `rate_cards`. Pas de refactor nécessaire.

---

## Constats — Réalité du marché (ancrés dans les données 2026)

### La catégorie pèse comme suit

- **Marché mondial de l'apprentissage des langues numérique :** 21,06 G$ en 2025 → projeté à 24,39 G$ en 2026 → 50,82 G$ d'ici 2031 (TCAC 15,83 %) — Mordor Intelligence, Business of Apps
- **Sous-ensemble du revenu app-based :** 1,54 G$ en 2025, +18,8 % YoY — Business of Apps
- **327M téléchargements en 2025** — LingoBright
- Les fonctionnalités IA sont passées de différenciateur à **incontournable** : 60 %+ des plateformes livrent une fonction conversation IA d'ici 2026

Le marché est réel. La catégorie est encore en expansion. **Mais :** Duolingo contrôle 67 % du revenu app et le reste est fragmenté entre des concurrents bien financés. La case « facile » de l'indé — la pure conversation IA — est fermée.

### Paysage concurrentiel (prix et traction 2026 vérifiés)

| Concurrent         | Mensuel                 | Annuel (équiv. $/mois)  | Financement / échelle                      | Fonctionnalité notable                              | Leçon pour l'indé                                                                |
| ------------------ | ----------------------- | ----------------------- | ------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Speak**          | 20 $                    | 99 $ (8,25 $/mois)      | 162M$ levés, val. 1G$, 10M users, 4,8★     | Intégration OpenAI Realtime API                     | Possède la « conversation IA premium » ; hors de portée                          |
| **Duolingo Max**   | 29,99 $                 | 168 $ (14 $/mois)       | 12,2M payants (Duolingo total), Max=9%     | Video Call + Roleplay                               | **Le tier IA premium échoue en adoption** — signal de tier                       |
| **Babbel Speak**   | Gratuit avec abo Babbel | Babbel ~7,45–15 $/mois  | Marque établie, ~383M$ revenu 2024         | **Conversation IA gratuite depuis sept. 2025**      | **Vent contraire direct — les incumbents bundlent maintenant l'IA gratuitement** |
| **Talkpal**        | 9,99 $                  | 59,88 $ (4,99 $/mois)   | 5M+ utilisateurs, financement non divulgué | Tier gratuit 10 min/jour                            | Comp directe la plus proche ; agressif sur le prix                               |
| **Praktika**       | 8 $                     | Pas de mensuel          | Non divulgué ; 4,7★ stores                 | Multimodal — upload photos/vidéos pour conversation | Angle fonctionnel intéressant à noter                                            |
| **ELSA Speak**     | 13,33 $                 | 159,99 $ (13,33 $/mois) | Série C ; **2,7★ Trustpilot** (médiocre)   | Prononciation niveau phonème                        | Le moat prononciation est réel mais la marque ELSA est abîmée                    |
| **Loora**          | 10 $                    | 119,99 $ (10 $/mois)    | Non divulgué                               | Orientation professionnel/corporate                 | Niche B2B ; pas un concurrent direct                                             |
| **Univerbal**      | 10–15 $                 | 90 $ (7,50 $/mois)      | Renommage de Quazel                        | Emphase sur la fluidité conversationnelle           | Vraie comp à notre bande de prix exacte                                          |
| **Talkio AI**      | 10 $                    | 9 $/mois annuel         | Non divulgué                               | **40+ langues, 134 dialectes, 400+ tuteurs**        | **Possède la « largeur » — cette voie est fermée**                               |
| **Lingoda Sprint** | 89–139 $                | n/a                     | Établi, instruction live                   | Cours live + structure cashback                     | Produit différent — tuteur humain premium                                        |
| **ChatGPT Voice**  | 20 $ (Plus)             | n/a                     | OpenAI                                     | Gratuit avec l'abo Plus                             | **Le vrai plancher — ton barre est « qu'est-ce que ChatGPT ne fait PAS ? »**     |

Sources : Beginners in AI, ICanLearn, Getlatka, Lucidity Insights, Talkpal Pricing, Trustpilot, DigitalAdGenius, Practice Me, blog Talkio.ai.

### Les deux signaux les plus importants

1. **Duolingo Max à 9 % d'adoption** après 2+ ans signifie que le marché consommateur a répondu à la question « paieriez-vous 30 $/mois de plus pour les fonctionnalités voix IA greffées sur Duolingo ? » et la réponse est massivement **non**. La conversation IA seule — même avec une marque leader de catégorie et 52,7M DAU en haut du funnel — n'est pas une fonctionnalité de tier premium. **Ça reformule ce qu'on doit vendre.** L'item « conversation IA » doit être emballé dans une histoire de valeur plus large (coaching, maîtrise du vocabulaire, progression en prononciation) que l'utilisateur comprend comme une amélioration continue, pas comme de l' « IA ».

2. **Babbel Speak est maintenant gratuit** dans le cadre de l'abonnement Babbel existant (lancé en septembre 2025). C'est le changement concurrentiel le plus sous-estimé de l'année. Babbel était l'ancre « cours structuré » — ils bundlent maintenant la conversation IA gratuitement. Leur incumbency + profondeur de contenu + marque + IA bundlée est un vrai vent contraire pour tout pitch autonome « conversation IA ». **Notre offre ne peut pas être « paie 10 $ pour la conversation IA » — ça se fait écraser.** Ça doit être « paie 10 $ pour un système de coaching complet qui utilise l'IA comme moteur ».

### Benchmarks de conversion / churn

- **Trial-to-paid (freemium avec essai) :** 38–54 % — Adapty
- **Download-to-subscriber global :** 1,7 % — données RevenueCat 2025
- **Conversion d'essai (download → start trial) :** 3,7–8,9 % — Adapty
- **Churn d'apps éducation :** >95 % au jour 30 (médiane) ; >50 % au jour 7
- **Cible de rétention saine :** 40 %+ à 90 jours, <5 % de churn mensuel — Business of Apps
- **Conversion iOS vs Android :** catégorie éducation environ Android 27 % / iOS 25 % page-to-install, iOS skewed plus haut en revenu/install dans les catégories d'abonnement

Ce que ça veut dire pour les maths de notre lancement :

- 1000 installs / mois × 7 % download→trial × 45 % trial→paid = ~32 abonnés payants/mois
- 5000 installs / mois × 7 % × 45 % = ~160 abonnés payants/mois — break-even et au-delà
- **Le goulot d'étranglement est le démarrage de l'essai, pas la conversion de l'essai.** Le produit doit donner envie aux gens de démarrer un essai en quelques minutes après l'ouverture.

### Réalité CAC

- Cible CAC organique industrie pour des apps de langue saines : 15 $. CAC canal payant : 30–50 $+. Certaines sources projettent 1500 $ de CAC cumulé à maturité pour les leaders de catégorie.
- Le CAC mixte de Speak (financement levé / utilisateurs totaux) se situe probablement à **15–30 $**, pas les 300 $ que je citais hier.
- Taux d'opt-in ATT : creux à 13,85 % (mi-2024) → ~35–50 % mondialement T2 2025. S'améliore mais reste hostile à l'attribution payante.
- **Réalité indé :** l'UA payant est réel mais financièrement fragile. Un CAC de 20 $ à 10 $ d'ARPU mensuel + 30 % de commission store = 7 $ de contribution × 5 mois = 35 $ de LTV. Payback CAC ~3 mois. Soutenable seulement si le churn est bas.
- **Organique piloté par le fondateur** (YouTube, TikTok, Reddit, X/Bluesky) est le chemin indé. Réel, mais lent. Compte ~6 mois de contenu cohérent avant traction significative.

### Répartition géographique

- LATAM/Brésil (69,7M$, TCAC 17 %) et Turquie (5,6M$, TCAC 16,2 %) sont les plus en croissance — Cognitive Market Research
- iOS skewed revenu UE/US ; Android skewed volume Inde/Brésil/SEA
- **Aucun concurrent majeur ne propose de prix géo-discountés**. Opportunité dans les marchés à faible PIB mais avec risque d'arbitrage transfrontalier. Probablement à zapper en v1.

### Probabilités d'outcome spécifiques à Bruno (18 mois, vu les données)

C'est le morceau qui compte le plus. Vu l'état actuel du produit, la bande passante de fondateur solo, l'absence de financement, et en supposant que le lancement soit fait avec **un positionnement de niche + contenu de fondateur + tarification freemium 7,99–9,99 $ :**

| Cible         | Probabilité | Ce qu'il faut                                                                          |
| ------------- | ----------- | -------------------------------------------------------------------------------------- |
| **1k $ MRR**  | **40–50 %** | Niche claire + 6 mois de contenu de fondateur cohérent + essai 7 jours + 1k abonnés    |
| **10k $ MRR** | **10–15 %** | Ce qui précède + efficacité UA payant OU moment viral OU audience préexistante de 30k+ |
| **50k $ MRR** | **<5 %**    | Nécessite probablement du capital ou un chemin d'acquisition                           |

Ces probabilités ne sont pas des prédictions, ce sont des priors basés sur l'indé SaaS au sens large (30 % des solo devs atteignent 1k $ MRR en 12 mois — benchmark Indie Hackers) ajustés pour la friction concurrentielle spécifique à la catégorie.

**La question que ça force pour Bruno :** est-ce que 1k–10k $ MRR est un outcome valable pour toi vu l'investissement de temps ? Si la réponse honnête est « non, j'ai besoin de 10k $+ pour que ça vaille le coup », alors le chemin nécessite soit une audience pré-construite, soit un pivot vers une niche où les indés ont un levier disproportionné. Si « oui, 1k–5k $ MRR + le métier + l'optionalité, c'est assez », alors procède avec le plan ci-dessous.

### Ce que ChatGPT Voice ne fait toujours pas (2026)

- Pas de mémoire persistante par session sur l'usage coach de langue
- Pas de curriculum structuré
- Pas de répétition espacée / suivi de vocab
- Pas de transcription de conversation avec corrections
- Pas de visualisation de progression
- Pas de drilling ciblé sur les zones faibles

**Ces points restent la surface du différenciateur.** Aucun n'est techniquement hors de portée pour OpenAI — mais ils ne sont pas livrés. La fenêtre est réelle mais ne durera pas éternellement ; le déploiement de la « mémoire » d'OpenAI est à surveiller mensuellement.

---

## Recommandations stratégiques

### 1. Repositionner : pas « app de conversation IA » — « système de coaching qui utilise l'IA »

Ne vends pas ce qui est commoditisé (la voix IA). Vends ce qui ne l'est pas (la boucle qui l'enrobe).

Le pitch devient : **« Ton coach se souvient de toi, te donne du feedback après chaque conversation, construit un deck de vocabulaire à partir de tes vraies conversations, et te montre tes progrès sur des semaines. ChatGPT Voice ne fait rien de tout ça. Babbel Speak non plus. »**

C'est le seul positionnement qui survit au tournant Babbel-Speak-gratuit. Si on vend « conversation IA », les clients Babbel ne switchent pas. Si on vend « la boucle de coaching », les clients Babbel sont intrigués par quelque chose que Babbel n'a pas.

### 2. Choisir un persona de niche pour l'histoire de lancement (tout le reste reste générique)

Le produit reste générique 12 langues. **L'histoire de lancement est étroite.** Sans ça, l'acquisition organique est morte — il n'y a aucune raison convaincante pour quiconque de partager, blogger, ou poster sur un générique « coach de langue IA ».

Trois positionnements candidats, évalués :

- **A. « Coach de conversation IA pour ingés / travailleurs remote apprenant l'italien/espagnol/français/allemand pour une relocation »** — ton propre profil, facile à écrire le copy, niche qui colle au chevauchement de ton audience avec dev Twitter / r/digitalnomad. **Ma recommandation.**
- **B. « Coach anglais IA pour ingés non-natifs préparant des entretiens »** — TAM plus gros, angle de contenu plus dur (spécifique anglais, moins fun à utiliser pour toi), concurrence ELSA/Loora plus directe
- **C. « Coach italien IA pour anglophones qui prévoient de déménager en Italie »** — le plus étroit, contenu le plus facile, TAM le plus petit mais fit message-marché le plus serré

Recommandation : **A**, avec B en fallback si A ne décolle pas. Différer **C** sauf si tu découvres une traction spécifique italienne.

### 3. Tarification : 7,99 $/mois, 49,99 $/an (4,16 $/mois équivalent), essai 7 jours

Calibration à la baisse depuis le 9,99 $ d'hier sur la base des données :

- 7,99 $/mois est **sous** le mensuel de Talkpal (9,99 $) mais au-dessus de Praktika (8 $) — ancre psychologique « sous 10 $ »
- 49,99 $/an (~4,16 $/mois) est une réduction agressive de 50 % sur l'annuel — signal fort trial-to-annual
- Essai gratuit 7 jours (opt-out — conversion automatique au payant sauf annulation) — conversion 2,5–3× plus haute que les essais opt-in selon Adapty
- Zapper le tier lifetime en v1 — verrouille un plancher de prix que tu pourrais regretter si tu montes en gamme
- **Réductions géographiques :** zapper en v1 ; réévaluer à 1k utilisateurs si Brésil/Inde/Turquie montrent du volume

Marge à 7,99 $/mois :

- Commission Apple/Google : 30 % an 1 → 5,59 $ net
- Coût variable utilisateur Pro typique (60 min/mois conversation) : 3,50–6 $ à 0,05–0,10 $/min côté utilisateur
- Marge de contribution : 0–2 $/utilisateur/mois pour les utilisateurs intensifs, 3–5 $ pour les utilisateurs légers
- **Plus serré que ce que l'analyse d'hier suggérait.** Implication : un plafond quotidien soft sur Pro (60 min/jour) n'est pas optionnel — c'est une protection de marge requise.

C'est une vraie révision à la baisse à flagger. Le 9,99 $ était basé sur des hypothèses de coût obsolètes. 7,99 $ est mieux positionné concurrentiellement ET plus proche de la réalité des coûts.

### 4. Tier gratuit : délibérément limité mais utile

- **Voix :** 10 min/jour (matche exactement Talkpal, pas besoin d'innover ici)
- **Sessions dans l'historique :** les 3 dernières seulement (pousse à l'upgrade pour les utilisateurs qui veulent suivre les progrès)
- **Jeu de rôle :** 3 scénarios gratuits du catalogue de 10 (café/directions/small-talk — les points d'entrée les plus faciles)
- **Mémoire :** **La mémoire basique EST gratuite** (nom, sujets récents, niveau). Critique — sans ça, l'expérience gratuite est froide et ne convertit pas. Verrouiller la mémoire entièrement derrière Pro tue le funnel.
- **Feedback :** Le feedback de fin de session est **gratuit** pour la session courante. L'historique (>3 sessions en arrière) est Pro. Comme ça chaque utilisateur gratuit voit le payoff de coaching une fois.
- **Jeu de cartes vocab (Plan 9) :** 10 cartes/jour, un seul mode (voice translate seulement — le plus viscéralement satisfaisant)
- **Score de prononciation (Plan 10) :** Pro seulement — signal d'upgrade à 100 %

### 5. Canal de distribution : choisir UN — recommandation YouTube

Le Round 1 disait « TikTok / Reddit / Twitter / YouTube — choisis-en un ». Les données marché renforcent que c'est la décision la plus importante. Nouvelle analyse :

| Canal              | Fit pour Bruno                                                                                                                         | Outcome réaliste à 6 mois                                      | Effort/semaine |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------- |
| **YouTube**        | Haut — le long-form colle à la niche ingé/coach, trafic evergreen pilote par la recherche, l'angle build-in-public du fondateur marche | 500–2000 abonnés, 50–200 installs organiques/semaine au mois 6 | 8–12h/semaine  |
| **TikTok / Reels** | Moyen — audience plus jeune, plus dur à monétiser au TAM, variance haute                                                               | 0–5000 abonnés, upside viral si tu touches                     | 6–10h/semaine  |
| **Reddit**         | Haut — r/languagelearning (2,7M) + subs de niche, très haute confiance                                                                 | 50–300 installs organiques sur 6 mois depuis les posts         | 3–5h/semaine   |
| **X / Bluesky**    | Moyen — chevauchement dev Twitter, build-in-public marche                                                                              | 200–1000 abonnés, installs indirects via réseaux dev           | 3–5h/semaine   |

**Recommandation : YouTube en primaire + Reddit en adjacent.** Le contenu YouTube (vidéos de 5-10 min : « J'ai construit un coach italien IA, voici la semaine 4 » / « Pourquoi j'ai switché de Babbel à mon app » / « Construire une app de langue avec Supabase + Expo SDK 54 ») est evergreen, découvrable par la recherche, et matche l'énergie build-in-public de ton instinct devblog existant. Reddit est adjacent à faible coût — partage la vidéo, réponds aux questions techniques, ne spam jamais.

**Engagement :** une vidéo YouTube par semaine pendant 26 semaines (une toutes les deux semaines si 26 c'est trop). La sortie de contenu est la moitié de la stratégie de lancement.

### 6. Mener avec la rétention, pas l'acquisition

Les apps éducation churnent 95 %+ au jour 30 (Business of Apps). L'acquisition sans rétention est un trou. Priorités v1 :

- **Expérience de première session :** l'utilisateur doit sentir qu'il a obtenu quelque chose de précieux en 90 secondes. La phrase d'ouverture que le coach prononce compte plus que n'importe quelle autre ligne de code.
- **Push jour 1 :** « Ton premier rapport de feedback est prêt. » Concret, précieux, ouvre l'écran de feedback.
- **Push jour 2 :** « Prêt pour un warmup de 5 minutes avec ton coach ? » Indice d'habitude.
- **Push jour 7 :** « Voici ton premier résumé hebdo » — progrès concret, vrais chiffres, upsell Pro doux.
- **Sauvetage de churn jour 14 :** « Veux-tu que je te rappelle ce que tu as appris la dernière fois ? » — exploite la mémoire.
- **Assurance streak :** 1 freeze par semaine gratuit, illimité Pro.

Les fonctionnalités de rétention ont un levier plus haut par heure que les ajouts de fonctionnalités. Priorise en conséquence.

### 7. Séquencement : spécifier le Plan 8 maintenant, livrer les Plans 8/9/10 en 4-4-3 semaines

- **Maintenant → ~2 semaines :** suppression de compte livrée. Rédaction de la spec du Plan 8 en parallèle.
- **Semaines 2–7 :** implémentation du Plan 8 (« La boucle de coaching »). Estimation honnête 4–5 semaines. Fin : lancement payant.
- **Semaines 7–11 :** Plan 9 (« La boucle de vocab »). 4 semaines. Fin : jeu de cartes livré, boucle de rétention mesurable.
- **Semaines 11–14 :** Plan 10 (« La boucle de prononciation »). 3 semaines (moins de nouvelle infra). Fin : fonctionnalité signature du tier Pro.
- **Tout le long :** vidéo YouTube hebdo, présence Reddit + Twitter hebdo.

---

## Plan 8 — « La boucle de coaching » (4–5 semaines)

**Objectif :** livrer une app qui autorise le paiement avec les trois fonctionnalités qui nous rendent pas-Babbel et pas-ChatGPT-Voice : mémoire persistante, feedback de fin de session, scénarios de jeu de rôle — plus paywall, push, et quotas freemium.

### Architecture

- **Mémoire :** nouvelle table `coach_memory` (par utilisateur, par langue), profil structuré (sujets récents, niveau, zones faibles, contexte personnel, résumé de la dernière session). Chemin d'écriture : `voice.ts /end` appelle gpt-4o-mini pour fusionner la mémoire existante avec la nouvelle transcription → upsert. Chemin de lecture : `streamChatCompletion` appelle `buildCoachSystemPrompt` avec bloc mémoire optionnel ; le builder de prompt du coach injecte un paragraphe `<context>` si la mémoire est présente.
- **Feedback :** nouvelle table `session_feedback` (par conversation). Chemin d'écriture : `voice.ts /end` retourne synchronement après l'écriture, OU async via un endpoint `POST /sessions/:id/feedback` que le mobile poll quand la sheet de fin de session s'ouvre. Un seul appel gpt-4o avec la transcription complète → JSON structuré (highlights / corrections / vocab) → validation Zod → stocker. Lecture : le même endpoint retourne la ligne.
- **Jeu de rôle :** catalogue statique dans `packages/shared/src/role-play-scenarios.ts` (10 scénarios, chacun un template de system-prompt + 2-3 « twists »). Nouveau endpoint `POST /sessions/start` accepte `scenarioId` (optionnel) ; le prompt du coach est construit depuis le template de scénario au lieu du greeting par défaut.
- **Feature gating :** nouveau module `apps/api/src/lib/features.ts` qui enrobe les lookups d'entitlement. Fonctions : `canUseFeature(userId, feature)` et `getDailyQuota(userId, feature)`. Utilisé à : la gate feedback de fin de session (gratuit = session courante seulement), le picker de jeu de rôle (gratuit = 3 scénarios), la profondeur de mémoire (gratuit = basique / Pro = profonde).
- **Quota quotidien :** étendre le schéma `entitlements` avec `dailyVoiceSecondsUsed` + `dailyResetAt` (ou calculer depuis `usage_events`). Ajouter plafond 10 min/jour pour gratuit, plafond soft 60 min/jour pour Pro.
- **Paywall :** RevenueCat + react-native-purchases. Abonnements consommables iOS + Android (7,99 $/mois, 49,99 $/an). Écran paywall modal, déclenché sur dépassement de quota, sur tap de fonctionnalité Pro, ou au jour 7.
- **Notifications push :** Expo Push, jobs programmés dans `apps/api/src/jobs/`. Notifications jour 1, 2, 7, 14 selon l'état utilisateur. Utilise la table `push_tokens` existante.

### Ajouts au tech stack

- `revenuecat/react-native-purchases` (mobile)
- Pas de nouvelles deps serveur ; réutilise openai + supabase + drizzle

### Découpage des tâches (en miroir du pattern existant)

Cible : 12–14 tâches atomiques, 1–2h chacune. Durée honnête 4–5 semaines.

1. **Migrations de schéma** — `coach_memory`, `session_feedback`, étendre `entitlements`, policies RLS
2. **Module de feature-gating** — `lib/features.ts`, types, tests unitaires
3. **Refactor abstraction de provider TTS** (ou différer au Plan 10 — décision Bruno) — envelopper OpenAI TTS derrière interface, ajouter stub d'implémentation Inworld
4. **Job d'extraction mémoire** — fonction d'extraction gpt-4o-mini, prompt, schéma Zod, tests unitaires
5. **Injection mémoire** — étendre `buildCoachSystemPrompt`, intégrer dans `streamChatCompletion`
6. **UI de consentement mémoire** — écran onboarding + écran éditeur Profile pour « La mémoire de ton coach »
7. **Génération de feedback** — appel gpt-4o, sortie JSON structurée, schéma Zod, endpoint, stockage
8. **Sheet de fin de session** — UI mobile (3 panneaux : highlights / corrections / vocab), poll l'endpoint feedback
9. **Catalogue de scénarios de jeu de rôle** — 10 scénarios, templates de prompt, UI de picker
10. **Démarrage de session jeu de rôle** — étendre l'endpoint session-start, chemin de conversation-prompt avec template de scénario
11. **Application du quota quotidien** — wrapper l'endpoint voix, 10 min/jour gratuit, plafond soft 60 min/jour Pro
12. **Intégration RevenueCat** — webhook entitlements, écran paywall, identifiants store
13. **Notifications push** — jobs jour 1/2/7/14, templates de messages, programmation par timezone utilisateur
14. **Préparation soumission App Store / Play Console** — captures, descriptions, disclaimer contenu IA, consentement GDPR, vérification suppression de compte

### Fichiers critiques pour le Plan 8

- `apps/api/src/routes/voice.ts` (étendre handler `/end`)
- `apps/api/src/lib/quota.ts` + nouveau `apps/api/src/lib/features.ts`
- `packages/shared/src/prompts.ts` (injection mémoire)
- `packages/shared/src/role-play-scenarios.ts` (nouveau)
- `apps/api/src/db/schema/coach-memory.ts` (nouveau)
- `apps/api/src/db/schema/session-feedback.ts` (nouveau)
- `apps/api/src/db/schema/entitlements.ts` (étendre)
- `apps/api/migrations/0010_coach_memory.sql` (nouveau)
- `apps/api/migrations/0011_session_feedback.sql` (nouveau)
- `apps/api/migrations/0012_entitlements_daily_quota.sql` (nouveau)
- `apps/mobile/app/(tabs)/profile/memory.tsx` (nouveau)
- `apps/mobile/app/(tabs)/practice.tsx` (étendre — sheet de fin de session)
- `apps/mobile/app/(modals)/role-play-picker.tsx` (nouveau)
- `apps/mobile/app/(modals)/paywall.tsx` (nouveau)

### Ce qui n'est PAS dans le Plan 8 (dire non délibérément)

- Jeu de cartes vocab (Plan 9)
- Score de prononciation (Plan 10)
- Correction douce en temps réel (Plan 9 ou 10)
- Leçon quotidienne auto-générée (Plan 10)
- Graphique de confiance à l'oral (Plan 9)
- Assurance streak (Plan 9)
- Déploiement multi-région (différé)
- Tarification géographique
- Tier lifetime
- Système de parrainage

### Définition de fait pour le Plan 8

- L'app est sur Play Store internal track (track Production après validation de stabilité)
- L'app est sur App Store TestFlight (production après review Apple)
- Le paywall est câblé, RevenueCat enregistre, le flag Pro bascule à l'achat
- 5+ utilisateurs testeurs ont complété une session, vu le feedback, édité leur mémoire, essayé un jeu de rôle
- La suppression de compte est vérifiée fonctionnelle de bout en bout sur les deux stores

---

## Plan 9 — « La boucle de vocab » (4 semaines)

**Objectif :** la boucle d'habitude addictive. Extraction de vocab + jeu de cartes SRS + graphique de confiance à l'oral + assurance streak. C'est ce qui double le nombre de sessions.

### Architecture

- **Extraction de vocab :** `voice.ts /end` ajoute un appel gpt-4o-mini qui extrait 5–8 items vocab (terme, traduction, source-message-id, difficulté, partie du discours). Insère dans la table `vocab_items` existante. Ajouter colonnes `next_review_at` + `interval_days` + `ease` pour SRS.
- **Moteur SRS :** algorithme FSRS dans `apps/api/src/lib/srs.ts`. À la review de carte, calculer le prochain intervalle selon succès/échec. Cartes dues aujourd'hui récupérées via `next_review_at <= now()`.
- **Jeu de cartes :** nouvelle route `(tabs)/vocab.tsx` + écran de jeu. Mode voice translate + mode tap-translate pour v1 (différer listen-repeat + write à v1.1). Métaphore de pile de cartes matchant les captures d'écran que Bruno a partagées.
- **Palette dark du jeu :** scopée au composant `apps/mobile/components/vocab-game/`. Ne pas polluer les tokens globaux.
- **Graphique de confiance à l'oral :** widget sur l'onglet progress. Lit depuis la table `messages` existante (calculer mots/min depuis le texte + durée sur fenêtre glissante de 4 semaines).
- **Assurance streak :** simple flag booléen sur la table `streak_days` — « frozen », consommé sur invocation utilisateur. Gratuit = 1/semaine, Pro = illimité.

### Découpage des tâches (8–10 tâches)

1. Migration de schéma : étendre `vocab_items` avec colonnes SRS
2. Extraction de vocab à la fin de session (gpt-4o-mini)
3. Algorithme FSRS + tests unitaires
4. Endpoint liste vocab + cartes dues
5. UI jeu de cartes — mode voice translate
6. UI jeu de cartes — mode tap-translate + combo / jauge d'énergie
7. Widget graphique de confiance à l'oral
8. Toggle assurance streak + UI
9. Notification push : « X cartes t'attendent »
10. Intégration paywall pour cartes illimitées

### Fichiers critiques

- `apps/api/src/db/schema/vocab.ts` (étendre)
- `apps/api/migrations/0013_vocab_srs.sql` (nouveau)
- `apps/api/src/lib/srs.ts` (nouveau)
- `apps/api/src/routes/vocab.ts` (nouveau — liste, review, dues)
- `apps/mobile/app/(tabs)/vocab.tsx` (nouveau)
- `apps/mobile/components/vocab-game/` (nouveau dir)
- `apps/mobile/components/speaking-confidence-chart.tsx` (nouveau)

### Définition de fait pour le Plan 9

- Sessions moyennes par utilisateur actif / semaine doublent vs la baseline du Plan 8
- 30 %+ des utilisateurs actifs reviewent au moins une carte par jour
- Le taux de conversion Pro augmente de 30 %+ par rapport au lancement Plan 8

---

## Plan 10 — « La boucle de prononciation » (3 semaines)

**Objectif :** la signature la plus forte du tier Pro. Le score de prononciation est ce qui fait basculer les indécis hors du tier gratuit.

### Architecture

- **Score de prononciation :** Azure Pronunciation Assessment comme provider v1 (meilleure qualité, intégration la plus simple). Coût ~0,02 $/utterance. Pro seulement.
- **Stockage audio avec consentement :** `messages.audio_storage_path` supporte déjà l'audio utilisateur (le schéma accepte ça). Ajouter `uploadUserAudio` dans `voice.ts` à côté du `uploadCoachAudioChunk` existant. Écran de consentement onboarding + bouton Profile supprimer-mon-audio.
- **« Écoute le toi du passé » :** nouvel écran — comparaison de prononciation semaine sur semaine, lecteur audio pour chaque utterance.
- **Leçon quotidienne auto :** nouvelle notification push — « Focus du jour : passé composé (tu as galéré la semaine dernière) ». Tape dans le prompt de jeu de rôle avec focus explicite sur zone faible.
- **Correction douce temps réel :** toggle opt-in dans Profile. Quand activé, le prompt du coach inclut « Si l'utilisateur fait une erreur claire, corrige-la doucement inline au plus une fois tous les ~5 tours. »

### Découpage des tâches (6–8 tâches)

1. Intégration provider Azure Pronunciation Assessment
2. Stockage audio utilisateur + flow de consentement
3. Stockage score de prononciation + endpoint
4. Écran « Écoute le toi du passé »
5. Push leçon quotidienne auto + intégration jeu de rôle
6. Toggle correction temps réel + changement de prompt
7. Email hebdomadaire de progrès (gpt-4o-mini summarizer + SendGrid ou Resend)

### Fichiers critiques

- `apps/api/src/providers/azure-pronunciation.ts` (nouveau)
- `apps/api/src/routes/voice.ts` (étendre — `uploadUserAudio`)
- `apps/api/src/jobs/daily-lesson-push.ts` (nouveau)
- `apps/mobile/app/(tabs)/progress/pronunciation.tsx` (nouveau)
- `apps/mobile/app/(tabs)/profile.tsx` (étendre — toggle correction)

### Définition de fait pour le Plan 10

- 60 %+ des utilisateurs Pro ont donné consentement au stockage audio
- La conversion Free→Pro s'améliore mesurablement (cible : 20 %+ d'amélioration vs baseline du Plan 9)
- 30 %+ des utilisateurs Pro ouvrent l'écran prononciation au moins hebdomadairement

---

## Vérification — comment savoir si chaque phase fonctionne

### Lancement Plan 8 (Semaine 7)

- App Store + Play Store live (tracks production)
- 50+ installs testeurs iOS + Android
- 5+ abonnés payants dans les 14 jours après lancement public
- Taux de session sans crash >99,5 %
- Suppression de compte vérifiée fonctionnelle
- Sentry a <1 erreur unique pour 100 sessions

### Lancement Plan 9 (Semaine 11)

- Cartes-par-jour par utilisateur actif >5 (médiane)
- Rétention jour 7 s'améliore de 20 % vs cohorte Plan 8
- Rétention jour 30 >25 % (baseline Plan 8 probablement 10–15 %)
- Reviews sur les stores : 4,4+ étoiles moyenne sur 20+ reviews

### Lancement Plan 10 (Semaine 14)

- 30+ abonnés payants (240 $+/mois MRR)
- Conversion Free→Pro des utilisateurs installés >2 %
- 1 pièce de contenu YouTube a >5k vues (distribution organique validée)
- Rétention de la feature prononciation : 30 %+ des utilisateurs Pro l'utilisent hebdomadairement

### Vérif trimestrielle (Mois 6)

- 1k $ MRR — à ce point on est dans la bande de probabilité 40–50 % de succès
- 5+ témoignages honnêtes d'utilisateurs réels
- Burn-rate : net positif mois sur mois (revenu > infra + outils)

### Déclencheurs de pivot

- **Aucun abonné payant après 30 jours post-lancement :** le positionnement est faux. Repositionner + relancer dans les 2 semaines.
- **Rétention jour 7 <5 % sur 100+ utilisateurs :** l'expérience de première session est fausse. Redessiner l'onboarding + la première session.
- **Utilisateurs gratuits actifs >500 mais conversion Pro <1 % :** le placement du paywall / l'histoire de valeur est fausse. Tester A/B les déclencheurs de paywall.
- **Contenu YouTube sous-performant après 8 semaines :** switcher vers TikTok ou contenu court-format Reddit. Ne pas doubler la mise sur un canal qui ne produit pas.

---

## Décisions ouvertes pour Bruno (à résoudre avant la spec du Plan 8)

Classées par impact.

1. **Positionnement de niche pour l'histoire de lancement.** A (ingés apprenant italien/espagnol/français/allemand pour relocation), B (anglais pour ingés non-natifs en entretien), C (italien pour anglophones déménageant en Italie). Mon vote : A. Cette décision pilote TOUT le copy marketing, les mots-clés ASO, l'angle du contenu YouTube, le hero de la landing page.
2. **Tarification.** 7,99 $/mois + 49,99 $/an (recommandation Round 2), 9,99 $/mois + 59,99 $/an (Round 1), ou 5,99 $/mois en sous-positionnement. Les données du Round 2 penchent pour 7,99 $.
3. **Deal lifetime founders.** 99 $ lifetime pour les 200 premiers utilisateurs, oui/non. Les nouvelles données disent zapper en v1 — verrouille un plancher de prix trop bas avant qu'on sache si la montée en gamme est viable.
4. **Timing de l'abstraction de provider TTS.** Tâche 1 du Plan 8 (maintenant, ~3 jours de travail, débloque la TTS premium du tier Pro) vs différer au Plan 10. Vote : inclure dans le Plan 8 — petite tâche, ouvre le différenciateur du tier Pro plus tôt.
5. **Mécanisme de livraison du feedback.** Synchrone dans la réponse `/end` (~3 sec de latence) vs async via endpoint séparé (`/end` instantané, polled). Vote : async — meilleure UX, ne bloque pas la sheet de fin de session.
6. **Profondeur de mémoire du tier gratuit.** Mémoire basique (nom, sujets récents, résumé de niveau) gratuite vs TOUTE la mémoire Pro seulement. Vote : basique gratuit — l'expérience gratuite sans AUCUNE mémoire est froide, tue le funnel.
7. **YouTube vs autre canal primaire de distribution.** Vote Round 2 : YouTube + Reddit secondaire. Es-tu OK avec un investissement contenu de 8–12h/semaine, ou tu veux te pencher vers TikTok/court-format ?
8. **Séquence de lancement iOS vs Android.** Android en premier (ton build dev marche déjà, la deadline Play 2026-07-04 force ça) + iOS 4–6 semaines plus tard (TestFlight puis production). Vote : Android en premier, ride la deadline, iOS comme milestone du Plan 9.
9. **Choix du provider de prononciation.** Azure Pronunciation Assessment (meilleure qualité) vs SpeechSuper (moins cher) vs ELSA SDK (meilleure marque). Vote : Azure pour v1 — qualité + vitesse d'intégration.
10. **Le Plan 8 doit-il attendre le merge de la suppression de compte, ou avancer en parallèle ?** La suppression de compte est le blocage dur pour la soumission App Store. La rédaction de la spec du Plan 8 peut tourner en parallèle ; la tâche #1 du Plan 8 (migrations de schéma) peut aussi démarrer en parallèle. Le travail UI mobile du Plan 8 devrait attendre le merge de la suppression pour éviter les conflits de merge sur profile.tsx.
11. **Durée de l'essai.** 7 jours vs 14 jours. Données : 14 jours montre ~5 % trial-to-paid plus haut mais taux de start trial plus bas. Effet net ambigu. Vote : 7 jours (standard, moins de paralysie d'analyse).
12. **Stratégie linguistique des métadonnées App Store.** Captures/descriptions en anglais seulement vs localisées dans les 12 langues cibles. Vote : anglais + top 4 langues supportées (italien, espagnol, français, allemand) pour v1. Localiser plus tard si la traction le justifie.

---

## Fichiers critiques à modifier sur les Plans 8/9/10 (vue d'ensemble)

**Backend (`apps/api/src/`) :**

- `routes/voice.ts` — étendre `/end`, ajouter `/feedback`, ajouter param scénario à `/sessions/start`
- `lib/quota.ts` — ajouter vérification de quota quotidien
- `lib/features.ts` — NOUVEAU — module de feature-gating
- `db/schema/{coach-memory,session-feedback,vocab,entitlements}.ts` — nouveaux + étendre
- `providers/openai.ts` — extraire helper d'appel feedback gpt-4o
- `providers/azure-pronunciation.ts` — NOUVEAU (Plan 10)
- `providers/tts-strategy.ts` — NOUVEAU (Tâche 3 du Plan 8 si Bruno donne le feu vert)
- `jobs/{day-1-push,day-7-summary,daily-lesson}.ts` — NOUVEAUX

**Shared (`packages/shared/src/`) :**

- `prompts.ts` — étendre `buildCoachSystemPrompt` pour mémoire + jeu de rôle
- `role-play-scenarios.ts` — NOUVEAU
- `feedback-schema.ts` — NOUVEAU (Zod)
- `coach-memory-schema.ts` — NOUVEAU (Zod)

**Mobile (`apps/mobile/app/`) :**

- `(tabs)/practice.tsx` — étendre (sheet de fin de session)
- `(tabs)/vocab.tsx` — NOUVEAU (Plan 9)
- `(tabs)/profile.tsx` — étendre (lien éditeur mémoire, toggle correction, consentement audio)
- `(tabs)/profile/memory.tsx` — NOUVEAU
- `(tabs)/progress/pronunciation.tsx` — NOUVEAU (Plan 10)
- `(modals)/paywall.tsx` — NOUVEAU
- `(modals)/role-play-picker.tsx` — NOUVEAU
- `(onboarding)/memory-consent.tsx` — NOUVEAU

**Design tokens (`packages/design-tokens/src/`) :**

- Ajouter une palette dark scopée pour le jeu vocab au Plan 9 — garder Sunrise intouché globalement

---

## Opinion honnête sur l'aventure

Après recherche et ancrage plus profonds :

**Oui, il existe un chemin réel mais étroit.** 1k–10k $ MRR en 18 mois est atteignable avec le plan ci-dessus, en supposant :

- Le positionnement de niche est choisi et tenu
- Le contenu fondateur tourne hebdomadairement pendant 6 mois minimum
- Le Plan 8 livre en 7 semaines (pas 4 comme espéré initialement)
- La suppression de compte atterrit mi-juin sans glisser
- L'ingénierie de rétention est prise aussi sérieusement que l'ingénierie de fonctionnalités

**Les cotes du pari produit favorisent « livrer et valider », pas « construire plus avant de lancer ».** Chaque semaine non passée sur l'App Store avec un flow d'abonnement payant est une semaine gaspillée dans cette catégorie — le paysage concurrentiel IA bouge plus vite que ton cycle d'itération. Mieux vaut lancer le Plan 8 à la semaine 7 et apprendre des vrais utilisateurs que construire les Plans 8 + 9 en parallèle pendant 10 semaines avant tout feedback externe.

**Les signaux Babbel Speak / Duolingo Max sont dégrisants.** Ils confirment : la conversation IA seule N'EST PAS suffisante pour commander des revenus d'abonnement. **Tout notre pitch doit être le système de coaching, pas l'IA.** Mémoire + feedback + vocab + prononciation sont le système. L'IA est le moteur qui les rend intelligents. Vends le système. Montre le moteur.

**Le plus gros risque après le burnout :** prendre trop de temps à lancer et rater la fenêtre de différenciation. Le déploiement de la mémoire ChatGPT vers la voix, Babbel Speak gagnant en traction, le polish continu de Speak sur OpenAI Realtime — l'écart se ferme mensuellement. **Livrer le Plan 8 en juillet, pas en septembre.**

**La plus grosse opportunité unique :** la boucle de coaching (mémoire + feedback + vocab + jeu de rôle) n'existe vraiment pas comme produit intégré aujourd'hui. Speak a la conversation IA. ELSA a la prononciation. Babbel a les leçons structurées + IA gratuite. Duolingo a la gamification. Personne n'a les quatre câblés en une boucle cohérente qui compose. Si on livre cette boucle, le positionnement s'écrit tout seul.

---

## TL;DR

1. **Le brouillon du Round 1 était trop rose sur le prix, la marge, et le paysage concurrentiel.** Le Round 2 corrige : 7,99 $/mois, marge réelle 30–50 % pas 70 %, Babbel Speak est maintenant gratuit, Duolingo Max à 9 % signifie que la voix-IA-seule est une commodité.
2. **Repositionner : « système de coaching qui utilise l'IA » — pas « app de conversation IA ».** Ça survit à Babbel-Speak-gratuit. Le positionnement pure-conversation-IA non.
3. **Choisir un persona de niche pour le lancement** — recommandé : « Coach de conversation IA pour ingés/travailleurs remote apprenant italien/espagnol/français/allemand pour relocation. » Tout le reste reste générique, l'histoire de lancement est étroite.
4. **Plan 8 = 4–5 semaines honnêtes** (mémoire + feedback fin de session + jeu de rôle + paywall + push + quotas freemium). La suppression de compte est un BLOCAGE DUR — spécifier le Plan 8 en parallèle mais ne pas démarrer l'implémentation avant le merge de la suppression.
5. **Plan 9 = 4 semaines** (extraction vocab + jeu de cartes + SRS + graphique de confiance + assurance streak). La table `vocab_items` existe déjà — avance.
6. **Plan 10 = 3 semaines** (prononciation via Azure + stockage audio utilisateur + leçon quotidienne auto + correction douce).
7. **Distribution : s'engager sur YouTube hebdo + Reddit adjacent.** 8–12h/semaine de contenu. Chiffre réel, pas optionnel.
8. **Tarification : 7,99 $/mois + 49,99 $/an + essai 7 jours. Pas de lifetime en v1.**
9. **Tier gratuit : 10 min/jour, 3 dernières sessions, 3 jeux de rôle, mémoire basique, feedback session courante. Jeu de cartes 10/jour.**
10. **Probabilités d'outcome (18 mois) :** 1k $ MRR ~40–50 %, 10k $ MRR ~10–15 %, 50k $ MRR <5 %. Si 1k–10k $ MRR est un outcome qui a du sens pour toi, procède. Sinon, resserrer la niche ou reconsidérer.
11. **Les 12 décisions ouvertes** ci-dessus sont à résoudre quand on brainstorme la prochaine fois. Top trois : persona de niche, tarification, YouTube vs autre canal.

---

_Fin du Round 2. Les 12 décisions ouvertes sont l'input de brainstorm pour la prochaine session._
