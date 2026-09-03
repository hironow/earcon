# 0005. Expand the preset catalog from 14 to 28

**Date:** 2026-09-04
**Status:** Accepted

## Context

The requester asked for seven more continuous and seven more one-shot presets,
chosen from a survey of sounds people already know (differentiator D1) and of
current auditory-display research. Two independent surveys were run on
2026-09-04 (metaphor sources; sonification/discriminability literature).

Findings that shaped the choice:

- Abstract-tone earcons lose about half their discriminability as soon as two
  sound at once (single 0.41 → paired 0.20; everyday-sound icons 0.78 → 0.59).
  Edworthy, Forum Acusticum/EAA 2025; Edworthy et al., Applied Ergonomics 2022.
- Pulse rate is the most context-robust urgency axis; pitch alone should not carry
  information, stay under 5 kHz and above 125–150 Hz (Sonification Handbook ch. 14;
  ICAD 2012 "Revisiting pulse rate…"; Clarke et al., Human Factors 2024).
- IEC 60601-1-8 Amendment 2 (2020) replaced same-structure melodic alarms with
  auditory icons plus a priority pointer, after a decade of confusion reports.
- Stereo panning helps for 2–3 simultaneous streams at most; `worst-only` as the
  default policy and `top-n` with n = 2 are supported by the literature.
- Trading tools (Bookmap, PriceSquawk, TT) already map fills to one-shots; the
  continuous "distance to liquidation" display is unclaimed. `register`/`coin`/
  `bell` are established fill vocabulary, so one-shot meanings follow that habit.
- Chrome exempts a tab from timer throttling only while audio is actually audible.

## Decision

Add, continuous: `stallWarning`, `rwrLock`, `spo2Pulse`, `laneDeparture`,
`foghorn`, `kettle`, `tickingClock`. One-shot: `sosMorse`, `gong`, `glassBreak`,
`powerDown`, `squelch`, `waterDrop`, `latchClick`.

Adjustments to the survey's proposals, from the research rules: `foghorn` sits at
110–160 Hz rather than 80 Hz (lower pitch bound); `spo2Pulse` adds a tremolo above
intensity 0.6 so pitch is not the only carrier; `rwrLock` fuses into a continuous
tone at intensity ≥ 0.95 (fusion as the top-urgency cue). Rejected: `busyTone`
(mid-band clash with `hiLoSiren`), `diveKlaxon` (low-band clash with `foghorn`),
`iecAlarm` (would imitate a medical standard's melodies), `flatline` (an end state,
not a mapping), `lowHealthBeep`, `levelUp`, `anchorBell`, `typewriterReturn`,
`corkPop`, `elevatorArrive` (overlap with existing sounds).

`catalog` gains `presetHint` (one line per preset: what to listen for) so the
catalog can be learned in the demo; `gong` is a generic gong and does not reference
any exchange's trademarked bell.

## Consequences

### Positive
- Every new sound occupies a band/timbre/rhythm cell not used by the existing 14.
- The catalog doubles without adding abstract tone families.

### Negative
- The e2e leak and smoke checks now iterate 28 presets (a few seconds longer).
- No `SynthSpec` twins for the new presets (spec §4.4 asked for six; they exist).

### Neutral
- Spec appendix A is unchanged; the additions live after it in `presets.ts`.
