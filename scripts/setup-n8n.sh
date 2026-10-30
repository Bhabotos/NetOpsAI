#!/usr/bin/env bash
# One-shot n8n setup for NetOpsAI (safe to re-run):
#   1. creates the 'netopsai-postgres' and 'netopsai-openai' credentials
#   2. imports the 5 workflows from n8n-workflows/ (fixed IDs, so re-imports overwrite)
#   3. publishes them and restarts n8n so the webhook is registered
#
# Usage:  docker compose up -d   then   bash scripts/setup-n8n.sh
#
# LLM settings (read from the environment or .env; only used to build the n8n credential):
#   LLM_BASE_URL  OpenAI-compatible base URL   (default https://api.openai.com/v1)
#   LLM_API_KEY   API key                      (local Ollama accepts any value)
#   LLM_MODEL     model name                   (default gpt-4o-mini)
set -euo pipefail
cd "$(dirname "$0")/.."

# Strip CR so a .env saved with Windows line endings doesn't leave '\r' on every value
if [ -f .env ]; then set -a; . <(tr -d '\r' < .env); set +a; fi
LLM_BASE_URL="${LLM_BASE_URL:-https://api.openai.com/v1}"
LLM_MODEL="${LLM_MODEL:-gpt-4o-mini}"
if [ -z "${LLM_API_KEY:-}" ]; then
  echo "WARNING: LLM_API_KEY is empty - AI calls will fail and the agents will return fallback results."
  echo "         Set LLM_API_KEY in .env and re-run, or edit the 'NetOpsAI OpenAI / LLM' credential in n8n."
fi

docker compose exec -T \
  -e "DB_NAME=${DB_NAME:-netopsai}" -e "DB_USER=${DB_USER:-netopsai}" -e "DB_PASSWORD=${DB_PASSWORD:?DB_PASSWORD not set}" \
  -e "LLM_BASE_URL=$LLM_BASE_URL" -e "LLM_API_KEY=${LLM_API_KEY:-not-set}" -e "LLM_MODEL=$LLM_MODEL" \
  n8n sh -s <<'EOS'
set -e
rm -rf /tmp/netops && mkdir -p /tmp/netops/wf
node -e '
const fs = require("fs"); const e = process.env;
fs.writeFileSync("/tmp/netops/credentials.json", JSON.stringify([
  { id: "netopsai-postgres", name: "NetOpsAI PostgreSQL", type: "postgres",
    data: { host: "postgres", port: 5432, database: e.DB_NAME, user: e.DB_USER, password: e.DB_PASSWORD, ssl: "disable" } },
  { id: "netopsai-openai", name: "NetOpsAI OpenAI / LLM", type: "openAiApi",
    data: { apiKey: e.LLM_API_KEY, url: e.LLM_BASE_URL } },
]));
for (const f of fs.readdirSync("/import/workflows").filter(f => f.endsWith(".json"))) {
  const wf = JSON.parse(fs.readFileSync("/import/workflows/" + f, "utf8"));
  for (const n of wf.nodes) if (n.type === "@n8n/n8n-nodes-langchain.lmChatOpenAi") n.parameters.model = e.LLM_MODEL;
  fs.writeFileSync("/tmp/netops/wf/" + f, JSON.stringify(wf));
}'
n8n import:credentials --input=/tmp/netops/credentials.json
n8n import:workflow --separate --input=/tmp/netops/wf
for id in NETOPS02CLASSIFY NETOPS03RCAAGENT NETOPS04TOPOLOGY NETOPS05REMEDIAT NETOPS01ORCHESTR; do
  n8n publish:workflow --id="$id"
done
rm -rf /tmp/netops
EOS

docker compose restart n8n

# Webhooks register a few seconds after n8n starts; wait until the orchestrator answers
# (an empty POST is rejected by validation, but anything other than 404 means it is live).
WEBHOOK="${N8N_EXTERNAL_WEBHOOK_URL:-http://localhost:5678}/webhook/netopsai/alarm"
printf "Waiting for webhook"
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"probe":true}' "$WEBHOOK" || true)
  if [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" != "404" ]; then echo " ready"; break; fi
  printf "."; sleep 2
done
echo "n8n setup complete. Webhook: $WEBHOOK"
