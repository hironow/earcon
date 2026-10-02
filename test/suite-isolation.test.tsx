// Suite-integrity guard, not a test of a module.
//
// `mock.module` rewrites a module's exports for the whole test process, so a mock
// left installed past the test that needed it makes the suite pass or fail by file
// order: with `./env` stuck in server mode, `NotifierProvider` gets `store === null`,
// and the hooks suite's useSyncExternalStore loops until React throws "Maximum
// update depth exceeded" (nine red tests) — a CI failure no local run reproduced
// while bun's own file order put hooks first.
//
// The `await import`s are sequential on purpose: ssr.test.tsx has a top-level
// `await import('./env')`, so a plain static import would let hooks.test.tsx
// register — and therefore run — first, and the guard would miss a mock that is
// only left behind by the SSR test's own body. Awaiting each file pins the
// run order to SSR → hooks on every machine and in every bun version.
await import('../packages/react/src/ssr.test.tsx')
await import('../packages/react/src/hooks.test.tsx')
