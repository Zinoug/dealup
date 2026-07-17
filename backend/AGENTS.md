# DealUp Backend Agent Instructions

Read `../AGENTS.md`, `../docs/product/product.md`, and `README.md` before editing.

## Folder Ownership

- `app/api/v1/`: FastAPI routes only.
- `app/schemas/`: Pydantic HTTP and result contracts.
- `app/services/`: use cases, authorization rules, quotas, and commits.
- `app/repositories/`: SQLAlchemy queries and `flush()` only.
- `app/models/`: SQLAlchemy mappings and persistence enums.
- `app/integrations/`: Clerk, Piloterr, RevenueCat, AWS, PostHog, and Sentry adapters.
- `app/db/`: engine and session lifecycle.
- `app/core/`: settings, JWT verification, errors, and cross-cutting infrastructure.
- `alembic/`: the only production schema evolution mechanism.

## Non-negotiable Rules

- Routes call services; routes do not call repositories directly for mutations.
- Repositories never commit or contain business decisions.
- Services commit once per local transaction boundary.
- External calls never happen inside an open DB transaction.
- Heavy Gemini analysis never runs in FastAPI.
- Piloterr identification runs in FastAPI because the teaser precedes the paywall.
- Device compatibility is decided during identification. Only iPhone 11+/SE 2/3 and MacBook Air/Pro M1+ can reach paywall or quota consumption.
- Public device rules, versions, and labels come from `../contracts/analysis/`; do not duplicate them in routes.
- The identification is private to its user and is not a shared cache.
- New and refreshed analyses reserve quota before Lambda dispatch.
- Reanalysis requires ownership plus a completed parent and consumes no quota.
- Every quota debit/reversal and top-up is an immutable `usage_events` ledger entry.
- All authenticated queries filter by internal `users.id`, not only Clerk ID.
- RevenueCat `app_user_id` is the Clerk user ID in V1.
- Webhook processing is defensive against unknown fields and duplicate delivery.
- API errors use stable uppercase business codes; do not expose provider exceptions.
- Persist the internal Gemini candidate separately from the public post-processed report.
- Reanalysis inherits every engine version from its parent; refresh captures current versions.
- Old schema `1.0` reports remain readable through a response adapter and are not rewritten in place.
- Analysis/account deletion includes all chain media and records a retryable deletion job before external S3 calls.

## Testing

- Override provider dependencies; never call Clerk, Piloterr, RevenueCat, S3, Lambda, or PostHog from tests.
- Test idempotency, ownership, subscription enforcement, quota order, failure reversals, and webhook duplicates.
- Test compatibility before quota, version pinning, lightweight history responses, legacy adaptation, and DB/S3 deletion ownership.
- Keep at least one OpenAPI generation test or check whenever route schemas change.
- Use PostgreSQL integration tests for locking or JSONB behavior when those paths change; SQLite alone is not proof of concurrency correctness.
