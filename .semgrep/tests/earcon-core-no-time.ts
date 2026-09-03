// ruleid: earcon-core-no-time
const a = Date.now()
// ruleid: earcon-core-no-time
const b = new Date()
// ruleid: earcon-core-no-time
const c = performance.now()
// ruleid: earcon-core-no-time
setTimeout(() => {}, 1)
// ruleid: earcon-core-no-time
setInterval(() => {}, 1)
// ruleid: earcon-core-no-time
const d = window.innerWidth
// ok: earcon-core-no-time
const t = (sample: { t: number }) => sample.t
// ok: earcon-core-no-time
const e = Math.exp(-1)
export { a, b, c, d, t, e }
