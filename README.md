# NetOpsAI — AI-Powered Multi-Agent Network Operations System

A portfolio-grade NOC assistant built with **n8n**, **PostgreSQL**, **Node.js/Express**, and **React**. The system ingests simulated network alarms, dispatches them to specialist AI agents, generates structured incident reports, and surfaces everything in a real-time NOC dashboard.

---

## Architecture

```
Simulated Alarm
      │
      ▼  POST /api/alarms/simulate
┌─────────────┐
│  Express    │──── n8n Webhook ──► NETOPS-01 Orchestrator
│  Backend    │◄─── incident     ─────────────────────────┐
└─────────────┘                                            │
      │                                          ┌─────────┴──────────┐
      │                                          │  Parallel dispatch  │
      ▼                                          ├──────────┬──────────┤
┌─────────────┐                         NETOPS-02    NETOPS-03  NETOPS-04
│ PostgreSQL  │◄── read / write ──      Alarm Class   RCA Agent  Topology
└─────────────┘                                          │
                                               NETOPS-05 Remediation & Report
                                                     │
                                               Telegram (Critical only)
```

### Components

| Component | Technology | Port |
|-----------|-----------|------|
| Workflow Orchestration | n8n | 5678 |
| REST API / Alarm Ingestion | Node.js 22 + Express + TypeScript | 3001 |
| NOC Dashboard | React 18 + Vite + Tailwind CSS | 3000 |
| Database | PostgreSQL 16 | 5432 |

### AI Agents

| Agent | Workflow | Responsibility |
|-------|----------|---------------|
| NETOPS-01 | Incident Orchestrator | Entry point, dedup, parallel dispatch, persistence |
| NETOPS-02 | Alarm Classification | Severity, category, service impact, urgency |
| NETOPS-03 | Root Cause Analysis | Probable RCA, evidence, timeline, correlation |
| NETOPS-04 | Topology Impact | Affected nodes/links/services, cascade risk |
| NETOPS-05 | Remediation & Report | Read-only action recommendations, incident report |

### Workflow files (`n8n-workflows/`)

Exports for n8n 2.x with fixed IDs (the orchestrator calls the sub-workflows by ID). Credentials are
referenced by name/ID only — no secrets are stored in these files.

| File | Trigger | What it does |
|------|---------|--------------|
| `NETOPS-01-Incident-Orchestrator.json` | Webhook `POST /webhook/netopsai/alarm` | Validates and upserts the alarm, deduplicates (same device + type within 5 min), opens an `investigating` incident, runs NETOPS-02/03/04, then NETOPS-05, writes the final incident, marks the alarm `processed`. Optional Telegram alert for Critical incidents (node ships disabled). |
| `NETOPS-02-Alarm-Classification.json` | Execute Workflow (from 01) | LLM classifies the alarm: layer/category, severity, subtype, service impact, urgency, confidence. Logs to `agent_execution_logs`. |
| `NETOPS-03-Root-Cause-Analysis.json` | Execute Workflow (from 01) | Loads device info and recent alarms on the same device; LLM returns probable root cause, evidence, alternative causes, repair-time estimate. |
| `NETOPS-04-Topology-Impact.json` | Execute Workflow (from 01) | Loads connected links and dependent services from PostgreSQL; LLM returns impact level, affected nodes/links/services and cascade risk. |
| `NETOPS-05-Remediation-Report.json` | Execute Workflow (from 01) | LLM drafts recommended actions and a markdown incident report. A strict allowlist keeps only read-only `show`/`display` commands, rejects config changes, chained commands and external actions, and forces `requires_human_approval: true`. |

Every LLM step is a *Basic LLM Chain* + *OpenAI Chat Model* (any OpenAI-compatible API); if a call fails,
the parser substitutes a safe fallback and the agent log is marked `failed`.

---

## Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [PostgreSQL 16+](https://www.postgresql.org/) (or Docker Desktop)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Docker path)
- [n8n](https://n8n.io/) (self-hosted or cloud; Docker Compose starts it automatically)
- OpenAI-compatible API key (OpenAI, Anthropic via proxy, OpenRouter, etc.)

---

## Quick Start (Local Development — no Docker)

### 1. Clone and configure

```bash
git clone <your-repo-url> netopsai
cd netopsai
cp .env.example .env
# Edit .env with your DB credentials
```

### 2. Set up the database

```bash
psql -U postgres -c "CREATE DATABASE netopsai; CREATE USER netopsai WITH PASSWORD 'yourpassword'; GRANT ALL PRIVILEGES ON DATABASE netopsai TO netopsai;"
psql -U netopsai -d netopsai -f database/schema.sql
psql -U netopsai -d netopsai -f database/seed_data.sql
```

### 3. Start the backend

```bash
cd backend
npm install
npm run dev
# API running at http://localhost:3001
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173 (or 3000)
```

### 5. Start n8n

```bash
npx n8n
# n8n UI at http://localhost:5678
```

---

## Docker Compose (Recommended)

### 1. Configure

```bash
cp .env.example .env
# Set DB_PASSWORD, and optionally API_KEY, N8N_EXTERNAL_WEBHOOK_URL
```

### 2. Create the sandbox secret files

`docker-compose.yml` also runs the official n8n Assistant code sandbox (`sandbox-api`, privileged
`sandbox-runner-1`; no ports published). It reads three git-ignored files — create them with random values:

```bash
mkdir -p sandbox
API=$(openssl rand -hex 32); REG=$(openssl rand -hex 32); RUN=$(openssl rand -hex 32)
printf 'SANDBOX_API_KEYS=%s\nSANDBOX_API_RUNNER_REGISTRATION_TOKEN=%s\nSANDBOX_API_RUNNER_API_KEY=%s\n' "$API" "$REG" "$RUN" > sandbox/api.env
printf 'SANDBOX_RUNNER_REGISTRATION_TOKEN=%s\nSANDBOX_RUNNER_API_KEYS=%s\n' "$REG" "$RUN" > sandbox/runner.env
printf 'N8N_SANDBOX_SERVICE_API_KEY=%s\n' "$API" > sandbox/n8n.env
```

### 3. Start all services

```bash
docker compose up -d --build
```

### 4. Set up n8n (credentials + workflows) in one step

Set the LLM in `.env` first (any OpenAI-compatible API):

```bash
LLM_BASE_URL=https://api.openai.com/v1      # or http://host.docker.internal:11434/v1 for a local Ollama
LLM_API_KEY=sk-...                          # Ollama accepts any value
LLM_MODEL=gpt-4o-mini                       # or e.g. llama3.2
```

```bash
bash scripts/setup-n8n.sh
```

This creates the `netopsai-postgres` / `netopsai-openai` credentials, imports all 5 workflows,
publishes them and waits until the webhook is live. It is safe to re-run after editing a workflow JSON.
On first visit to the n8n UI you will be asked to create an owner account.

| Service | URL |
|---------|-----|
| NOC Dashboard | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| n8n | http://localhost:5678 |

### 5. Verify health

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{"status":"ok","db":"connected","timestamp":"..."}
```

---

## n8n Workflow Setup (manual alternative to `scripts/setup-n8n.sh`)

The workflows carry fixed IDs (`NETOPS01ORCHESTR` … `NETOPS05REMEDIAT`); the orchestrator calls the
sub-workflows by these IDs, so import the files rather than recreating them by hand.
Each AI step is a *Basic LLM Chain* with an attached *OpenAI Chat Model* — change the model name
in the four `… AI Agent Model` nodes if you don't use `gpt-4o-mini`.

### Step 1: Create credentials in n8n

Open http://localhost:5678 → **Credentials** → **New Credential**

**Required:**
1. **`netopsai-openai`** — Type: `OpenAI API`
   - API Key: your key
   - Base URL: `https://api.openai.com/v1` (or your proxy URL)

2. **`netopsai-postgres`** — Type: `Postgres`
   - Host: `postgres` (Docker) or `localhost` (local)
   - Port: `5432`
   - Database: `netopsai`
   - User: `netopsai`
   - Password: your DB_PASSWORD

**Optional:**
3. **`netopsai-telegram`** — Type: `Telegram API`
   - Access Token: your bot token (for Critical alarm Telegram alerts)

> **Security**: LLM API keys and database credentials are stored ONLY in n8n credentials. They are never hardcoded and never exposed to the frontend.

### Step 2: Import workflows

In n8n: **Workflows** → **Import from File** — import in this order:

1. `n8n-workflows/NETOPS-02-Alarm-Classification.json`
2. `n8n-workflows/NETOPS-03-Root-Cause-Analysis.json`
3. `n8n-workflows/NETOPS-04-Topology-Impact.json`
4. `n8n-workflows/NETOPS-05-Remediation-Report.json`
5. `n8n-workflows/NETOPS-01-Incident-Orchestrator.json`

> Import sub-workflows (02–05) **before** the orchestrator (01) so their IDs are available.

### Step 3: Publish workflows

For each imported workflow click **Publish** (top right). All 5 must be published.
The Telegram node ships **disabled**; enable it after creating the `netopsai-telegram` credential.

### Step 4: Note the webhook URL

After activating NETOPS-01, copy its webhook URL (shown in the Webhook node):
```
http://localhost:5678/webhook/netopsai/alarm
```

Update your `.env`:
```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/netopsai/alarm
```
(If running with Docker: `http://n8n:5678/webhook/netopsai/alarm`)

Restart the backend for the change to take effect.

---

## API Reference

All endpoints require `X-API-Key: <your-key>` header if `API_KEY` is set in `.env`. In dev mode (no `API_KEY`), auth is disabled.

### Health
```
GET /api/health
```

### Alarms
```
GET  /api/alarms?severity=Critical&status=processed&limit=20&offset=0
POST /api/alarms/simulate
```
Simulate body:
```json
{
  "device_name": "CORE-RTR-01",
  "alarm_type": "BGP_SESSION_DOWN",
  "severity": "Critical",
  "description": "BGP peer 10.0.0.1 session dropped",
  "interface_name": "GigabitEthernet0/0"
}
```

### Incidents
```
GET  /api/incidents?severity=Critical&status=open&limit=20&offset=0
GET  /api/incidents/stats
GET  /api/incidents/:id
POST /api/incidents/:id/resolve
```

### Devices & Topology
```
GET /api/devices
GET /api/topology
```

### Agent Logs
```
GET /api/agents/logs?agent_name=alarm_classification&limit=25&offset=0
```

---

## Demo Scenario

Run this end-to-end test to see all 5 agents in action:

### 1. Trigger a Critical alarm

```bash
curl -X POST http://localhost:3001/api/alarms/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "device_name": "CORE-RTR-01",
    "alarm_type": "BGP_SESSION_DOWN",
    "severity": "Critical",
    "description": "BGP peer 10.0.0.2 session dropped unexpectedly. Multiple prefixes withdrawn.",
    "interface_name": "GigabitEthernet0/0/0"
  }'
```

### 2. Watch the pipeline execute

In n8n (http://localhost:5678 → Executions), you'll see:
- NETOPS-01 receives the alarm and spawns 3 parallel sub-workflows
- NETOPS-02 classifies: `Physical/Hardware, service_affecting: true, urgency: Immediate`
- NETOPS-03 identifies: probable root cause, correlated alarms, repair time estimate
- NETOPS-04 maps: affected nodes, links, services, cascade risk
- NETOPS-05 generates: read-only diagnostic steps + full markdown incident report
- NETOPS-01 persists the incident and sends a Telegram alert (if configured)

### 3. View the incident in the dashboard

Open http://localhost:3000 → **Overview** — the new incident appears in Recent Incidents.

Click the incident → **Incident Detail** page shows:
- RCA analysis with confidence score and supporting evidence
- Recommended actions (read-only, human approval required)
- Full AI-generated incident report
- Impact summary (affected customers, redundant paths, rerouting possible)
- Classification sidebar and agent execution logs

### 4. Test deduplication

Submit the same device + alarm type again while the first is still being processed (or within 5 minutes of it).
The API answers `202` immediately (the pipeline runs in the background); the second alarm ends up with
`processing_status = deduplicated` and no new incident. n8n's webhook response (visible in the backend log) is:
```json
{"success":true,"deduplicated":true,"message":"Duplicate alarm detected — no new incident created","duplicate_of":"<alarm_id>"}
```

### 5. Resolve the incident

Click **Resolve Incident** on the detail page, or:
```bash
curl -X POST http://localhost:3001/api/incidents/<incident-id>/resolve
```

---

## Security Notes

- **LLM API keys**: stored in n8n credentials only. Never in `.env`, never in code.
- **Database credentials**: in `.env` (server-side only). Never sent to the frontend.
- **Remediation safety**: all AI-recommended actions are read-only diagnostic steps. The `requires_human_approval` flag is always set to `true` — enforced in the parse node regardless of LLM output.
- **Prompt injection**: alarm descriptions are sanitized (strips `<>`, `ignore.*instructions`, `system prompt` patterns) before being passed to AI agents.
- **API auth**: set a strong `API_KEY` in production.

---

## Project Structure

```
netopsai/
├── database/
│   ├── schema.sql          # 6 tables: devices, links, services, alarms, incidents, logs
│   └── seed_data.sql       # Simulated network (10 devices, 8 links, 5 services)
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express app entry
│   │   ├── db.ts           # PostgreSQL pool
│   │   ├── middleware/auth.ts
│   │   └── routes/         # alarms, incidents, devices, agents, health
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/          # Overview, Alarms, Incidents, IncidentDetail, Topology, AgentLogs
│   │   ├── components/     # Layout, SeverityBadge, SimulateAlarmModal
│   │   └── api/client.ts   # Axios client + TypeScript interfaces
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts
│   └── package.json
├── n8n-workflows/
│   ├── NETOPS-01-Incident-Orchestrator.json
│   ├── NETOPS-02-Alarm-Classification.json
│   ├── NETOPS-03-Root-Cause-Analysis.json
│   ├── NETOPS-04-Topology-Impact.json
│   └── NETOPS-05-Remediation-Report.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Troubleshooting

**Backend can't connect to PostgreSQL**
- Check `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`

**n8n workflows not executing**
- Confirm all 5 workflows are **Active** in n8n
- Check `N8N_WEBHOOK_URL` in `.env` matches the webhook URL shown in NETOPS-01
- Inspect the Executions tab in n8n for error details

**Simulated alarm returns 202 but no incident appears**
- The alarm was received but n8n hasn't processed it yet — wait ~10 seconds
- If still no incident, check n8n Executions for errors in NETOPS-01
- Verify `netopsai-openai` and `netopsai-postgres` credentials are correctly configured

**n8n logs "Postgres 16 is outside the supported range … Upgrade to Postgres 17 or newer"**
- n8n 2.x (pinned here as `2.45.7`) stores its own state in the `n8n` database on this Postgres 16 server and
  gives Postgres 16 *compatibility support only*. It is a warning, not an error: n8n starts, migrates and runs
  all NetOpsAI workflows normally on 16.
- The NetOpsAI tables themselves have no Postgres 17 requirement.
- Upgrading is a data migration, not an image bump: changing `postgres:16-alpine` to `17` on an existing
  `postgres_data` volume will **fail to start** (on-disk format differs). Plan it as: back up both databases
  (`pg_dumpall`), start Postgres 17 on a new volume, restore, verify, then retire the old volume.
- Until then keep `postgres:16-alpine` and the n8n image pinned, and re-check n8n release notes before bumping
  n8n — a future release may drop Postgres 16.

**Docker networking issues**
- Inside Docker Compose, services communicate by container name (e.g. `postgres`, `backend`, `n8n`)
- Set `N8N_WEBHOOK_URL=http://n8n:5678/webhook/netopsai/alarm` when backend runs in Docker

---

## License

MIT — built as a portfolio demonstration. Not intended for production network operations.
