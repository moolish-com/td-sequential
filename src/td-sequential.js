// Independent TD Sequential counter (setup, countdown, support/resistance).
// Zero dependencies; written from SPEC.md. Bars: { t, o, h, l, c }, oldest
// first, closed bars only.

const MAX_LEVELS = 20;
const IDLE = 14; // cancellation / "no countdown in progress" value

/** Rule 2/3/4/5 of the countdown for one side. `s` is that side's state. */
function stepCountdown(s, { own9, other9, levelActive, qualifies, test, close }) {
  const prev = s.value;
  let value;
  let deferred = false;
  if (own9) value = qualifies ? 1 : 0;
  else if (other9 || !levelActive) value = IDLE;
  else if (Math.abs(prev) === 12 && qualifies && !test) { value = -12; deferred = true; }
  else if (qualifies) value = Math.abs(prev) + 1;
  else value = prev === 0 ? 0 : -Math.abs(prev);
  if (value === 8) s.eightClose = close; // only a transition to +8 gets here
  s.value = value;
  return { value, deferred };
}

/** Add a level unless non-positive or a duplicate of an active one. */
function addLevel(list, price) {
  if (!(price > 0) || list.some((x) => x.active && x.price === price)) return;
  list.push({ price, active: true });
  if (list.length > MAX_LEVELS) list.shift();
}

const reported = (list) => {
  const last = list[list.length - 1];
  return last && last.active ? last.price : null;
};

/**
 * Compute one record per bar:
 * { t, buySetup, sellSetup, buyCountdown, sellCountdown,
 *   resistance, support, buyDeferred, sellDeferred,
 *   buyPerfected, sellPerfected, bullishFlip, bearishFlip }
 * The last four are information only; they never change a count.
 */
export function computeTdSequential(bars) {
  const out = [];
  const resistances = [];
  const supports = [];
  const buy = { value: 0, eightClose: NaN };
  const sell = { value: 0, eightClose: NaN };
  let buySetup = 0;
  let sellSetup = 0;

  for (let i = 0; i < bars.length; i++) {
    const { t, h, l, c } = bars[i];
    buySetup = i >= 4 && c < bars[i - 4].c ? buySetup + 1 : 0;
    sellSetup = i >= 4 && c > bars[i - 4].c ? sellSetup + 1 : 0;
    const buy9 = buySetup === 9;
    const sell9 = sellSetup === 9;

    if (buy9 || sell9) {
      const window = bars.slice(i - 8, i + 1);
      if (buy9) addLevel(resistances, Math.max(...window.map((b) => b.h)));
      if (sell9) addLevel(supports, Math.min(...window.map((b) => b.l)));
    }
    for (const r of resistances) if (r.active && (c > r.price || l > r.price)) r.active = false;
    for (const s of supports) if (s.active && (c < s.price || h < s.price)) s.active = false;
    const resistance = reported(resistances);
    const support = reported(supports);

    const l2 = i >= 2 ? bars[i - 2].l : NaN;
    const h2 = i >= 2 ? bars[i - 2].h : NaN;
    const b = stepCountdown(buy, {
      own9: buy9, other9: sell9, levelActive: resistance !== null,
      qualifies: i >= 2 && c <= l2, test: l <= buy.eightClose, close: c,
    });
    const s = stepCountdown(sell, {
      own9: sell9, other9: buy9, levelActive: support !== null,
      qualifies: i >= 2 && c >= h2, test: h >= sell.eightClose, close: c,
    });

    // Perfection, on the setup-9 bar: bar 8 or 9 goes beyond bars 6 and 7 (strictly).
    const buyPerfected = buy9 && Math.min(bars[i - 1].l, l) < Math.min(bars[i - 3].l, bars[i - 2].l);
    const sellPerfected = sell9 && Math.max(bars[i - 1].h, h) > Math.max(bars[i - 3].h, bars[i - 2].h);
    // Price flip: the close-versus-close-4-bars-earlier comparison changes side.
    const bullishFlip = i >= 5 && bars[i - 1].c < bars[i - 5].c && c > bars[i - 4].c;
    const bearishFlip = i >= 5 && bars[i - 1].c > bars[i - 5].c && c < bars[i - 4].c;

    out.push({
      t, buySetup, sellSetup, buyCountdown: b.value, sellCountdown: s.value,
      resistance, support, buyDeferred: b.deferred, sellDeferred: s.deferred,
      buyPerfected, sellPerfected, bullishFlip, bearishFlip,
    });
  }
  return out;
}

const lastWhere = (result, pred) => {
  for (let i = result.length - 1; i >= 0; i--) if (pred(result[i])) return result[i].t;
  return null;
};

const countdownState = (v) => (v !== 0 && Math.abs(v) < 13 ? { count: Math.abs(v), paused: v < 0 } : null);

/** Summary of the final bar of a computeTdSequential() result. */
export function latest(result) {
  const last = result[result.length - 1];
  if (!last) return null;
  return {
    t: last.t,
    buySetup: last.buySetup,
    sellSetup: last.sellSetup,
    countdown: { buy: countdownState(last.buyCountdown), sell: countdownState(last.sellCountdown) },
    completed13Now: { buy: last.buyCountdown === 13, sell: last.sellCountdown === 13 },
    lastSetup9: {
      buy: lastWhere(result, (r) => r.buySetup === 9),
      sell: lastWhere(result, (r) => r.sellSetup === 9),
    },
    lastCountdown13: {
      buy: lastWhere(result, (r) => r.buyCountdown === 13),
      sell: lastWhere(result, (r) => r.sellCountdown === 13),
    },
    resistance: last.resistance,
    support: last.support,
  };
}
