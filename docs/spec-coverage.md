# Spec coverage

Maps each acceptance test id from the spec (§3.10 T1–T20, §4.5, §5.5) to the test
that proves it. A meta test in `packages/core` asserts every core id (T1–T20)
appears in a test name.

| id | test file | test name |
| --- | --- | --- |
| T20 | `packages/core/src/purity.test.ts` | `T20 core is time- and host-independent` |
