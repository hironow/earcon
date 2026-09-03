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

# Verify what `bun publish` would ship from each package
publish-dry:
    bun run --filter './packages/*' publish:dry

# changesets version bump, build, publish (needs npm auth)
release:
    bunx changeset version
    just build
    bun run --filter './packages/*' publish:npm
