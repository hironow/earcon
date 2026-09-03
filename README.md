# earcon

Not a notification library that sounds when something *happened* — a sonification hook that sounds when something is *approaching*.

`earcon` maps a continuous value (distance to liquidation, time to a deadline, anything normalized by your app) to the **rate and pitch** of a synthesized sound, so a trader can hear *how fast* things are going wrong without looking at the screen.

| package | what it is |
| --- | --- |
| `@earcon/core` | pure state machine: hysteresis levels, ETA-based intensity, arbiter. No DOM, no Web Audio |
| `@earcon/engine-tone` | Tone.js engine: presets (sonar, parking sensor, heartbeat, siren…), buses, `SynthSpec` interpreter |
| `@earcon/react` | `NotifierProvider`, `useMonitor`, `useToneNotifier`, headless `UnlockGate` |

Status: scaffold. API and Quick start land with the first release.

## Development

```sh
just            # list tasks
just install    # bun install
just check      # tsc -b + semgrep + bun test + core coverage gate
just build      # tsdown → packages/*/dist
just dev        # Vite demo
```

Toolchain: bun ≥ 1.4 (workspaces + catalog), tsdown 0.22 (pinned), Vite, Playwright, Semgrep, changesets, just.

License: MIT
