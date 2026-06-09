# Travail restant — état au 2026-06-09

> Établi en croisant l'historique git (`main`), le code réel et les plans dans `docs/superpowers/plans/`.
> **Note :** `CLAUDE.md` est très en retard — il dit « Plan 8 pending » alors que l'essentiel du Plan 8 (paywall RevenueCat, push, mémoire coach, feedback de fin de session, scénarios, account deletion) est déjà construit. À mettre à jour.

## Déjà livré depuis la dernière maj de CLAUDE.md

- Plan 8 coaching loop : paywall (`use-purchases.ts`), push tokens + `push_schedule`, mémoire coach, feedback de fin de session, scénarios de jeu de rôle.
- Auth social + reset password, universal links, **account deletion** (conformité Play).
- Flashcards de vocabulaire (jeu complet : flip, prononciation, étoiles, célébration).
- Voix ElevenLabs natives par langue ; Voice Lab → réglage « Coach's voice » public.
- 3 langues CJK ajoutées (ja/zh/ko → 15 langues).
- Fix TTS Gemini résolu : modèle GA `gemini-2.5-flash-tts` (le `TTS-FIX-HANDOFF.md` est obsolète, à supprimer).
- Site marketing (apps/web) : hero, branding Lisa, SEO, sections flashcards/voix, 15 langues.

---

## Ce qui reste à faire

### A. Mode voix temps réel (le plus gros chantier en cours)

- [ ] **Voice-live** (`/v1/voice/live` + Deepgram streaming) : construit mais derrière `VOICE_LIVE_USER_IDS`, half-duplex, encore en stabilisation. → finir et ouvrir au-delà de l'allowlist.
- [ ] **Speech-to-speech** : pas construit (voir `docs/voice-modes.md`). Horizon 2 de l'optim latence.
- [ ] Décision module audio temps réel : voir `docs/research/2026-06-06-realtime-audio-module-alternatives.md`.

### B. Follow-ups Plan 7 différés

- [ ] **Upload d'avatar** sur le Profil — confirmé non fait (pas d'ImagePicker/avatar_url côté mobile).
- [ ] **Catalogue de citations 50 → 200** — toujours à 50 (× 15 langues = lourd à traduire).
- [ ] **Migration SecureStore** pour les tokens auth Supabase — faille signalée par `mobile_audit.py`.
- [ ] Variante Sunrise dark-mode — _abandonnée_ (Sunrise = jour seulement). Pour mémoire.

### C. Features planifiées mais pas codées

- [ ] **i18n de l'UI de l'app** dans les 12-15 langues + sélecteur de langue dans Profil — non démarré.
- [ ] **Mémoire coach cross-session (pro)** — design choisi, mais **4 décisions ouvertes** à trancher avant de coder.
- [ ] **Audio utilisateur stocké avec consentement** pour revue de prononciation (Plan 8 ideas bucket).

### D. Monétisation

- [ ] **Décision du cap gratuit** (modèle « tripod » : caps + rewarded ads + abos) — décision ouverte avant de figer le freemium. Voir `brainstorming/2026-06-04-monetization-and-ad-revenue.md`.

### E. Release / ops

- [ ] **Confirmer l'état de la release Play Store prod** (l'historique montre versionCode 72 / iOS build 33 + soumissions TestFlight en cours — vérifier qu'un build prod est bien publié).
- [ ] **Admin dashboard** : bug 500 ouvert (écriture cookie en server-component) — voir snapshot mémoire `project_admin_dashboard_deploy_state`.

### F. Hygiène legacy (rappel récurrent)

- [ ] **Rotation des clés API legacy** (OpenAI + Google TTS encore dans l'env Render) — seule vraie « hot liability » de la stack legacy.
- [ ] **Risque de fermeture du compte dev Google Play legacy au 2026-07-04** — agir avant.

### G. Housekeeping repo

- [ ] Nombreux fichiers non commités sur `main` (`.claude/`, `.agents/skills/`, `docs/research/`, `docs/superpowers/brainstorming/`, `TTS-FIX-HANDOFF.md`, `skills-lock.json`, `.vercel/`, `.playwright-mcp/`) — décider quoi committer vs `.gitignore`.
- [ ] Mettre à jour `CLAUDE.md` (statut Plan 8, plans livrés, fix TTS).
