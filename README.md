# TD Sequential indicator for JavaScript and TypeScript

[![test](https://github.com/moolish-com/td-sequential/actions/workflows/test.yml/badge.svg)](https://github.com/moolish-com/td-sequential/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/td-sequential-indicator.svg)](https://www.npmjs.com/package/td-sequential-indicator)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

`td-sequential-indicator` computes Tom DeMark's TD Sequential indicator on OHLC candles: the TD Setup (the 1 to 9 count, often called TD9), the TD Countdown (1 to 13, with the 13-versus-8 deferral), the TDST support and resistance levels, plus information-only flags for a perfected setup and a price flip. It has no dependencies, ships TypeScript types, runs in Node and in the browser, and works on crypto, stocks, forex or any other candles.

It powers the free [TD Sequential counter](https://moolish.com/tools/td-sequential-counter/): check the current 9 and 13 on any crypto pair in your browser, nothing to install.

## Install

```sh
npm install td-sequential-indicator
```

## Usage

```js
import { computeTdSequential, latest } from 'td-sequential-indicator';

// Closed bars only, oldest first. Drop the candle that is still forming.
const bars = [{ t: 1750032000000, o: 105594, h: 108952, l: 104980, c: 106794 } /* ... */];

const records = computeTdSequential(bars); // one record per bar
const now = latest(records);                // summary of the last bar

if (now.lastSetup9.buy === now.t) console.log('Buy setup 9 (TD9) on the last bar');
```

## Output fields

| field | type | meaning |
|---|---|---|
| `t` | number | timestamp copied from the input bar |
| `buySetup`, `sellSetup` | number | setup counters; exactly 9 is a completed setup (TD9) and the count keeps rising after 9 |
| `buyCountdown`, `sellCountdown` | number | 1 to 13 while counting, negative while held, 13 when completed, 14 or more when no countdown is in progress |
| `resistance` | number or null | active TDST resistance: highest high of the last buy setup's nine bars |
| `support` | number or null | active TDST support: lowest low of the last sell setup's nine bars |
| `buyDeferred`, `sellDeferred` | boolean | a 13 that failed the 13-versus-8 test and was deferred |
| `buyPerfected`, `sellPerfected` | boolean | on a setup 9 bar, bar 8 or 9 went beyond bars 6 and 7 (information only) |
| `bullishFlip`, `bearishFlip` | boolean | the close moved to the other side of the close four bars earlier (information only) |

`latest(records)` returns the current setup counts, the countdown in progress per side (`{ count, paused }` or `null`), whether a 13 completed on the last bar, the time of the last completed setup 9 and countdown 13 per side, and the active TDST levels.

## Rules in short

- **TD Setup.** A bar counts for the buy side when its close is below the close 4 bars earlier, and for the sell side when it is above. The count resets on a bar that does not qualify and keeps going past 9. A setup does not wait for a price flip.
- **TDST levels.** A buy setup 9 adds a resistance at the highest high of its 9 bars, a sell setup 9 a support at the lowest low (the plain high and low, not the "true" high and low). A level ends when price closes beyond it or a whole bar sits beyond it.
- **TD Countdown.** After a buy setup 9, bars that close at or below the low 2 bars earlier count up to 13, not necessarily in a row; sell is the mirror image. The 13th bar must also pass the 13-versus-8 test or it is deferred. An opposite setup 9, or a broken TDST level, cancels the countdown.
- **Perfection** (flag only): a buy 9 whose bar 8 or 9 low is below the lows of bars 6 and 7; a sell 9 mirrors it with highs.

The full rules, edge cases and output contract are in [SPEC.md](SPEC.md).

## Verified against reference data

The test suite runs the library bar for bar against eight reference data sets (BTC and XRP daily, SOL, LINK and LTC 4-hour, BNB, ETH and DOGE weekly, 382 to 499 bars each) and checks every setup, countdown and level value. It covers buy and sell 9s, completed and deferred 13s, cancellations and level breaks. Run it with `npm test`.

## What is TD Sequential?

TD Sequential is Tom DeMark's method for spotting a stretched run of closes. A setup counts consecutive bars that close beyond the close four bars earlier, and a completed 9 can start a countdown that needs 13 qualifying bars. A 9 or a 13 describes past prices; it gives no direction or timing on its own. Read the [TD Sequential guide](https://moolish.com/learn/td-sequential/), [TDST levels explained](https://moolish.com/learn/td-sequential/tdst/) and [the perfected setup](https://moolish.com/learn/td-sequential/perfected-setup/).

## Notes

- Counting depends on where the list starts. Compare results only on the same bars from the same first bar.
- Prices are compared as plain floating-point numbers, with no rounding.
- Not included: TD Combo, risk levels, "true high / true low" level variants, volume, and any trading signal or alert. This library counts bars; it does not tell you what to do.

## Related

- [td-sequential-python](https://github.com/moolish-com/td-sequential-python): the same rules for Python and pandas.
- [td-sequential-pine-script](https://github.com/moolish-com/td-sequential-pine-script): the same rules as a TradingView indicator.
- [td-sequential-screener](https://github.com/moolish-com/td-sequential-screener): list the pairs that just printed a 9 or a 13, from the command line.
- [Free TD Sequential counter](https://moolish.com/tools/td-sequential-counter/): check one pair in the browser.

## Attribution and disclaimer

Moolish is not affiliated with, endorsed by or sponsored by Tom DeMark or DeMARK Analytics. TD Sequential is a method created by Tom DeMark, and DeMARK is a trademark of DeMARK Analytics.

This is educational software, not financial advice. Markets carry risk, and a count is a description of past prices, not a prediction.

## Licence

MIT, copyright 2026 Moolish. See [LICENSE](LICENSE).
