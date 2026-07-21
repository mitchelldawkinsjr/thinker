# Thinker

**Live app:** [https://thinker.360web.cloud](https://thinker.360web.cloud)

Deepstash-style microlearning PWA — bite-sized ideas on AI, sports, history, politics, and finance. Replace doomscrolling with thinking.

---

## Try it

| | |
|---|---|
| **Live** | https://thinker.360web.cloud |
| **Install** | Open the live site on your phone → browser menu → **Add to Home Screen** (PWA) |

---

## Install locally

**Requirements:** Node.js 20+ and npm.

```bash
git clone git@github.com:mitchelldawkinsjr/thinker.git
cd thinker
cp .env.example .env   # optional — for Ask / Ollama
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`).

### Optional: Ask (LLM)

Ask uses Ollama via a Vite proxy.

1. Copy env and set your runtime URL:

```bash
cp .env.example .env
```

2. Edit `.env`:

```bash
OLLAMA_URL=http://127.0.0.1:11434
VITE_OLLAMA_MODEL=phi3:mini
```

3. Restart `npm run dev`.

Without Ollama, the rest of the app still works — Ask falls back to instant catalog answers.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local Vite server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |

---

## What’s inside

- **Feed** — mixed ideas, free sites, Gutenberg books; optional Ask on a card
- **Ask** — instant catalog paths + optional LLM refine
- **Topics / Resources / Gutenberg / Kept** — curated learning destinations + thoughts you keep for later
- **PWA** — installable, offline shell

Content lives in `src/data/`.

---

## Production deploy

Production URL: **https://thinker.360web.cloud**

Push to `main` runs `.github/workflows/deploy-vps.yml` (VPS secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`).

Manual deploy on the VPS:

```bash
cd /opt/thinker
docker compose -f docker-compose.prod.yml up -d --build
```

One-time DNS: CNAME `thinker` → `360web.cloud`. See `docs/` for more.

---

## License

Private / personal project unless noted otherwise.
