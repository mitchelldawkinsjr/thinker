# Thinker

**Live app:** [https://thinker.360web.cloud](https://thinker.360web.cloud)

Deepstash-style PWA — bite-sized ideas on AI, sports, history, politics, and finance. Replace doomscrolling with thinking.

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
cp .env.example .env   # optional — for Ask (OpenAI or Ollama)
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`).

### Optional: Ask (LLM)

Ask prefers OpenAI via a Vite proxy (API key stays on the server). Ollama is the fallback.

1. Copy env:

```bash
cp .env.example .env
```

2. Edit `.env` (OpenAI preferred):

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Or Ollama fallback:

```bash
OLLAMA_URL=http://127.0.0.1:11434
VITE_OLLAMA_MODEL=phi3:mini
```

3. Restart `npm run dev`.

Without either, the rest of the app still works — Ask falls back to instant catalog answers.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local Vite server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |
| `npm run draft:ideas` | LLM-draft Idea cards → `scripts/drafts/` + feed review queue (`idea-drafts.json`) |
| `npm run promote:ideas` | Promote approved drafts → `public/content/ideas.json` |

---

## What’s inside

- **Feed** — mixed ideas, free sites, books; optional Ask on a card
- **Ask** — instant catalog paths + optional LLM refine
- **Topics / Sites / Books / Kept** — curated learning destinations + ideas you keep for later
- **PWA** — installable, offline shell

Evergreen ideas live in `src/data/ideas.ts`. Rotating LLM-promoted ideas load from `public/content/ideas.json`.

### Refresh idea cards (LLM drafts)

1. Draft (writes review-only JSON under `scripts/drafts/` — never edits `ideas.ts`):

```bash
npm run draft:ideas -- --topic football-film --count 4
# or fill topics under 8 cards:
npm run draft:ideas -- --all-thin
# or expand listening moments exported from Kept:
npm run draft:ideas -- --seeds ~/Downloads/thinker-thought-seeds-YYYY-MM-DD.json
```

2. Review the draft file, then promote keepers (21-day TTL pool):

```bash
npm run promote:ideas -- scripts/drafts/ideas-football-film-YYYY-MM-DD.json --all
# or selected ids:
npm run promote:ideas -- scripts/drafts/ideas-football-film-YYYY-MM-DD.json --ids draft-foo,draft-bar
```

3. Commit `public/content/ideas.json` and deploy (or open a PR).

**Listening moments:** While playing book/podcast audio, tap **+** on the player → Save or Save as idea. Moments live under Kept; export seeds to feed `draft:ideas`.

GitHub: Actions → **Draft ideas** (`workflow_dispatch`) opens a PR with draft JSON for review. Requires repo secret `OPENAI_API_KEY`.

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
