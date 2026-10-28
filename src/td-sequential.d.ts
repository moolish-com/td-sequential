/** One closed OHLC bar, oldest first. `t` is any timestamp you choose (copied to the output). */
export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** One record per input bar. See SPEC.md for the exact rules. */
export interface TdRecord {
  t: number;
  /** Buy setup counter: 0 or more; exactly 9 marks a completed buy setup (TD9). */
  buySetup: number;
  /** Sell setup counter: 0 or more; exactly 9 marks a completed sell setup (TD9). */
  sellSetup: number;
  /** Signed buy countdown: 1..13 counting, negative = held, 13 = completed, 14 or more = none in progress. */
  buyCountdown: number;
  /** Signed sell countdown, same meaning as buyCountdown. */
  sellCountdown: number;
  /** Active TDST resistance (highest high of the last buy setup's nine bars), or null. */
  resistance: number | null;
  /** Active TDST support (lowest low of the last sell setup's nine bars), or null. */
  support: number | null;
  /** True on a bar where the buy 13 was deferred by the 13-versus-8 test. */
  buyDeferred: boolean;
  /** True on a bar where the sell 13 was deferred by the 13-versus-8 test. */
  sellDeferred: boolean;
  /** Information only: buy setup 9 whose bar 8 or 9 low is below the lows of bars 6 and 7. */
  buyPerfected: boolean;
  /** Information only: sell setup 9 whose bar 8 or 9 high is above the highs of bars 6 and 7. */
  sellPerfected: boolean;
  /** Information only: close moved from below to above the close four bars earlier. */
  bullishFlip: boolean;
  /** Information only: close moved from above to below the close four bars earlier. */
  bearishFlip: boolean;
}

export interface CountdownState {
  count: number;
  /** True when the last bar did not qualify and the count is held. */
  paused: boolean;
}

export interface TdSummary {
  t: number;
  buySetup: number;
  sellSetup: number;
  countdown: { buy: CountdownState | null; sell: CountdownState | null };
  completed13Now: { buy: boolean; sell: boolean };
  lastSetup9: { buy: number | null; sell: number | null };
  lastCountdown13: { buy: number | null; sell: number | null };
  resistance: number | null;
  support: number | null;
}

/** Compute TD Sequential (setup, countdown, TDST levels, perfection, flips) for every bar. */
export function computeTdSequential(bars: readonly Bar[]): TdRecord[];

/** Summary of the final bar of a computeTdSequential() result, or null for an empty result. */
export function latest(result: readonly TdRecord[]): TdSummary | null;
