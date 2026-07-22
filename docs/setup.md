# Complete setup

## 1. GPU server

1. Create a dedicated project directory and Python 3.12 virtual environment.
2. Install vLLM and copy the AWQ model to local storage.
3. Copy `server/.env.example` to `server/.env` and replace all placeholders.
4. Start `server/start-vllm.sh` inside tmux.
5. Confirm `http://127.0.0.1:8000/health` returns HTTP 200 on the server.

## 2. Workstation knowledge base

1. Install Docker Desktop.
2. Run the two Outline initialization scripts.
3. Start the Compose stack.
4. Sign in through local Dex and create a `Regulatory Intelligence` collection.
5. Convert approved PDFs to Markdown and import them into Outline.
6. Confirm an Outline search returns expected passages.

## 3. Network connection

Start `outline-runtime/Start-VllmTunnel.ps1`. Confirm the workstation receives HTTP 200 from `http://127.0.0.1:8000/health`.

## 4. MCP

1. In Outline, create a read-only API token.
2. Run `outline-mcp/Set-OutlineToken.ps1`.
3. Run `node outline-mcp/outline_mcp_server.mjs --check`.
4. Confirm the output lists the expected collection and documents.

## 5. Continue

1. Install Continue in VS Code.
2. Open Continue's Main Config.
3. Copy `continue/config.yaml.example` and replace the vLLM key and repository paths.
4. Reload the VS Code window.
5. Select `Qwen Regulatory Coder` and Agent mode.

## 6. Acceptance test

Ask the SRS example from the root README. Pass criteria:

- Continue invokes `outline_research` once.
- The retrieved source is FDA Device Software Premarket Guidance (2023).
- The evidence contains PDF page 22 rather than the table of contents.
- The answer distinguishes recommendations from binding requirements.
- No context-limit error occurs.
