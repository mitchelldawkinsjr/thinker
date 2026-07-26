#!/usr/bin/env node
/**
 * Copy a Kept export into the CI inbox so a PR merge can advance the idea loop.
 *
 *   node scripts/queue-export.mjs seeds ~/Downloads/thinker-thought-seeds-….json
 *   node scripts/queue-export.mjs promote ~/Downloads/thinker-approved-drafts-….json
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const KINDS = {
  seeds: {
    inbox: join(ROOT, 'scripts', 'seeds', 'inbox'),
    label: 'seeds',
    next: 'Open a PR that adds this file under scripts/seeds/inbox/. Merge to main → Draft ideas opens a review PR.',
  },
  promote: {
    inbox: join(ROOT, 'scripts', 'promote', 'inbox'),
    label: 'approved drafts',
    next: 'Open a PR that adds this file under scripts/promote/inbox/. Merge to main → promote runs and updates the live pool.',
  },
}

async function main() {
  const [kind, src] = process.argv.slice(2)
  const cfg = kind ? KINDS[kind] : null
  if (!cfg || !src || src === '--help' || src === '-h') {
    console.log(`Usage:
  node scripts/queue-export.mjs seeds <thinker-thought-seeds-….json>
  node scripts/queue-export.mjs promote <thinker-approved-drafts-….json>`)
    process.exit(kind && src ? 1 : 0)
  }

  const from = resolve(src)
  const name = basename(from)
  if (!name.endsWith('.json')) {
    console.error('Expected a .json export file.')
    process.exit(1)
  }

  await mkdir(cfg.inbox, { recursive: true })
  const dest = join(cfg.inbox, name)
  await copyFile(from, dest)
  console.log(`Queued ${cfg.label} → ${dest}`)
  console.log(cfg.next)
  console.log(`
  git add ${dest}
  git commit -m "chore: queue ${cfg.label} for idea loop"
  git push -u origin HEAD
  gh pr create --fill
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
