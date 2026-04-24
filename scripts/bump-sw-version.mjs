#!/usr/bin/env node
// Bumps VERSION in public/sw.js on each build so the PWA service worker
// actually invalidates its cache when a new deploy ships.
// Only runs on Vercel; in local dev the file is left untouched.

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

if (!process.env.VERCEL) {
  console.log('[bump-sw] Skip (not in Vercel build).')
  process.exit(0)
}

function resolveVersion() {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (vercelSha) return vercelSha.slice(0, 7)
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 7)
  } catch {
    return Date.now().toString(36)
  }
}

const path = 'public/sw.js'
const version = resolveVersion()
const src = readFileSync(path, 'utf8')
const next = src.replace(/const VERSION = '[^']*'/, `const VERSION = 'nm-${version}'`)

if (src === next) {
  console.warn(`[bump-sw] No VERSION line matched in ${path} — check the regex.`)
  process.exit(0)
}

writeFileSync(path, next)
console.log(`[bump-sw] ${path} → nm-${version}`)
