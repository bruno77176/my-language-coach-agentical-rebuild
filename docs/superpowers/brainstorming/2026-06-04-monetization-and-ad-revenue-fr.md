# Monétisation & revenus publicitaires — couvrir le coût des gratuits, pubs, et projections de revenu

**Date :** 2026-06-04
**Auteur :** Claude (à la demande de Bruno)
**Complément de :** `2026-05-30-strategy-round-2-fr.md` (stratégie canonique). Ce document ne **remplace pas** le doc de stratégie — celui-ci possède le prix, le positionnement et le tunnel d'abonnement. Il **ajoute** la couche que la stratégie n'a jamais traitée : **comment empêcher les gratuits de coûter de l'argent, est-ce que la pub peut aider, et à quoi ressemble vraiment le revenu combiné.**

> ⚠️ Tous les chiffres sont des **estimations avec hypothèses explicites**, pas des garanties. L'eCPM publicitaire surtout est très variable (pays, engagement, saison). À lire comme un modèle de raisonnement, pas une prévision.

---

## 0. Chiffres repris du doc de stratégie (pour rester cohérent)

| Levier                     | Valeur canonique (doc stratégie)                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prix                       | **7,99 $/mois, 49,99 $/an (4,16 $/mois éq.), essai 7 jours opt-out**                                                                               |
| Net après commission store | 30 % → **5,59 $/mois** net (mensuel), **34,99 $/an** ≈ 2,92 $/mois (annuel)                                                                        |
| Free tier                  | **5 min/jour de voix** (10 min "lune de miel" les 3 premiers jours — voir §8), 3 jeux de rôle/jour, 3 dernières sessions, mémoire de base gratuite |
| Coût à servir              | **~0,025 $/min API seul** ; **0,05–0,10 $/min "user-facing"** (infra + marge)                                                                      |
| Conversion                 | essai→payant **38–54 %** ; download→abonné **1,7 %** ; download→essai **3,7–8,9 %**                                                                |
| Cible                      | **1k MRR (40–50 % de proba)** — PAS une optimisation $10k+                                                                                         |
| Marge gros utilisateur     | À 60 min/mois un abonné Pro ne rapporte que **0–2 $/mois** de contribution ; les légers 3–5 $                                                      |

La couche pub ci-dessous se construit **par-dessus** ça, pas contre.

---

## 1. La thèse centrale (le recadrage honnête)

**Les pubs seules ne couvrent (presque) jamais une appli voix IA.**

Le problème : ton **coût par utilisateur gratuit est anormalement élevé** pour une appli mobile. La plupart des apps gratuites coûtent ~0 $/user (juste l'hébergement). Toi, **chaque minute de conversation coûte de l'argent réel** : STT + LLM + TTS.

Ordre de grandeur (tout compris, pour _servir_ — API + infra, hors marge) : **~0,03–0,05 $/min.**

Coût mensuel d'un user gratuit :

- 5 min/jour → ~0,20 $/jour → **~6 $/mois**
- 10 min/jour (le plafond actuel) → **~9–15 $/mois**

👉 Un utilisateur gratuit _engagé_ peut te coûter **plus cher qu'un abonné ne te rapporte**. C'est le piège des apps IA.

Ce que rapporte une pub mobile :

- **Pub récompensée (rewarded video)**, la plus rentable : eCPM ~10–30 $ dans les pays riches (US/UK), ~1–5 $ ailleurs. Donc **une pub regardée ≈ 0,005–0,03 $.**
- Bannière / interstitielle : moins.

Donc : **une minute de voix coûte ~0,05 $, une pub regardée rapporte ~0,01 $.** Une pub ne paie même pas une minute. Les pubs **ne peuvent pas** financer de la voix IA illimitée. C'est mathématique, pas du pessimisme.

---

## 2. Le vrai levier n°1 : plafonner le coût (tu l'as déjà à moitié)

Avant les pubs, ce qui empêche réellement les gratuits de te saigner :

1. **Plafonds d'usage stricts** — tu as DÉJÀ ça (`FREE_TIER_VOICE_SECONDS_PER_DAY/MONTH`). La valeur de ce chiffre EST ton bouton coût. Un free tier à 3–5 min/jour borne le coût à ~2–4 $/mois max par user. Les 10 min/jour du doc stratégie collent à Talkpal et aident la conversion, mais côté coût pur ça laisse un gratuit "à fond" coûter ~9–15 $/mois. **Cette tension est LA décision de monétisation la plus importante.** (Voir §6.)
2. **Modèles moins chers pour le free tier** — STT/LLM/TTS bon marché en gratuit, premium en Pro (déjà suivi dans le travail de benchmarking).
3. **Cache** — greetings déjà cachés ; à étendre aux phrases récurrentes / ouvertures.

**À retenir : le plafond est le levier de coût dominant. Les pubs sont secondaires.**

---

## 3. Là où les pubs ONT du sens : la vidéo récompensée

Pas pour "couvrir les frais" globalement, mais pour **aligner coût et revenu, minute par minute** :

> « Ta session gratuite est finie. **Regarde une pub pour gagner +3 minutes.** »

C'est le pattern malin : l'utilisateur qui veut plus paie en attention (une pub) au moment exact où il génère du coût. Ça transforme un coût subi en coût **partiellement compensé**, et ça **pousse vers l'abonnement** (au bout de 3–4 pubs → « abonne-toi pour enlever pubs & limites »). C'est un **levier de conversion**, pas une source de revenu principale.

### Les bases des pubs (puisque tu pars de zéro)

- **Régie pub :** **Google AdMob** (le standard mobile). Pour Expo/RN → `react-native-google-mobile-ads` (plugin Expo). Module natif → rappel : lance `pnpm install` après l'`expo install` sinon le binaire ne part pas dans le build.
- **Formats :** _rewarded_ (ta cible), interstitiel (entre deux écrans), bannière (faible revenu, dégrade l'UX). **Pour toi : rewarded uniquement au début.**
- **Consentement obligatoire :** RGPD (UE) via le SDK UMP d'AdMob, et **ATT sur iOS** (la fenêtre « Autoriser le suivi »). Sans ça → comptes bloqués / revenus quasi nuls. Apple/Google sont stricts.
- **eCPM dépend du pays :** un user français/US rapporte 5–10× plus qu'un user d'un pays à faible revenu. Ton audience mondiale tire la moyenne vers le bas.

---

## 4. Projections de revenu (abonnements = colonne vertébrale, pubs = appoint)

**Hypothèses** (calées sur le doc stratégie ; conservatrices) :

- ARPU net mélangé par abonné payant : **~4,50 $/mois** (mix mensuel 5,59 $ net et annuel 2,92 $ net éq.).
- En régime stable, **payants ≈ 2,5 % des MAU** (entre les 1,7 % download→abonné et une conversion active plus haute).
- Coût à servir mélangé d'un gratuit : **~0,50 $/MAU gratuit/mois** (la plupart sont légers ; une minorité approche le plafond — c'est l'entrée la plus incertaine, très dépendante du plafond).
- **ARPU pub : 0,05–0,10 $ par MAU gratuit/mois** (rewarded, hors jeu, moyenne mondiale — volontairement conservateur).

|                               | Démarrage         | Base (≈ cible 1k MRR) | Étirement             |
| ----------------------------- | ----------------- | --------------------- | --------------------- |
| MAU                           | 2 000             | 8 000                 | 20 000                |
| Abonnés payants (~2,5 %)      | 50                | 200                   | 500                   |
| **MRR abonnements (net)**     | **~225 $**        | **~900 $**            | **~2 250 $**          |
| MAU gratuits                  | 1 950             | 7 800                 | 19 500                |
| **Revenu pub**                | 100–195 $         | 390–780 $             | 975–1 950 $           |
| Coût à servir les gratuits    | ~975 $            | ~3 900 $              | ~9 750 $              |
| Coût variable/infra Pro       | ~150 $            | ~600 $                | ~1 500 $              |
| **Net (abos + pubs − coûts)** | **−650 à −800 $** | **−2 200 à −2 600 $** | **−6 300 à −7 300 $** |

### À lire attentivement

Avec un **plafond gratuit de 10 min/jour et seulement ~2,5 % de conversion, le modèle est sous l'eau** — le coût des gratuits écrase à la fois le revenu d'abonnement et de pub. C'est le vrai danger que Bruno pressentait. Deux choses le corrigent :

1. **Resserrer le plafond et/ou réserver les extensions aux pubs récompensées** (voir §6) → coupe la ligne de coût dominante.
2. **Améliorer la conversion** (meilleur onboarding, taux de démarrage d'essai) → plus d'abonnés par gratuit.

Le même scénario Base avec un **plafond gratuit plus serré (≈ 0,15 $/MAU gratuit de coût)** et **3 % de conversion** :

|                       | Base (réglé)                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| MAU                   | 8 000                                                                                                 |
| Abonnés payants (3 %) | 240 → **~1 080 $ MRR**                                                                                |
| Coût des gratuits     | ~1 170 $                                                                                              |
| Revenu pub            | ~585 $                                                                                                |
| Coût variable Pro     | ~700 $                                                                                                |
| **Net**               | **≈ −200 $** (à peu près à l'équilibre, tendance positive à mesure que les abos annuels s'accumulent) |

👉 **Les pubs ne rendent pas les gratuits rentables. C'est le plafond + la conversion qui le font. Les pubs transforment "très négatif" en "proche de l'équilibre" sur la base gratuite, et accélèrent les upgrades.**

---

## 5. Est-ce que ça couvre les frais ? Verdict honnête

**Non — pas les pubs seules.** Le modèle qui marche pour toi, c'est un **trépied** :

1. **Plafonds serrés** → bornent le coût des gratuits (le levier n°1).
2. **Pubs récompensées** → compensent _partiellement_ le coût des gratuits + poussent à l'abonnement.
3. **Abonnements (RevenueCat — déjà branché)** → **c'est ça qui finance réellement tout.**

Les pubs, c'est la **cerise** : un peu de revenu sur les gratuits + un déclencheur de conversion. Le **gâteau, c'est l'abonnement.** Pour une appli voix IA, miser sur la pub comme revenu principal est perdant.

---

## 6. Recommandation (par paliers, réaliste side-hustle pour ~1k MRR)

1. **D'abord, régler le bouton plafond.** Trancher la tension : 10 min/jour, c'est super pour l'engagement mais dangereux côté coût. Reco : **baisser la base toujours-gratuite (ex. 5 min/jour)**, puis laisser les **pubs récompensées la compléter** (+3 min/pub, plafond 2–3 pubs/jour). Ça borne le coût de base ET lie chaque minute extra à une pub vue. Gratuit à implémenter (valeur du plafond) ; moyen pour le câblage pub.
2. **Ensuite, ajouter les pubs récompensées** comme mécanique "+minutes" — crée un 2e revenu **et** un tunnel de conversion (« abonne-toi pour enlever pubs & limites »). Ça se marie naturellement avec le paywall + quota du Plan 8.
3. **Ne jamais traiter la pub comme revenu principal.** Les abonnements portent le business ; les pubs amortissent la fuite du free tier.
4. **Suivre l'économie unitaire par cohorte** — ajouter "coût par MAU gratuit" et "ARPU pub par MAU gratuit" au cost dashboard, pour régler le plafond avec de vraies données, pas au doigt mouillé.

### Séquencement vs. la roadmap

Le travail paywall + entitlements + quota journalier est déjà une tâche **Plan 8** (doc stratégie §"Plan 8"). Les pubs récompensées sont un **add-on Plan 8 ou un fast-follow** naturel : le moment "quota dépassé" est exactement là où s'affichent ET le paywall ET le « regarde une pub pour +minutes ». À construire ensemble.

---

## 7. Décisions (tranchées le 2026-06-04 avec Bruno)

1. **Base gratuite : 5 min/jour + compléments par pub.** ✅ DÉCIDÉ. La base toujours-gratuite passe des 10 min/jour du doc stratégie à **5 min/jour** ; les minutes supplémentaires viennent uniquement des pubs récompensées (et "enlever les limites" est un argument d'abonnement). ⚠️ Le doc de stratégie indique encore 10 min/jour — à mettre à jour pour cohérence lors de sa prochaine révision.
2. **Pubs uniquement comme mécanique d'extension de quota.** ✅ DÉCIDÉ. Aucune pub pour les abonnés ni les users en essai ; jamais de spam pub dans la boucle principale. La pub récompensée ne se déclenche qu'au moment « quota gratuit atteint → +3 min contre une pub ».
3. **Pubs sur iOS ET Android, avec repli auto en non-personnalisé.** ✅ DÉCIDÉ. Intégrer AdMob une seule fois pour les deux plateformes, afficher la fenêtre de consentement ATT iOS, et laisser AdMob servir des pubs non personnalisées à ceux qui refusent. La vidéo récompensée est le format le moins pénalisé par le refus ATT, donc inutile de couper iOS. (Rappel : le consentement RGPD UMP en UE se gère de la même façon.)
4. **Pubs partout (tous pays).** ✅ DÉCIDÉ. Dans ce design, le rôle premier de la pub récompensée est le **contrôle du coût + le coup de pouce conversion**, pas le revenu — elle a donc sa place même dans les pays à faible eCPM (elle borne quand même le coût des gratuits et pousse à s'abonner). Le revenu pub n'est qu'un bonus là où l'eCPM est élevé.

---

## 8. Affinage du plafond gratuit — « lune de miel → resserrement » (livré le 2026-06-26)

La décision du §7 (« 5 min/jour de base ») est désormais **implémentée**, affinée d'un ajout : une **fenêtre de lune de miel**.

### La décision

- **Jours 1–3 (glissants, depuis l'inscription) : 10 min/jour.** De quoi atteindre le « aha » et créer une habitude quotidienne.
- **Jour 4+ : 5 min/jour de base.** Le mur mord désormais chaque jour pour le learner engagé.
- **Pub récompensée : +3 min, 1×/jour, uniquement au mur**, gardée en choix **secondaire** à côté de l'essai Pro.

### Pourquoi une lune de miel (la science, pas seulement le coût)

Le vrai problème d'un plafond généreux n'est pas le coût — c'est la **pression de conversion**. À 10–13 min/jour pour toujours, ton learner le plus motivé (= ton meilleur prospect) est _satisfait_ et n'a aucune raison de payer. La lune de miel résout la tension entre deux besoins :

- **Construire l'habitude + la dotation d'abord** (jours 1–3 généreux) → l'utilisateur investit, crée une routine, commence à « posséder » le produit (effet de dotation).
- **Puis créer un manque ressenti** (chute à 5 min) → l'**aversion à la perte** fait le travail : il avait 10, il sent le resserrement, et l'abo est le moyen évident de les récupérer. La coupure tombe en pleine conversation (pic d'engagement) = le meilleur moment de conversion.

Benchmarks (2026) à l'appui : freemium→payant **3–5 %**, mais un **essai gratuit opt-out convertit à 25–60 %** — donc le mur doit pousser l'**essai 7 jours** en CTA primaire, la pub en sortie de secours. 82 % des essais démarrent au jour 0, donc la lune de miel avance aussi l'offre d'essai. Le gratuit de Talkpal est à 10 min/jour, donc la lune de miel reste compétitive à la première impression tandis que le régime permanent à 5 min protège la marge.

### Réalité des coûts (rafraîchie sur les rate cards en prod)

Par minute de conversation (seulement ~30 s STT + ~30 s TTS facturées par minute d'horloge) :

| Stack                               | $/min            | Moteur du coût |
| ----------------------------------- | ---------------- | -------------- |
| Défaut (gpt-4o-mini-tts + Deepgram) | **~0,01 $**      | TTS ≈ 90 %     |
| Premium (ElevenLabs)                | **~0,05–0,10 $** | TTS            |

Chiffre de planif **~0,02 $/min**. Plafonds journaliers à plein usage : **5 min ≈ 3 $/mois**, 10 min ≈ 6 $/mois, 13 min ≈ 7,80 $/mois (la moyenne réelle est plus basse — l'usage atteint rarement le plafond — mais elle se concentre sur les heavy users, qui sont aussi les meilleurs prospects Pro).

**La pub ne se paie toujours pas :** une vidéo récompensée rapporte ~0,005–0,02 $ ; les +3 min qu'elle débloque coûtent ~0,06 $ → elle ne récupère que **~15–30 %** des minutes offertes. Confirmé : la pub est un nudge / amortissement, pas un revenu. **Ne pas l'élargir.**

**La marge Pro est mince aussi :** 7,99 $ → ~5,59 $ net (commission 30 %). Un Pro à plein 60 min/jour coûterait bien plus qu'il ne paie — le **plafond Pro 60 min/jour est une protection de marge**, pas une limite de générosité, et le TTS pas cher par défaut est obligatoire.

### Implémentation (où ça vit)

- `apps/api/src/env.ts` — `FREE_TIER_VOICE_SECONDS_PER_DAY` 600→**300** ; nouveaux `FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON=600`, `FREE_HONEYMOON_DAYS=3`. (Le `canUseSeconds` mensuel est legacy/non appliqué — le plafond journalier fait foi.)
- `apps/api/src/lib/quota.ts` — `dailyCapSeconds()` lit maintenant `accountCreatedAt` et renvoie le plafond lune-de-miel dans la fenêtre, la base après. Date absente → base (défaut sûr).
- `apps/api/src/routes/voice.ts` — passe `profile.createdAt` au calcul du plafond à chaque garde (début de session, tours, extension pub).
- `apps/mobile/app/(modals)/daily-limit.tsx` — le mur met en avant l'**essai** (« Try Pro free — 60 min/day ») + une ligne de valeur framée sur la perte ; la pub reste secondaire.
- `apps/mobile/app/(modals)/paywall.tsx` — les CTA mettent « Start free trial » en avant ; le « vs 10 min » obsolète corrigé en « vs 5 min ».

### Ensuite (hors de ce lot)

Ajouter `coût par MAU gratuit` + `taux de démarrage d'essai au mur` au dashboard admin, puis A/B la lune de miel vs 5 min fixe dès que le volume le permet (skills : `analytics`, `ab-testing`).

---

_Généré à la demande de Bruno en complément du doc de stratégie Round 2. À mettre à jour si le prix, le plafond gratuit ou le modèle de coût des fournisseurs change._
