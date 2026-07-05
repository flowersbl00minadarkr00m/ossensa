# Agent Instructions — OSSensa

See `.ai/` for SDD documentation.

- Requirements: `.ai/sdd/specs/001-product-requirements/requirements.md`
- Design: `.ai/sdd/specs/001-product-requirements/design.md`
- Tasks: `.ai/sdd/specs/001-product-requirements/tasks.md`

## Key conventions

- No Tailwind — plain CSS with design tokens from `src/styles/tokens.css`
- Result cap of 5 is enforced in `src/domain/search.ts`, not the UI
- OpenRouter key lives in React state only — never log, store, or export it
- All components must work at 375px without horizontal overflow
