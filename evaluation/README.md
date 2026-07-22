# Evaluation

Set `OUTLINE_TOKEN_FILE` if the token is not stored at `outline-mcp/outline-token.txt`, then run:

```powershell
$env:OUTLINE_TOKEN_FILE = "C:\secure\path\outline-token.txt"
node .\evaluation\run-retrieval-eval.mjs
```

The script checks source selection, page-marker retrieval, table-of-contents exclusion, and the evidence character limit. Results are written to `evaluation/results/latest.json` and `latest.md`.

Before publishing, run a secret scan from the repository root:

```powershell
rg -n --hidden --glob '!evaluation/results/**' `
  'ol_api_|VLLM_API_KEY\s*=|SECRET_KEY\s*=|POSTGRES_PASSWORD\s*=|apiKey:\s*"(?!REPLACE_)'
```

Also inspect:

```powershell
git status --short
git diff --cached
```
