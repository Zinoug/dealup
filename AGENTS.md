# DealUp Agent Instructions

## Source of Truth

DealUp is an iOS app for occasional French buyers evaluating supported second-hand iPhone and Apple Silicon MacBook listings from Leboncoin.

Read, in order:

1. this file;
2. the closest folder-level `AGENTS.md`;
3. `docs/product/product.md`;
4. the relevant project README.

Keep the monorepo simple: `mobile/`, `landing/`, `backend/`, `workers/`, and `docs/`. Do not add `apps/`, `packages/`, or `infra/` without an explicit architectural decision.

## V1 Product Invariants

- iOS and Leboncoin only.
- Supported devices are iPhone 11+, iPhone SE 2/3, and MacBook Air/Pro with Apple M1 or newer.
- Unsupported or unknown devices are rejected before paywall and quota reservation.
- Clerk account required before processing a link.
- Hard paywall with no free trial and no complete free analysis.
- Weekly: 4.99 EUR, 15 new analyses per week.
- Monthly: 12.99 EUR, 60 new analyses per month.
- Top-ups: 15 analyses for 4.99 EUR or 40 analyses for 9.99 EUR, reserved for active subscribers.
- Seller-context reanalysis is free for an already unlocked analysis.
- An explicit listing refresh consumes a new unit.
- RevenueCat is the billing authority. Never trust entitlement data from mobile.
- No public or cross-user listing cache. Never reuse payloads or results across users.
- A Piloterr identification may be persisted privately for the current user flow so the teaser and first paid analysis use the same extraction.
- Private seller messages, screenshots, photos, and derived results are never shared.

## Main Analysis Flow

1. FastAPI verifies Clerk and maps `clerk_user_id` to an internal `users.id`.
2. `POST /v1/listings/identify` calls Piloterr and stores a private identification.
3. FastAPI classifies the device; unsupported and unknown listings stop before paywall or quota.
4. `POST /v1/analyses` validates entitlement and reserves quota atomically.
5. FastAPI commits the job and ledger entry, then invokes Lambda asynchronously.
6. Lambda reserves the job idempotently.
7. Lambda uses the private Piloterr payload, or refetches it for an explicit refresh.
8. Lambda archives analyzed images privately, then calls Gemini exactly once.
9. Lambda parses the compact Gemini JSON, computes the deterministic public report, and persists both.
10. Provider failure reverses the quota debit exactly once.

Analysis states are exactly:

- `pending`
- `processing`
- `completed`
- `failed`

## Code Architecture

The backend and worker use explicit layers:

- `api` or `handler`: transport validation and response/status mapping only;
- `schemas`: public input and output contracts;
- `services`: use cases, business rules, and transaction boundaries;
- `repositories`: database reads and writes only;
- `models`: persistence mappings only;
- `integrations`: provider SDKs and HTTP clients only;
- `core`: configuration, security, logging, and shared errors.

Dependency direction is transport → service → repository/integration. Repositories and integrations must not import routes.

## Database and Transaction Rules

- Route handlers never contain SQLAlchemy queries or raw SQL.
- Repositories never call `commit()` or `rollback()`.
- Services own commits and rollbacks at use-case boundaries.
- Use `flush()` inside repositories only when an identifier is required before commit.
- Never keep a DB transaction open during Piloterr, Gemini, Clerk, RevenueCat, S3, PostHog, or Lambda calls.
- For job creation: transaction one stores job plus quota debit; external dispatch happens after commit; dispatch failure uses transaction two to fail the job and reverse the debit.
- Money is integer cents. Never persist money as float.
- Dates are UTC and timezone-aware at application boundaries.
- External webhook IDs and client `Idempotency-Key` values are unique idempotency boundaries.
- Schema changes require an Alembic migration. Never mutate production tables with startup `create_all`.
- PostgreSQL is production truth. SQLite is allowed only for lightweight local tests.

## API Conventions

- Business routes live under `/v1`; health endpoints remain `/health` and `/ready`.
- POST operations that can consume quota require `Idempotency-Key`.
- Errors use `{ "error": { "code", "message", "request_id", "details" } }`.
- API schemas are Pydantic models; never expose ORM objects or raw provider payloads.
- List endpoints are bounded and paginated.
- Authenticated resources must always be filtered by internal `user_id`.
- Do not expose Gemini sources, provider metadata, raw Piloterr payloads, seller identities, or private media URLs to mobile unless the product spec explicitly changes.
- `GET /v1/catalog/compatible-devices` is public; all user-owned analysis resources remain authenticated.

## Gemini Rules

- Model ID and thinking level are configuration. Engine metadata is stored for audit, while Git versions the implementation.
- The production model remains founder-selected through manual testing; do not hardcode product claims about model superiority.
- Use the Gemini Interactions API with Google Search. Ask for JSON only in the system instruction; do not send a `response_format.schema`.
- Keep `store=false` by default for private data.
- Full analysis is one coherent model call. Do not split price, score, risk, and verdict into independent calls that can disagree.
- Reanalysis sends the prior structured result plus only the new private context needed.
- Backend and worker own the small rules they need locally. Do not add a shared runtime `contracts/` loader or version numbers in filenames.
- Parse the compact candidate defensively, then compute score, verdict, price savings, action, checklist labels, and template deterministically.
- Gemini may write bounded personalized commentary but never invent business codes, UI ordering, or assets.
- Send only the common taxonomy and the detected category taxonomy.
- Unknown risk codes become `OTHER`, are capped at `MEDIUM`, and are measured.
- Reject sensitive-trait inferences. Missing evidence is `UNVERIFIED`, not an accusation.
- Do not claim authenticity, absence of theft, or risk-free purchase.

## Providers and Privacy

- Provider SDK usage belongs only in `integrations/`.
- Never log secrets, full listing payloads, full URLs, seller messages, or photos.
- PostHog uses internal `users.id` as the single distinct ID across mobile, API,
  and worker. Email and authentication provider are allowed only as person
  properties; events still receive coarse product metadata only.
- Sentry may receive stack traces, but explicit context must be sanitized.
- RevenueCat webhooks require authorization and optional HMAC verification, and must be idempotent by event ID.
- Use private object keys and presigned S3 operations for seller media.
- Copy analyzed listing photos into private S3 storage; never expose permanent S3 URLs.
- No automatic retention purge is active. Deleting an analysis or account must delete its private objects through an idempotent deletion job.

## Mobile and Landing

Mobile flow: auth → onboarding de valeur pour les nouveaux comptes → choix facultatif du rappel local quotidien → URL/share → compatibility → private Piloterr teaser → purchase mode → seller context → hard paywall when needed on the final launch action → analysis → report → reanalysis/history/profile.

The report is one scrollable screen with four deterministic section orders (`BUY`, `NEGOTIATE`, `VERIFY_FIRST`, `PASS`) and category-specific checklist content.

The landing only presents the app and sends users to the App Store. Do not add a web analyzer, waitlist, referral system, or unrelated SEO product without an explicit request.

## Validation

Before finishing:

- backend: migration import/startup, OpenAPI generation, and `pytest`;
- worker: import/compile and `pytest` with provider clients mocked;
- mobile: lint and typecheck when changed;
- landing: lint, typecheck, and build when changed.

Do not call paid APIs in automated tests.

## Browser and Visual QA

- Never open, control, or inspect the in-app browser, Chrome, Playwright, or any other browser for DealUp unless the founder explicitly requests browser use in the current message.
- Browser-based UI review and visual verification belong to the founder.
- For landing changes, stop after non-browser checks such as lint, typecheck, static build, generated-file inspection, and automated tests.
- Do not start a development server solely for visual inspection unless the founder explicitly asks for it.

## Founder-Owned Native Runtime

- Never run `expo run:ios`, `expo run:android`, `expo start`, Metro, Xcode builds,
  simulators, physical-device installs, CocoaPods commands, or any equivalent
  native runtime/build command unless the founder explicitly authorizes that
  exact action in the current message.
- Mobile verification by agents stops at non-runtime checks such as lint,
  TypeScript, configuration inspection, and static tests unless explicit
  authorization is given.
- Never leave an agent-started Metro, Expo, Xcode, simulator, or native build
  process running after a task.

## Git and Safety

- Preserve unrelated user changes and inspect `git status` before editing.
- Never add `.env`, credentials, provider payloads, or customer data.
- Do not commit unless the user asks.
- When commits are requested, prefer Conventional Commit scopes such as `feat(backend):`, `feat(worker):`, `fix(api):`, `test(backend):`, and `docs(product):`.
