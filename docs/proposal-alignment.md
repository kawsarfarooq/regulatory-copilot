# Proposal alignment

## Directly implemented proposal elements

| Proposed element | Prototype implementation |
| --- | --- |
| Developer assistant inside VS Code | Continue.dev extension |
| Open, privately hosted language model | Qwen2.5-Coder 14B AWQ |
| Model serving on available GPU infrastructure | vLLM on the private RTX 4090 server |
| Shared knowledge base on standard server resources | Outline with PostgreSQL and Redis |
| Knowledge access through MCP | Read-only Outline MCP adapter |
| Grounded domain responses | Search plus focused document retrieval with source and PDF page marker |
| Controlled access to internal knowledge | Authenticated Outline API token and no public sharing |

## Implementation choices not mandated by the proposal

- **Qwen2.5-Coder 14B AWQ and vLLM** were selected as practical open-model serving choices. They were not prescribed by the proposal.
- **FDA public guidance documents** were used because private company documents were not supplied. The ingestion and retrieval flow is designed so an authorized organization can replace them with approved internal material.
- **Local Docker Desktop for Outline** was used because the managed GPU server did not expose a Docker daemon. This keeps the proposed component boundary while respecting infrastructure constraints.
- **A small custom read-only MCP adapter** was used because the deployed Outline 1.1.0 image did not expose the newer native `/mcp` route. The adapter talks only to Outline's authenticated API and does not replace Outline as the knowledge base.
- **Dex local authentication** is a demonstration-only substitute for organizational SSO.

## Deliberately deferred production work

Enterprise SSO, HTTPS, centralized secret management, backups, monitoring, audit retention, document approval workflows, model governance, and formal validation are production-hardening activities rather than prototype acceptance criteria.

The result therefore demonstrates the proposed architecture and its main user workflow without claiming production regulatory validation.
