#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$ROOT/.venv312/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.venv312/bin/activate"
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing $ROOT/.env. Copy .env.example to .env and set secrets." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

: "${VLLM_API_KEY:?VLLM_API_KEY is required}"
: "${MODEL_PATH:?MODEL_PATH is required}"

export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"
if [[ -d "$HOME/tmp_nvml" ]]; then
  export LD_LIBRARY_PATH="$HOME/tmp_nvml${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

exec vllm serve "$MODEL_PATH" \
  --served-model-name "${SERVED_MODEL_NAME:-qwen-coder}" \
  --host "${VLLM_HOST:-127.0.0.1}" \
  --port "${VLLM_PORT:-8000}" \
  --api-key "$VLLM_API_KEY" \
  --quantization awq \
  --dtype auto \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
