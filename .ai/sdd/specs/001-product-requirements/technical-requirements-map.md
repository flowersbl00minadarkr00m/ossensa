# OSSensa User-to-Technical Requirements Map

> Status: Non-binding technical assessment
> SDD Gate: `requirements:draft`
> Evidence date: 2026-07-04

OSSensa has product notes but no application. Runtime capabilities are therefore
future state; only the product concept and integration decisions are current.

| User requirement | Technical requirement | State | Evidence / future work |
|---|---|---|---|
| Search by product, job, feature, and constraints | Typed query model with required, preferred, and disqualifying constraints | **Future** | Product seed exists; no app/schema |
| AI retrieves projects | Server orchestrator retrieves evidence before sending bounded context to OpenRouter | **Future** | Connector boundary decided; not built |
| Basic search without a key | Deterministic keyword/filter path over cached evidence | **Future** | Required for credential-free core |
| Public BYOK | Session-only input and request-scoped proxy; never persisted/logged | **Future** | Credential lane decided |
| Henry private OpenRouter | Protected Vercel instance and server-only `OPENROUTER_API_KEY` | **Future** | Credential lane decided |
| Gather credible evidence | Adapters for GitHub, official sites, releases, licenses, security sources, registries, curated lists | **Future** | Source breadth remains Q-002 |
| Explain coverage and gaps | Capability matcher with per-claim source IDs, confidence, and missing-evidence state | **Future** | No graph/matcher |
| Repository/release health | Normalized project snapshots with activity, cadence, archival status, and timestamps | **Future** | No ingestion pipeline |
| License implications | SPDX normalization, source evidence, legal-review boundary | **Future** | No license adapter |
| Security/maintenance evidence | Source-specific signals and freshness rules; no unsupported security score | **Future** | No evidence policy |
| Hosted/self-hosted complexity | Deployment-option records with prerequisites, skill, infrastructure, uncertainty | **Future** | No data model |
| Migration and total cost | Structured assumptions exported to LocalCFO | **Future** | Contract absent |
| Transparent ranking | Versioned factors, visible weights/penalties, deterministic re-ranking | **Future** | No ranking engine |
| Decision history | User-scoped searches, candidate snapshots, decisions, and evidence with RLS | **Future** | Existing Supabase serves shared-brain infrastructure; reuse needs explicit approval |
| Avoid duplicate research | Structured and semantic similarity over prior user work; never auto-merge | **Future** | No operational store |
| Track stale evidence | `retrieved_at`, refresh policies, invalidation reasons, refresh jobs | **Future** | No scheduler |
| Promote to SancusSight | Versioned idempotent `accepted-asset` handoff | **Future** | Boundary decided; schema absent |
| Track in Mnemosync | Versioned ticket request and returned project/ticket IDs | **Future** | Boundary decided; command absent |
| Let Flowsensa reference assets | Stable SancusSight asset ID in the decision result | **Future** | Schema absent |
| Save to Obsidian | Provenance-rich Markdown plus explicit download/local sync | **Future** | Export absent |
| Community corrections | Moderated claims, provenance, conflicts, review workflow | **Future** | Post-MVP |
| Public showcase | React/Vite synthetic showcase independently deployed to Vercel | **Future** | No OSSensa codebase |
| Editable requirement categories | Normalized constraint editor supports add, remove, edit, reclassify, validation, and deterministic rerun | **Future** | No application or query editor |
| Plain-language trade-off table | Candidate view-model separates lay summary, advantages, disadvantages, effort, evidence, and unknowns; mobile uses labeled cards | **Future** | No comparison UI |
| Responsive desktop/mobile UI | Breakpoint-specific navigation, wrapping, table-to-card transformation, and touch-safe controls | **Future** | No application or screenshot coverage |
| OpenRouter BYOK settings | Session-only masked key, test request, model selection, context review, and disconnect | **Future** | Credential lane decided; UI/proxy absent |

## Proposed architecture

```text
User or Flowsensa tooling requirement
  -> query/constraint normalization
  -> source adapters and evidence cache
  -> deterministic filtering
  -> optional OpenRouter interpretation
  -> transparent ranking and comparison
  -> user decision
       -> user-scoped decision history
       -> SancusSight accepted-asset handoff
       -> Mnemosync evaluation/implementation ticket
       -> Obsidian decision export
       -> LocalCFO cost request
```

## Recommended MVP slice

1. React/Vite public showcase on Vercel with synthetic examples.
2. Versioned query, evidence, candidate, ranking, and decision schemas.
3. GitHub plus official project/release/license adapters.
4. Supabase Auth and user-scoped decision history with RLS.
5. Deterministic filter/rank path.
6. Optional OpenRouter interpretation with public BYOK/private-key lanes.
7. Explicit SancusSight, Mnemosync, and Markdown handoffs.
