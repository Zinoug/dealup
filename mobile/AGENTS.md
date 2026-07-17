# DealUp Mobile Agent Instructions

Read `../AGENTS.md`, `README.md`, `../docs/product/product.md`, `../DESIGN.md`, and `assets/README.md` before changing the mobile app.

## Architecture

- Expo Router routes live in `src/app` and should compose components rather than own infrastructure code.
- Reusable UI lives in `src/components`; domain contracts in `src/types`; tokens in `src/theme`.
- HTTP and SDK calls belong in `src/services`. Screens never call `fetch` or vendor SDKs directly.
- Cross-screen flow state belongs in `src/store`; ephemeral input state stays local to its screen.
- Keep demo and live adapters behind the same typed contract. Demo mode must not make network requests.
- Preserve backend field semantics and map snake_case responses at the service boundary.

## Product rules

- The dominant path is onboarding → auth → URL/share → teaser → hard paywall → purchase mode → seller context → analysis → report → action/reanalysis.
- Account is required before any URL identification.
- No trial and no complete free analysis. The teaser cannot expose score, verdict, price estimate, risks, or seller messages.
- Weekly is 4.99 EUR / 15 analyses; Monthly is 12.99 EUR / 60; top-up is 10 / 4.99 EUR.
- Seller reanalysis is free; a full listing refresh consumes one unit.
- Compatible categories are iPhone 11+/SE 2/3 and MacBook Air/Pro M1+. Unsupported/unknown listings never show a paywall.
- Private seller text and images must never be reused for another user.
- DealUp is decision support, not certification. Never label a seller as a scammer without evidence.

## UI rules

- Design for iPhone first. Respect safe areas and 44 pt minimum touch targets.
- Use the system font, DealUp tokens, and French tutoiement.
- Do not add generic AI imagery, robots, purple gradients, nested cards, fake urgency, or casino mechanics around payment.
- Dopamine belongs to score/verdict/savings reveal, with restrained haptics and reduced-motion support.
- The main report is one scrollable screen. Its section registry supports `BUY`, `NEGOTIATE`, `VERIFY_FIRST`, and `PASS`; category differences belong in reusable blocks, not duplicated screens.
- Keep the hidden mock report lab usable for four verdicts × two device categories.
- Use `lucide-react-native` for interface icons, `react-native-svg` for dynamic data graphics, and `expo-image` for raster assets.
- New raster or motion asset requirements must be added to `assets/README.md` with path, format, dimensions, weight, timing, and fallback.

## Validation

- Never start a persistent Expo development server unless the user explicitly asks.
- Run `npm run lint` and `npm run typecheck` after code changes.
- `npx expo export --platform ios` is the network-free bundle check. Do not exercise the live API unless explicitly requested.
