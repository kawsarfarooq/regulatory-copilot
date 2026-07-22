# vLLM and Qwen server

The demonstrated server used Python 3.12, vLLM 0.25.1, and a local copy of `Qwen2.5-Coder-14B-Instruct-AWQ` on an RTX 4090.

## Environment

```bash
cd ~/projects/regulatory-copilot/server
source .venv312/bin/activate
cp .env.example .env
chmod 600 .env
```

Edit `.env`, set the local model path, choose an available GPU, and generate a strong API key. Do not commit `.env`.

If stale proxy variables point to an unavailable localhost proxy, unset them only for package installation:

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
    -u http_proxy -u https_proxy -u all_proxy \
    uv pip install vllm --torch-backend=auto
```

## Start in tmux

```bash
tmux new -s regulatory-vllm
./start-vllm.sh
```

Detach with `Ctrl+B`, then `D`. Verify from another server terminal:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/health
```

Expected status: `200`.

The `hermes` parser is used because Qwen2.5's chat template supports Hermes-style tool calling. Keep vLLM bound to loopback and reach it through SSH rather than exposing port 8000 publicly.
