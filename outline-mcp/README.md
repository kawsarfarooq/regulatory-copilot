# Read-only Outline MCP adapter

This zero-dependency Node.js adapter exposes two compact MCP tools:

- `outline_research`: searches Outline, opens the best matching document, skips table-of-contents passages, and returns focused evidence with nearby PDF page markers.
- `outline_list_sources`: lists available collections and document titles without loading document bodies.

There are deliberately no create, update, publish, archive, or delete tools.

## Requirements

- Node.js 18 or newer
- Outline reachable at `http://127.0.0.1:3000`
- An Outline API token with global `read` scope, or these endpoint scopes:

```text
auth.info
collections.list
documents.list
documents.search
documents.info
```

## Configure

From PowerShell:

```powershell
cd outline-mcp
.\Set-OutlineToken.ps1
node .\outline_mcp_server.mjs --check
```

The generated `outline-token.txt` is ignored by Git. Never share it.

Add the `mcpServers` block from `continue/config.yaml.example` to Continue's Main Config, use an absolute path to this script, reload VS Code, and select Agent mode.

## Test prompt

```text
Call outline_research exactly once with query "Software Requirements
Specification" and max_chars 3500. Answer only from the returned evidence
and cite its title and PDF page marker.
```
