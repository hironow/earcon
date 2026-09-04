# earcon — bun workspace task runner (the only entrypoint)

set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

# Install all workspace dependencies
install:
    bun install

# Build the three publishable packages (ESM + d.ts via tsdown), then prove the
# engine-tone main entry does not import tone statically (spec §4.1)
build:
    bun run --filter './packages/*' build
    bun run scripts/check-lazy-tone.ts

# Unit tests for every workspace (bun:test)
test:
    bun test

# @earcon/core with the 90% coverage gate (packages/core/bunfig.toml)
test-core:
    cd packages/core && bun test --coverage

# Playwright real-browser tests against apps/demo
test-e2e:
    bunx playwright test

# Run the demo app with Vite (localhost only)
dev:
    bun run --bun --filter demo dev

# Run the demo reachable from phones on the same network (prints the LAN URL)
dev-lan:
    bun run --bun --filter demo dev -- --host 0.0.0.0

# Type-check every project reference
typecheck:
    bunx tsc -b

# Project-specific Semgrep rules (core purity, T20)
semgrep:
    semgrep --config .semgrep/rules/ --error --quiet --exclude '*.test.ts' packages/core/src
    semgrep --test --config .semgrep/rules/ .semgrep/tests/

# Types + Semgrep
lint: typecheck semgrep

# The full local gate
check: lint test test-core

# Verify what would ship: list each tarball (bun pm pack --dry-run)
publish-dry:
    bun run --filter './packages/*' publish:dry

# Pack the publishable tarballs into dist-pack/ and prove workspace:/catalog:
# were resolved and nothing unexpected is inside (the release workflow publishes
# exactly these files)
pack:
    bun run scripts/pack-check.ts

# Dependency vulnerability audit (CI gate; needs registry.npmjs.org reachable).
# npm's advisories endpoint returns transient 503s; a registry or transport error
# is retried (delays from AUDIT_RETRY_DELAYS, seconds), then the audit fails. A
# real finding fails at once, and the gate is never skipped or downgraded.
audit:
    #!/usr/bin/env bash
    set -euo pipefail
    log="$(mktemp)"
    trap 'rm -f "$log"' EXIT
    for delay in ${AUDIT_RETRY_DELAYS:-20 60} 0; do
        if bun audit --audit-level=high 2>&1 | tee "$log"; then exit 0; fi
        if [ "$delay" = 0 ] || ! grep -qE 'registry\.npmjs\.org.* - 5[0-9]{2}|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN' "$log"; then
            exit 1
        fi
        echo "bun audit: registry error, retrying in ${delay}s" >&2
        sleep "$delay"
    done

# Releases are published by .github/workflows/release.yaml over npm Trusted
# Publishing (ADR-0007). Locally this only bumps versions from pending changesets.
release-version:
    bunx changeset version
    bun run scripts/sync-lock-versions.ts
    bun install --frozen-lockfile --dry-run

# Sync workspace versions from package.json into bun.lock (bun does not do this itself)
sync-lock:
    bun run scripts/sync-lock-versions.ts
