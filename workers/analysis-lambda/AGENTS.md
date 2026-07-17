# DealUp Analysis Lambda Agent Instructions

Read `../../AGENTS.md`, `../../docs/product/product.md`, and `README.md` before editing.

## Worker Contract

The Lambda receives only:

```json
{ "analysis_id": "uuid" }
```

It must:

1. reserve `pending`, or reclaim `processing` after the lease timeout;
2. ignore completed, failed, or actively processing duplicates;
3. load the private analysis input;
4. call Piloterr only when the stored private payload is absent, notably refresh;
5. archive at most 10 listing photos and accept at most 10 seller media in private S3;
6. call Gemini exactly once with text, relevant images, Google Search, and `GeminiCandidateV2` structured output;
7. reject sensitive inferences and post-process score, caps, verdict, pricing, action, checklist labels, and template deterministically;
8. validate and persist the internal candidate separately from `PublicReportV2`;
9. fail safely and reverse the quota debit exactly once;
10. notify only after successful persistence and only when the configured duration threshold is crossed.

## Boundaries

- `handler.py` validates transport and wires dependencies only.
- `services/` orchestrates the use case.
- `repositories/` contains PostgreSQL statements and transaction boundaries.
- `integrations/` contains Piloterr, Gemini, S3, Expo Push, and PostHog.
- `schemas/` owns the exact Gemini candidate and public result contracts.
- `../../contracts/analysis/` owns prompts, taxonomies, scoring, checklists, catalog, and version manifest.

Gemini receives only the common and detected-category taxonomies. It may produce bounded personalized text, but it never controls codes, final score/verdict, computed amounts, section order, assets, or checklist wording. Unknown codes become a measured `OTHER` capped at `MEDIUM`.

Never log raw inputs, prompts, seller context, image URLs, API keys, or model output. Never keep a DB transaction open during a provider call. Never use Gemini server-side conversation storage unless the privacy decision changes explicitly.

Provider failures must be converted to stable internal codes. Push and analytics failures never change an already completed analysis.

Tests use fakes and must never consume Piloterr or Gemini credits. Keep contract fixtures for four templates across both supported categories and assert one Gemini invocation.
