# Le stack proposé, expliqué en français

**Date :** 2026-05-09
**Statut :** explication des choix techniques avant validation
**Public visé :** toi, qui veux comprendre ce que tu signes avant de t'engager

Ce document explique chaque outil que j'ai proposé, ce qu'il fait concrètement, ses alternatives, et pourquoi je l'ai choisi pour ton projet. Tu n'es pas obligé de tout retenir — c'est une référence à laquelle tu peux revenir.

---

## 1. Le serveur backend : **Hono**

### Ce que c'est

Hono est un _framework web_ en JavaScript/TypeScript. Un framework web, c'est ce qui te permet de dire "quand quelqu'un fait une requête HTTP à `/api/chat`, exécute ce code". L'équivalent dans la version legacy, c'était **Express** (`app.post("/api/chat", ...)` dans `index.js`).

Hono fait la même chose qu'Express, mais :

- **Beaucoup plus rapide** (3-5× selon les benchmarks) parce qu'il est conçu pour les runtimes modernes.
- **Excellent typage TypeScript** — il devine automatiquement le type des paramètres, des bodies de requête, etc. Express, lui, te demande de tout typer à la main.
- **Léger** — le coeur fait quelques kilo-octets, contre des centaines pour Express.
- **Portable** — le même code Hono tourne sur Node.js, Bun, Cloudflare Workers, Deno. Tu n'es pas marié à un seul environnement d'exécution.

### Alternatives que j'ai considérées

- **Express 5** — ce que tu utilises déjà. Mature, énorme communauté, mais l'API date de 2010 et la DX (developer experience) en TypeScript est médiocre. Aucune raison de le choisir en 2026 sur un projet neuf.
- **Fastify** — très rapide, populaire dans l'écosystème Node.js. Bon choix mais plus verbeux qu'Hono et moins portable.
- **NestJS** — framework "à la Java" avec décorateurs et injection de dépendances. Très structuré, parfait pour des équipes de 20 développeurs. Overkill pour un solo dev.
- **tRPC** (pas vraiment un framework web, mais souvent utilisé à la place) — permet d'appeler ton backend comme si c'était une fonction locale typée. Magique, mais te lock-in dans TypeScript des deux côtés et complique l'authentification.
- **Next.js API routes / Server Actions** — si tu avais une app web Next.js, ce serait naturel. Mais tu fais du mobile, donc pas de gain.

### Pourquoi Hono pour ce projet

Pour une API mobile en TypeScript, c'est le choix le plus simple, le plus rapide et le plus typé. Et si tu veux un jour migrer vers Cloudflare Workers (pour avoir un backend distribué dans le monde entier sans gérer de serveur), tu changes une ligne d'import — le code reste le même.

---

## 2. La plateforme "tout-en-un" : **Supabase**

### Ce que c'est

Supabase est un service hébergé qui te donne **trois choses au même endroit** :

1. **Une base de données Postgres** managée (ils s'occupent de la maintenance, des backups, des montées en charge).
2. **Un service d'authentification** complet — gestion des utilisateurs, Sign in with Apple, Google, email/mot de passe, magic link, oubli de mot de passe, vérification email, MFA. Tout est inclus.
3. **Du stockage de fichiers** (équivalent S3) pour stocker des images, des audios, n'importe quoi.

Le tout via un dashboard web, un SDK JavaScript unique, une seule facture, un seul endroit où gérer tes secrets.

### Alternatives que j'ai considérées

- **Firebase** (Google) — l'équivalent historique. Auth + Firestore (NoSQL) + Storage. Très bien fait, mais Firestore n'est pas une vraie base de données relationnelle, et tu te retrouves vite à dupliquer des données ou à faire des "fan-out writes" pour gérer les jointures. Pour des données comme `User → Conversations → Messages`, Postgres est nettement supérieur.
- **Clerk** (auth seul) + **Neon** (Postgres seul) — le combo "best of breed". Clerk est sans doute le meilleur service d'auth du marché : UX impeccable, SDKs excellents. Neon est un Postgres serverless très bien fait. Mais tu as deux services à gérer, deux factures, deux dashboards. Et Clerk devient cher au-dessus de 10 000 utilisateurs actifs (~0,02 $ par utilisateur / mois après).
- **Auth0** — un classique de l'auth en entreprise. Très puissant, mais tarification agressive (devient cher vite) et la DX a vieilli.
- **AWS Cognito + RDS Postgres** — la voie AWS. Possible mais pénible à configurer, Cognito a une UX médiocre, et tu paies les overheads AWS.
- **Pocketbase** (open source, self-hosted) — un Supabase miniature à héberger toi-même. Génial pour des side projects, mais auto-hébergé = tu deviens admin sys = pas pour toi pour un projet pro.
- **Coder ton propre auth** — non. C'est un nid à failles de sécurité. Ne fais jamais ça.

### Pourquoi Supabase pour ce projet

- **Postgres natif** : ton schéma (User, Conversation, Message, Subscription) est relationnel, Postgres est l'outil idéal.
- **Auth incluse** avec Sign in with Apple (obligatoire sur iOS si tu offres Google), Google, magic link — déjà tout là.
- **Tier gratuit généreux** : 500 Mo de DB, 50 000 utilisateurs actifs / mois. Tu ne paies qu'à 100+ utilisateurs payants.
- **Open source** : si Supabase ferme demain, tu prends ton schéma Postgres et tu le déplaces ailleurs. C'est juste du Postgres standard derrière.
- **Une seule SDK côté mobile** pour la plupart des opérations (`supabase.auth.signInWithApple()`, `supabase.from('conversations').select()`).

---

## 3. L'hébergement du backend Hono : **Fly.io**

### Ce que c'est

Fly.io héberge ton serveur Hono. C'est l'équivalent de **Render** (où ton ancien backend tourne aujourd'hui), mais :

- Moins de cold starts (avec un plan payant à 2-5 $/mois, ton serveur reste chaud en permanence).
- Distribué dans plusieurs régions du monde si besoin (latence réduite pour des utilisateurs à l'autre bout de la planète).
- Excellente CLI et déploiement très rapide.

### Alternatives que j'ai considérées

- **Render** — ce que tu utilisais. Marche bien, mais le tier gratuit cold-start (50s d'attente avant la première requête) ruine l'UX d'une app vocale. Tier payant (~7 $/mois) règle le problème mais Fly est moins cher pour la même chose.
- **Railway** — concurrent direct de Fly, très bonne DX, tarification claire. Choix tout à fait défensable. J'ai pris Fly par habitude et parce que leur free tier reste compétitif.
- **Vercel** — excellent pour des apps web Next.js, beaucoup moins adapté pour un backend HTTP custom comme Hono. Leur modèle serverless n'aime pas les connexions WebSocket / streaming longues.
- **AWS / GCP / Azure** — surdimensionné. Tu n'as pas besoin de Kubernetes pour faire tourner un Hono solo.
- **Cloudflare Workers** — tentant à cause du prix (gratuit pour des usages modestes) et de la distribution mondiale, mais limites strictes sur la durée des requêtes (incompatible avec du streaming voice long) et pas de file system local.

### Pourquoi Fly.io

Le rapport qualité-prix le meilleur pour un serveur Node/Bun classique avec du streaming. Et leur outil `fly.toml` rend le déploiement aussi simple qu'un `git push`.

---

## 4. La base de données : **Postgres + Drizzle**

### Postgres

C'est la base de données relationnelle open source la plus respectée du monde. C'est ce qui remplace **MongoDB** (que tu utilisais avant). Différences :

- **Relationnel** : tu déclares un schéma fixe (`users` a une colonne `email`, `conversations` a une colonne `user_id` qui référence `users.id`). Tu peux faire des jointures rapides.
- **Solide** : transactions ACID, backups, réplication, depuis 25 ans. C'est le choix par défaut pour une app sérieuse en 2026.
- **Vs MongoDB** : MongoDB est utile quand tu as des données très hétérogènes ou peu structurées. Pour ton modèle (User, Conversation, Message — tous bien structurés), Postgres est nettement supérieur.

### Drizzle

Un **ORM** (Object Relational Mapper) — un outil qui te permet d'écrire ta DB en TypeScript au lieu d'écrire du SQL brut. Exemple :

```ts
// avec Drizzle
const user = await db.select().from(users).where(eq(users.id, 1));

// au lieu de SQL brut
const result = await pg.query("SELECT * FROM users WHERE id = $1", [1]);
```

### Alternatives à Drizzle

- **Prisma** — l'ORM le plus populaire en TypeScript. Excellente DX, mais lourd (un client généré de plusieurs Mo), et historiquement lent. Bon choix sinon.
- **TypeORM** — plus ancien, "à la Java". Eviter en 2026.
- **Mongoose** — pour MongoDB seulement. Tu connais.
- **Kysely** — un query builder typé, pas un ORM complet. Très propre mais plus verbeux que Drizzle.
- **SQL brut** — toujours possible et parfois préférable, mais tu perds le typage.

### Pourquoi Drizzle

Léger, ultra typé, génère le SQL le plus propre possible (proche du SQL brut), excellente intégration avec Postgres et Supabase. C'est le challenger qui a dépassé Prisma sur la DX en 2024-2025.

---

## 5. Les fournisseurs de voix

Trois services tiers que ton backend Hono va appeler pour la boucle vocale :

### Deepgram (Speech-to-Text — l'utilisateur parle, ça transcrit)

- **Alternative** : Whisper d'OpenAI (ce que tu utilisais). Moins cher (~0,006 $/min vs 0,0043 $/min pour Deepgram), mais pas de streaming en temps réel. Pour notre boucle streaming, Deepgram est meilleur.
- **Alternative** : AssemblyAI Universal-2. Très bon. Choix défensable.
- **Alternative** : Google Cloud Speech-to-Text. Plus cher, qualité comparable.

### OpenAI GPT-4o-mini (le cerveau — génère la réponse du coach)

- **Alternative** : GPT-4o "complet" — meilleur mais 10× plus cher. Pas nécessaire pour de la conversation conversationnelle simple.
- **Alternative** : Claude Haiku 4.5 (Anthropic) — très bon, prix similaire à GPT-4o-mini. Bon plan B.
- **Alternative** : Gemini Flash (Google) — moins cher mais qualité conversationnelle inférieure pour le multilingue.

### ElevenLabs Flash v2.5 (Text-to-Speech — le coach parle)

- **Alternative** : OpenAI TTS — bon rapport qualité-prix, voix moins naturelles qu'ElevenLabs.
- **Alternative** : Cartesia Sonic — très naturel, latence ultra basse. Concurrent direct d'ElevenLabs. Choix défensable.
- **Alternative** : Google Cloud TTS (ce que tu utilisais avant) — robotique. À éviter.

### Pourquoi ces trois-là

C'est le combo "premium accessible" en 2026 : meilleure qualité que Google/AWS, moins cher qu'OpenAI Realtime API, supporte tous les 12+ langages que tu veux offrir, latence en streaming maîtrisée. Si l'un d'eux fait défaut ou augmente ses prix, on peut en changer sans toucher au reste de l'archi (c'est pour ça qu'on les met derrière le backend Hono, pas en direct depuis l'app).

---

## 6. Côté mobile (l'app React Native / Expo)

### Expo Router

Le système de navigation. Au lieu de configurer manuellement chaque écran (`<Stack.Screen name="Welcome" component={WelcomeScreen} />` comme dans ton legacy), tu crées un fichier `app/welcome.tsx` et la route est créée automatiquement. Plus simple, plus prévisible.

**Alternative** : `@react-navigation/native` (ce que tu utilises). Marche, mais Expo Router est devenu le standard de fait depuis 2024.

### TanStack Query

Gère **toute** ta communication serveur — cache, retry automatique, rafraîchissement, etc. Au lieu de faire `axios.get(...)` partout dans tes composants comme dans le legacy (où chaque écran refait `fetchUserData(deviceId)` en boucle), tu déclares une fois "voici la requête `useUser()`" et tous les écrans qui l'utilisent partagent le même cache.

C'est ce qui résout le problème **I7 et I8 de l'audit** (clobbering de l'état).

**Alternative** : Apollo Client (si tu utilises GraphQL — pas le cas), SWR (concurrent direct, plus minimaliste). TanStack Query domine la catégorie depuis 2022.

### Zustand

Pour le state local de l'app (qui n'est pas du serveur). Genre "l'utilisateur est-il en train d'enregistrer", "quel onglet est actif". Remplace ton `UserContext` actuel.

**Alternative** : Redux (overkill, verbeux), Jotai (concurrent direct, plus orienté "atomes"), React Context seul (ce que tu fais — limite de scalabilité). Zustand est le meilleur compromis simplicité / puissance.

### NativeWind

Le styling. Au lieu d'écrire :

```tsx
const styles = StyleSheet.create({ button: { padding: 12, borderRadius: 8, backgroundColor: 'blue' } });
<View style={styles.button}>
```

Tu écris :

```tsx
<View className="p-3 rounded-lg bg-blue-500">
```

C'est **Tailwind CSS pour React Native**. Beaucoup plus rapide à itérer.

**Alternative** : `StyleSheet.create` (ce que tu utilises), Tamagui (très puissant, plus lourd), Restyle (Shopify, plus rigide). NativeWind est le sweet spot.

---

## 7. Qualité et observabilité

### Sentry

Quand l'app crash en production, Sentry capture la stack trace et te l'envoie. Sans Sentry, tu apprends les bugs uniquement quand un utilisateur t'écrit (et la plupart ne le font pas, ils désinstallent). Avec Sentry, tu vois "il y a eu 47 crashs hier sur iPhone 14, voilà la trace exacte".

**Alternative** : Bugsnag, Crashlytics (Firebase), Rollbar. Sentry domine, plan gratuit suffisant pour démarrer.

### PostHog

Analytics produit. "Combien d'utilisateurs ont fait leur première session vocale cette semaine ? Quel est le taux de conversion entre l'onboarding et la première conversation ?". Ce sont des questions qu'un fondateur d'app freemium **doit** pouvoir répondre.

**Alternative** : Amplitude, Mixpanel (plus chers), Google Analytics (médiocre pour mobile). PostHog a l'avantage d'être open source et auto-hébergeable si jamais.

### Vitest

Le framework de tests unitaires. Tu écris du code comme :

```ts
test("computes streak correctly", () => {
  expect(computeStreak("2026-05-08", "2026-05-09")).toBe(2);
});
```

Et CI les exécute à chaque PR.

**Alternative** : Jest (ce qu'utilisait React Native historiquement). Vitest est plus rapide, mieux typé, compatible Jest.

### Maestro

Tests "end-to-end" pour mobile — un robot ouvre l'app, clique sur les boutons, vérifie que ça marche.

```yaml
- launchApp
- tapOn: "Start Practicing"
- tapOn: "Mic Button"
- assertVisible: "Recording..."
```

**Alternative** : Detox (plus puissant, beaucoup plus pénible à maintenir). Maestro est l'option moderne et lisible.

---

## 8. Outils de monorepo

### pnpm

Un gestionnaire de packages, alternative à `npm` et `yarn`. Trois fois plus rapide, économise de l'espace disque (au lieu de copier `react` dans chaque projet, il met un seul exemplaire et fait des liens symboliques), excellente gestion des workspaces (plusieurs projets dans un seul repo).

### Turborepo

Quand tu as plusieurs projets dans un monorepo (`apps/mobile`, `apps/api`, `packages/shared`), Turborepo orchestre les builds. Si tu modifies seulement `apps/mobile`, il sait qu'il n'a pas besoin de rebuilder `apps/api`. Cache intelligent, parallélisation automatique.

**Alternative** : Nx (plus puissant, plus complexe, oriente "entreprise"), Lerna (déprécié), Bazel (overkill pour 99 % des cas). Turborepo est le sweet spot.

---

## Résumé : pourquoi ce stack pour ton projet

Tu as trois contraintes que tu m'as données :

1. **Simple et léger** → choix consolidés (Supabase pour 3 services, pnpm/Turbo qui restent invisibles, Hono minimal).
2. **Entièrement testé** → Vitest pour les tests unitaires, Maestro pour les E2E, chaque morceau de l'archi est testable en isolation.
3. **Niveau professionnel** → Sentry + PostHog dès le jour 1, monorepo typé de bout en bout, vrais auth, gestion des secrets propre, CI/CD.

Et deux contraintes liées au business :

4. **Freemium** → Supabase gère naturellement les comptes, Postgres permet de stocker les abonnements proprement, le backend Hono peut faire tourner les compteurs d'usage (minutes vocales par jour, etc.).
5. **Solo dev** → moins de fournisseurs à gérer (Supabase + Fly + les 3 fournisseurs voix + Sentry + PostHog = 7 services au total, pas 15). Une seule langue (TypeScript) du mobile au backend.

Tu peux modifier n'importe quel élément de cette liste — rien n'est gravé dans le marbre. Mais c'est l'architecture qui me semble offrir le meilleur ratio "rapide à construire" / "facile à maintenir" / "scalable si l'app décolle" pour un dev seul en 2026.

---

## Annexe — qu'est-ce que l'« ephemeral key minting » ?

### Le problème

Quand ton app mobile veut parler à OpenAI, Deepgram ou ElevenLabs, il faut prouver que tu es bien le client autorisé. Ces services s'authentifient avec une **clé API** — un long secret comme `sk-proj-abc123...`.

Tu **ne peux pas** mettre cette clé dans le code de ton app. Pourquoi ? Parce que :

1. Le code d'une app mobile peut être **extrait** par n'importe qui (un APK Android se décompresse en quelques secondes, un IPA iOS de même).
2. Une fois la clé extraite, l'attaquant peut faire des appels OpenAI avec **ton crédit** jusqu'à ce que tu t'en rendes compte (et c'est exactement le risque **C2** dans l'audit du legacy).
3. Tu ne peux pas révoquer une clé sans casser tous les utilisateurs qui ont déjà l'app installée.

C'est le **problème de la clé API longue durée sur un appareil non-fiable**.

### Approche n°1 : tout passer par ton backend (ce que je propose pour le MVP)

L'app mobile **n'a aucune clé d'API tierce**. Quand l'utilisateur enregistre sa voix, l'app envoie l'audio à **ton** backend Hono. Ton backend a la vraie clé OpenAI (stockée dans ses variables d'environnement, jamais exposée). Ton backend appelle Deepgram/OpenAI/ElevenLabs en utilisant cette clé, traite la réponse, renvoie le résultat à l'app.

Avantages :

- Une seule clé à protéger, sur ton serveur uniquement.
- Tu peux logger chaque appel, mesurer les coûts par utilisateur, appliquer des limites (« utilisateur gratuit = 10 minutes / jour »).
- Si OpenAI change son API, tu modifies ton backend, pas l'app (pas besoin de re-publier sur les stores).

Inconvénient :

- Tout l'audio passe par ton serveur. Pour de la voix en streaming, c'est de la bande passante non-négligeable. Pour le pipeline streaming (Deepgram + GPT-4o-mini + ElevenLabs), c'est gérable (~50-100 Ko/s par session active).

**C'est l'approche par défaut pour le MVP.**

### Approche n°2 : « ephemeral key minting » (pour OpenAI Realtime API plus tard)

L'API « Realtime » d'OpenAI (option 2 du document `voice-loop-options.md`, réservée pour le tier payant) fonctionne différemment : l'app doit ouvrir une **connexion WebRTC directe** à OpenAI. Le serveur OpenAI parle directement à l'app, pas via ton backend. C'est ce qui permet la latence sub-500ms.

Mais on a toujours le même problème : l'app n'a pas le droit d'avoir la clé OpenAI longue durée.

La solution est l'**ephemeral key minting** — littéralement « la frappe d'une clé éphémère ». Ça marche en 4 étapes :

1. **L'app demande une session.** Elle appelle ton backend Hono : `POST /api/voice/start-session`. Ton backend vérifie que l'utilisateur est connecté (token Supabase Auth) et qu'il a le droit de démarrer une session vocale (a-t-il un abonnement payant ? est-il dans son quota ?).

2. **Le backend frappe la clé éphémère.** Ton backend appelle OpenAI avec sa vraie clé : `POST https://api.openai.com/v1/realtime/sessions`. OpenAI répond avec un **token temporaire** (`client_secret`) qui :
   - Ne fonctionne que pour **une seule session vocale**.
   - Expire au bout de **~1 minute** d'inactivité.
   - N'a accès qu'aux endpoints Realtime, rien d'autre (pas d'accès au reste de ton compte OpenAI).

3. **Le backend renvoie cette clé éphémère à l'app.** L'app la reçoit comme un simple JSON.

4. **L'app utilise la clé éphémère pour ouvrir la connexion WebRTC** directement avec OpenAI. La clé éphémère meurt naturellement quelques secondes après que la session se termine.

### Pourquoi c'est sûr

- Si quelqu'un intercepte une clé éphémère (man-in-the-middle), elle est inutilisable au bout d'une minute.
- Si quelqu'un décompile l'app, il ne trouvera **aucune** clé OpenAI — uniquement l'URL de ton backend.
- Si un utilisateur abuse, tu vois passer ses requêtes via ton backend (étape 1) et tu peux le bloquer.
- La vraie clé OpenAI (longue durée, dangereuse) ne quitte **jamais** ton serveur Hono.

### Analogie

C'est comme un **badge d'accès temporaire à un bâtiment**. Le concierge (ton backend) a la **clé maître** (l'API key OpenAI). Quand tu arrives, il vérifie ton identité (auth Supabase), puis te donne un **badge magnétique** (la clé éphémère) qui ne marche que pour ton étage et seulement pour les 30 prochaines minutes. Tu peux entrer et sortir librement avec le badge, mais tu n'as jamais accès à la clé maître. À la fin de la journée, le badge ne fonctionne plus.

### Résumé pour notre projet

- **MVP (option 1, pipeline streaming)** : pas besoin d'ephemeral keys. Ton backend Hono fait office de proxy, l'app n'a aucune clé tierce.
- **Tier payant futur (option 2, Realtime API)** : ton backend Hono ajoute un endpoint `/api/voice/start-realtime-session` qui frappe une clé éphémère OpenAI et la renvoie à l'app, qui ouvre la connexion WebRTC directement avec OpenAI.

Dans les deux cas, ta vraie clé OpenAI vit uniquement dans les variables d'environnement de ton backend Fly.io. Elle ne quitte jamais ce serveur.
