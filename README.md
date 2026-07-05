# OSSensa

Open-source software discovery and evaluation tool. Describe what you need in plain language — OSSensa extracts constraints, finds matches, and produces plain-language comparisons accessible to both developers and non-technical stakeholders.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e tests |
| `npm run preview` | Preview production build |

## Demo mode

Toggle "Demo mode" on the search screen to use synthetic candidates without any API calls. Useful for development and demonstrations.

## OpenRouter BYOK

Go to Settings → OpenRouter to connect your own API key. The key is stored in session memory only — never persisted to disk, localStorage, or logs.

## Environment

No environment variables required for demo mode.

For live GitHub API calls (higher rate limits), you can optionally provide a `VITE_GITHUB_TOKEN` — but this is not required for the prototype.

## Architecture

See `.ai/sdd/specs/001-product-requirements/` for full design and requirements documentation.

```
src/
  domain/     ← types, search, comparison, history, import
  components/ ← React UI components
  lib/        ← adapters, orchestrator, utilities
  styles/     ← design tokens, layout, components
  fixtures/   ← synthetic demo data
```
