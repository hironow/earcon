# 0010. Host the demo on GitHub Pages

**Date:** 2026-09-04
**Status:** Accepted (supersedes the demo-hosting item of ADR-0001, D5)

## Context

The spec's open item 5 assumed Cloudflare Pages for the demo and ADR-0001 D5
recorded Cloudflare Workers Static Assets; nothing was implemented for it. The
repository now lives at `github.com/hironow/earcon`, and GitHub Pages serves a
static Vite build from the same place at no cost, with the same OIDC deployment
model the release workflow uses.

## Decision

- `.github/workflows/pages.yaml` builds `apps/demo` on every push to `main`
  (`DEMO_BASE=/earcon/`, actions pinned by SHA) and deploys it with
  `actions/deploy-pages` (`pages: write`, `id-token: write`). No secrets.
- The demo is a single static page at `https://hironow.github.io/earcon/`;
  `vite.config.ts` reads the base path from `DEMO_BASE` so local development and
  Playwright keep `/`.
- The repository's Pages source must be "GitHub Actions" (one-time setting).

## Consequences

### Positive
- Free hosting, deployed from the same audited workflow model.

### Negative
- Project-page URLs carry the `/earcon/` prefix; a custom domain is a later choice.

### Neutral
- Cloudflare remains possible; nothing in the app depends on the host.
