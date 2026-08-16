# Local Bauwerksbuch fixtures

Place the five provided Bauwerksbuch PDFs in this directory. PDF contents are
intentionally ignored by Git; the application contains no hard-coded fixture
facts.

Run the deterministic, filename-ordered workflow from the repository root:

```sh
pnpm fixtures:ingest
```

Use `--json` for machine-readable output. A normal rerun skips documents whose
checksum already has a successful extraction. Use `--reextract` only when a new
model or prompt version should be applied; lineage and review protections still
apply.
