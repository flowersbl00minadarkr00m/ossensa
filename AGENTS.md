# Agent Instructions — OSSensa

See `.ai/` for SDD documentation.

- Product baseline: `.ai/sdd/specs/001-product-requirements/`
- Web-wide discovery: `.ai/sdd/specs/002-web-discovery/` (requirements, design, tasks)

## Key conventions

- No Tailwind — plain CSS with design tokens from `src/styles/tokens.css`
- Result cap of 5 is enforced in `src/domain/search.ts`, not the UI
- OpenRouter key lives in React state only — never log, store, or export it
- All components must work at 375px without horizontal overflow
- Discovery lives in `src/lib/discovery/` — adapters are isolated; one source
  failure must never reject a search (coverage reports it instead)
- Licence classification only via `classifyLicense` in `src/lib/spdxAdapter.ts`,
  driven by SPDX metadata or retrieved licence text — never snippets or AI
- Every new `EvidenceItem` must carry `sourceType` provenance
- `api/fetch.ts` must keep its SSRF guards (`src/lib/discovery/urlGuard.ts`);
  any change there requires the urlGuard unit tests to pass
- Demo data must never silently replace a failed live search
