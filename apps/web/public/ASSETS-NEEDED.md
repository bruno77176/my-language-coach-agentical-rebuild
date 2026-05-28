# Marketing assets needed before launch

These files are referenced by the landing page but were not captured during initial implementation (Task 17 in the plan). The site builds and renders without them — they will 404 at runtime — but the hero will look broken until they land.

## Phone screenshots — 3 PNGs

Capture from the production mobile build (Android dev build is already on Bruno's device):

| File | Source screen |
| ---- | ------------- |
| `public/screens/home.png`     | Home tab |
| `public/screens/practice.png` | Practice tab mid-conversation |
| `public/screens/progress.png` | Progress tab showing streak data |

Native device resolution is fine — `next/image` will resize.

## Character — 1 PNG

`public/character.png`

Source: `apps/mobile/assets/avatar.json` (Lottie). Either crop from Bruno's existing marketing image, render a Lottie frame via lottiefiles.com, or use `puppeteer-lottie-cli`. Target ~240×240 with transparent background.

## OG image — 1 PNG (1200×630)

`public/og-image.png`

Used by Open Graph + Twitter card metadata. PNG ≤ 1 MB. Either crop Bruno's existing marketing image to 1200×630 or assemble fresh in Figma.

## Favicon — replace placeholder

`public/favicon.ico` is currently a renamed copy of `apps/mobile/assets/icon.png`. Most browsers accept a PNG with `.ico` extension, but a real multi-resolution `.ico` is cleaner. Generate via [realfavicongenerator.net](https://realfavicongenerator.net/) from `apps/mobile/assets/icon.png`.
