# §13.6 — System Documentation

This directory is the formal documentation appendix for the M.Tech evaluation
layer. Each file maps to a §13.6 deliverable:

| File | §13.6 deliverable |
|---|---|
| `architecture.md` | System architecture (components, data flow, deployment) |
| `er-diagram.md` | Entity–relationship diagram of the domain model |
| `sequence-diagrams.md` | Sequence diagrams for the highest-value flows |
| `design-decisions.md` | Design-decision log (why, not just what) |
| `complexity.md` | Complexity analysis of the algorithms |
| `owasp-checklist.md` | §13.5.1 OWASP Top 10 self-assessment |
| `dependency-audit.md` | §13.5.2 `npm audit` output + remediation |
| `contribution-statement.md` | §13.1 statement of the research contribution |

## How to regenerate the evaluation artifacts

All scripts are reproducible and self-documenting (see `experiments/README.md`):

```bash
cd lookbook-backend
npm run export:dataset        # anonymized snapshot → experiments/dataset/
npm run eval:recommendations  # §13.2 offline evaluation → experiments/<run-id>/
npm run eval:ab               # §13.3 AB report from stored events
npm run eval:llm              # §13.9 Groq vs Gemini comparison
npm run bench:vector          # §13.4.3 vector-search latency
npm run bench:query-plans     # §13.4.2 MongoDB explain("executionStats")
```

Load tests live in `benchmarks/k6/` (see its README for §13.4.1 runs).