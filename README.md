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
| `npm run queue:seeds -- <file>` | Copy a Kept seed export into `scripts/seeds/inbox/` |
| `npm run queue:promote -- <file>` | Copy an approved-draft export into `scripts/promote/inbox/` |

---

## What’s inside

- **Feed** — mixed ideas, free sites, books; optional Ask on a card
- **Ask** — instant catalog paths + optional LLM refine
- **Topics / Sites / Books / Kept** — curated learning destinations + ideas you keep for later
- **PWA** — installable, offline shell

Evergreen ideas live in `src/data/ideas.ts`. Rotating LLM-promoted ideas load from `public/content/ideas.json`.

### Idea loop (PR-chained)

Human review stays on PRs; merge advances the next Action.

```text
Kept → Send seeds to idea loop  (opens inbox PR)
  → merge main
  → Action: Draft ideas  →  opens draft review PR
  → merge draft PR       →  idea-drafts.json live (Approve/Deny in feed)
  → Kept → Send approved to idea loop  (opens promote inbox PR)
  → merge main
  → Action: Promote ideas → opens promote PR (ideas.json)
  → merge promote PR     →  deploy ships live pool
```

**From the app (preferred)**

1. One-time VPS setup in `/opt/thinker/.env`:
   - `GITHUB_TOKEN` — fine-grained PAT with Contents + Pull requests on this repo
   - `QUEUE_SECRET` — random shared gate (not the GitHub token)
   - optional `GITHUB_REPO=mitchelldawkinsjr/thinker`
2. Rebuild/restart the app container so the sidecar picks up env.
3. In **Settings → Idea loop**, paste the same `QUEUE_SECRET`.
4. On **Kept**, tap **Send seeds to idea loop** (or **Send approved…**). The app opens a GitHub PR.
5. Merge that PR → the next Action runs.

**CLI fallback** (download JSON from Kept, or offline):

```bash
npm run queue:seeds -- ~/Downloads/thinker-thought-seeds-YYYY-MM-DD.json
git add scripts/seeds/inbox && git commit -m "chore: queue thought seeds" && git push -u origin HEAD
gh pr create --title "chore: queue thought seeds" --body "Feed notes into draft:ideas."
```

Merge that PR. **Draft ideas** runs, archives the seeds under `scripts/seeds/archive/`, and opens a PR with `scripts/drafts/*.json` + `public/content/idea-drafts.json`.

**2. Merge the draft PR** after skimming voice/duplicates. Deploy puts drafts in the feed — Approve / Deny there.

**3. Queue approved** the same way (app Send, or `npm run queue:promote`).

Merge the promote-inbox PR. **Promote ideas** opens a PR updating `public/content/ideas.json` (21-day TTL) + pruning the draft queue. Merge to ship.

**Manual / local still works:**

```bash
npm run draft:ideas -- --topic football-film --count 4
npm run draft:ideas -- --all-thin
npm run draft:ideas -- --seeds ~/Downloads/thinker-thought-seeds-YYYY-MM-DD.json
npm run draft:ideas -- --seeds-dir scripts/seeds/inbox
npm run promote:ideas -- scripts/drafts/ideas-football-film-YYYY-MM-DD.json --ids draft-foo,draft-bar
```

**Listening moments:** While playing book/podcast audio, tap **+** on the player → Save or Save as idea. Moments live under Kept; send seeds into the loop above.

GitHub: Actions → **Draft ideas** also supports `workflow_dispatch` (`all-thin` or a topic) without seeds. Requires repo secret `OPENAI_API_KEY`.

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
