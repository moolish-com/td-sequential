import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { computeTdSequential, latest } from '../src/td-sequential.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);

/** Bars from closes: open = close, high = close + 0.5, low = close - 0.5. */
const bars = (closes) =>
  closes.map((c, i) => ({ t: 1000 * (i + 1), o: c, h: c + 0.5, l: c - 0.5, c }));
const falling = (n, start = 100) => Array.from({ length: n }, (_, i) => start - i);
const col = (res, k) => res.map((r) => r[k]);

test('setup: needs 4 earlier bars, counts up without a cap, equal closes reset', () => {
  const r = computeTdSequential(bars(falling(15)));
  assert.deepEqual(col(r, 'buySetup').slice(0, 6), [0, 0, 0, 0, 1, 2]);
  assert.equal(r[12].buySetup, 9);
  assert.equal(r[13].buySetup, 10);
  assert.equal(r[14].buySetup, 11);
  assert.ok(r.every((x) => x.sellSetup === 0));

  const flat = computeTdSequential(bars([10, 10, 10, 10, 9, 9, 9, 9, 9, 9]));
  // bar 8 compares 9 with 9 (equal): neither side counts
  assert.deepEqual(col(flat, 'buySetup'), [0, 0, 0, 0, 1, 2, 3, 4, 0, 0]);
  assert.ok(flat.every((x) => x.sellSetup === 0));
});

test('setup: a non-qualifying bar resets the counter to 0', () => {
  const closes = [10, 10, 10, 10, 9, 8, 7, 20, 6, 5];
  const r = computeTdSequential(bars(closes));
  assert.deepEqual(col(r, 'buySetup'), [0, 0, 0, 0, 1, 2, 3, 0, 1, 2]);
  assert.equal(r[7].sellSetup, 1);
});

test('sell setup mirrors buy setup', () => {
  const r = computeTdSequential(bars(falling(15).map((c) => 200 - c)));
  assert.equal(r[12].sellSetup, 9);
  assert.equal(r[13].sellSetup, 10);
  assert.ok(r.every((x) => x.buySetup === 0));
});

test('buy setup 9 adds resistance at the highest high of its 9 bars; sell 9 adds support', () => {
  const r = computeTdSequential(bars(falling(14)));
  assert.equal(r[11].resistance, null);
  assert.equal(r[12].resistance, 96.5); // bars 4..12, highest high = bar 4 (96 + 0.5)
  assert.equal(r[13].resistance, 96.5);
  assert.ok(r.every((x) => x.support === null));

  const s = computeTdSequential(bars(falling(14).map((c) => 200 - c)));
  assert.equal(s[12].support, 103.5); // lowest low of bars 4..12 = bar 4 (104 - 0.5)
  assert.ok(s.every((x) => x.resistance === null));
});

test('resistance breaks when close or the whole bar goes above it', () => {
  const base = falling(13);
  const byClose = computeTdSequential([...bars(base), { t: 99, o: 90, h: 98, l: 88, c: 97 }]);
  assert.equal(byClose[13].resistance, null);
  const byLow = computeTdSequential([...bars(base), { t: 99, o: 97, h: 98, l: 96.75, c: 96.5 }]);
  assert.equal(byLow[13].resistance, null);
  const touch = computeTdSequential([...bars(base), { t: 99, o: 90, h: 97.5, l: 88, c: 95 }]);
  assert.equal(touch[13].resistance, 96.5); // poked through, closed back: still active
});

test('countdown is idle (14) until a setup 9 and its level exist', () => {
  const r = computeTdSequential(bars([5, 6, 7, 8, 9, 10]));
  assert.ok(r.every((x) => x.buyCountdown === 14 && x.sellCountdown === 14));
});

test('countdown starts on the setup 9 bar and completes at 13 on non-consecutive bars', () => {
  const r = computeTdSequential(bars(falling(27)));
  assert.equal(r[12].buyCountdown, 1);
  assert.equal(r[13].buyCountdown, 2);
  assert.equal(r[24].buyCountdown, 13);
  assert.equal(r[25].buyCountdown, 14);
  assert.equal(r[26].buyCountdown, 15);

  // Insert a bar that does not qualify (close above the low 2 bars earlier): paused as negative.
  const closes = falling(14);
  closes.push(closes[12] + 5, 70);
  const p = computeTdSequential(bars(closes));
  assert.equal(p[13].buyCountdown, 2);
  assert.equal(p[14].buyCountdown, -2); // level alive (91 < 96.5), bar does not qualify
  assert.equal(p[15].buyCountdown, 3);
});

test('countdown is cancelled when the opposite setup 9 completes', () => {
  const closes = [...falling(13), ...Array.from({ length: 14 }, (_, i) => 85 + 5 * i)];
  const r = computeTdSequential(bars(closes));
  const s9 = r.findIndex((x) => x.sellSetup === 9);
  assert.ok(s9 > 13);
  assert.equal(r[s9].buyCountdown, 14);
  assert.ok(r[s9].sellCountdown === 0 || r[s9].sellCountdown === 1);
  assert.equal(r[s9].support, bars(closes)[s9 - 8].l);
});

test('countdown is cancelled when its level breaks', () => {
  const closes = [...falling(13), 99, 98]; // 99 closes above the 96.5 resistance
  const r = computeTdSequential(bars(closes));
  assert.equal(r[12].buyCountdown, 1);
  assert.equal(r[13].buyCountdown, 14);
  assert.equal(r[14].buyCountdown, 14);
});

/** Buy countdown at 12 on bar 23, then bar `at24` instead of a clean 13th bar. */
function deferralSeries(at24) {
  const b = bars(falling(24)); // bar 19 reaches 8 with close 81; bar 23 reaches 12
  b.push(at24);
  b.push({ t: 26000, o: 70, h: 70.5, l: 69.5, c: 70 });
  return b;
}

test('13-versus-8: 13th bar is deferred when its low is above the close of count 8', () => {
  const r = computeTdSequential(deferralSeries({ t: 25000, o: 80, h: 90, l: 85, c: 77 }));
  assert.equal(r[19].buyCountdown, 8);
  assert.equal(r[23].buyCountdown, 12);
  assert.equal(r[24].buyCountdown, -12);
  assert.equal(r[24].buyDeferred, true);
  assert.equal(r[25].buyCountdown, 13); // first later qualifying bar that passes
  assert.equal(r[25].buyDeferred, false);
});

test('13-versus-8: sell side is the mirror image', () => {
  const mirror = (b) => b.map((x) => ({ t: x.t, o: 200 - x.o, h: 200 - x.l, l: 200 - x.h, c: 200 - x.c }));
  const r = computeTdSequential(mirror(deferralSeries({ t: 25000, o: 80, h: 90, l: 85, c: 77 })));
  assert.equal(r[24].sellCountdown, -12);
  assert.equal(r[24].sellDeferred, true);
  assert.equal(r[25].sellCountdown, 13);
  assert.ok(r.every((x) => x.buyCountdown === 14));
});

test('a new own setup 9 restarts the countdown', () => {
  // Two falling legs give two buy 9s; the second restarts the countdown at 1 or 0.
  const closes = [...falling(14), ...Array.from({ length: 14 }, (_, i) => 120 - i)];
  const r = computeTdSequential(bars(closes));
  const nines = r.map((x, i) => (x.buySetup === 9 ? i : -1)).filter((i) => i >= 0);
  assert.equal(nines.length, 2);
  assert.ok([0, 1].includes(r[nines[1]].buyCountdown));
});

test('output carries the bar timestamp and the exact contract fields', () => {
  const r = computeTdSequential(bars([1, 2, 3]));
  assert.deepEqual(Object.keys(r[0]), [
    't', 'buySetup', 'sellSetup', 'buyCountdown', 'sellCountdown',
    'resistance', 'support', 'buyDeferred', 'sellDeferred',
  ]);
  assert.deepEqual(col(r, 't'), [1000, 2000, 3000]);
  assert.deepEqual(computeTdSequential([]), []);
});

test('latest() summarises the final bar', () => {
  assert.equal(latest([]), null);
  const r = computeTdSequential(bars(falling(20)));
  const s = latest(r);
  assert.equal(s.t, 20000);
  assert.equal(s.buySetup, 16); // setup keeps counting past 9
  assert.equal(s.lastSetup9.buy, 13000);
  assert.equal(s.lastSetup9.sell, null);
  assert.equal(s.resistance, 96.5);
  assert.deepEqual(s.countdown.buy, { count: 8, paused: false });
  assert.equal(s.countdown.sell, null);
  assert.equal(s.lastCountdown13.buy, null);

  const done = latest(computeTdSequential(bars(falling(25))));
  assert.equal(done.completed13Now.buy, true);
  assert.equal(done.lastCountdown13.buy, 25000);
  assert.equal(done.countdown.buy, null);
});

for (const name of readdirSync(FIXTURES).filter((f) => f.endsWith('.json'))) {
  test(`parity: ${name}`, () => {
    const fx = JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
    const got = computeTdSequential(fx.bars);
    assert.equal(got.length, fx.expected.length);
    for (let i = 0; i < got.length; i++) assert.deepEqual(got[i], fx.expected[i], `bar ${i}`);
  });
}
