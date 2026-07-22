# VPS deployment (mitch-cloud)

## URL

| Route | Purpose |
|-------|---------|
| `https://thinker.360web.cloud/` | Thinker PWA (NPM → `thinker-app:80`) |

## One-time setup

1. **DNS (Hostinger)** — CNAME `thinker` → `360web.cloud` (same pattern as `sb`, `ringlink`, `scriptura`)
2. On VPS:

```bash
docker network create 360ws-network  # no-op if exists
cd /opt/thinker
bash scripts/npm-add-thinker.sh      # NPM proxy host + Let’s Encrypt
```

3. Repository secrets (same as other 360web apps): `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`

## Deploy

Push to `main` triggers `.github/workflows/deploy-vps.yml`, or manually:

```bash
cd /opt/thinker
docker compose -f docker-compose.prod.yml up -d --build
curl -fsS http://127.0.0.1:8055/healthz
```

## Runtime env (`/opt/thinker/.env`)

```
OLLAMA_URL=http://host.docker.internal:11434
VITE_OLLAMA_MODEL=mistral:latest
VITE_OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_CONFIGURED=true
PORT=8055
```

`OPENAI_API_KEY` enables Ask refine via nginx → api.openai.com (key stays on the server). Set `OPENAI_CONFIGURED=true` when the key is present. `OLLAMA_URL` is the fallback. Rebuild after changing `VITE_*` build args.
