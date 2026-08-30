# experiments/ — Reproducibility Package (§13.7)

Versioned artifacts produced by the evaluation scripts. Every folder is
self-describing and can be regenerated with a one-line command — that is what
makes the §13.2/13.3/13.4 results reproducible.

```
experiments/
├── dataset/          npm run export:dataset     — anonymized snapshot {books, interactions, splitDateMs}
├── <run-id>/         npm run eval:recommendations — config.json, results.csv, results.json, report.md (+SVG)
├── ab/               npm run eval:ab            — AB report from stored events
├── llm/              npm run eval:llm           — Groq vs Gemini comparison
└── benchmark/        npm run bench:vector | bench:query-plans — latency + explain("executionStats")
```

## Guaranteeing reproducibility

1. **The dataset is versioned.** `exportDataset.ts` writes an anonymized
   snapshot (`u1, u2, …` for users, no PII) with the train/test split marker
   baked in (`splitDateMs`). Re-runs never silently change the split.
2. **`--snapshot` mode.** `npm run eval:recommendations -- --snapshot
   experiments/dataset/<file>.json` reproduces a run *exactly* from the
   snapshot — no DB, no credentials, no network.
3. **Every run records its inputs.** `config.json` stores the strategy set,
   K, split date, user limit, seed, and the snapshot path/sha used.
4. **Seeded RNG** (`createRng`) so Random-baseline and any tie-breaks are
   stable across runs.

## What to commit

Commit snapshots and the *final* evaluation reports; treat intermediate run
folders as disposable. If a new snapshot is produced after the thesis is
submitted, the versioned split marker keeps old conclusions auditable.