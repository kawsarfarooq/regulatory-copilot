# Security notes

## Implemented prototype controls

- Local-only service bindings for Outline, Dex, Mailpit, and vLLM.
- SSH forwarding for the model endpoint.
- Separate API keys for vLLM and Outline.
- Read-only MCP tools with no mutation capability.
- Runtime secrets excluded from Git.
- Evidence size limits to reduce accidental overexposure and context exhaustion.
- Explicit source and page-marker citations.

## Secret files that must never be committed

```text
server/.env
outline-runtime/.env
outline-runtime/docker.env
outline-runtime/dex-config.yaml
outline-runtime/local-admin-credentials.txt
outline-mcp/outline-token.txt
```

Before publishing, run the secret scan documented in `evaluation/README.md` and inspect `git diff --cached`.

## Production gaps

The local Dex/password flow and disabled HTTPS are suitable only for a local demonstration. A production deployment needs enterprise SSO, TLS, managed secrets, encrypted backups, audit retention, vulnerability management, rate limiting, monitoring, document approval workflows, and periodic access reviews.

Model output is not a regulatory decision. Human reviewers remain responsible for source interpretation and submission-specific applicability.
