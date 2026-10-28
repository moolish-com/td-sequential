# TD Sequential indicator for JavaScript

`td-sequential-count` computes the TD Sequential indicator on a list of OHLC candles: the TD Setup (the 1 to 9 count, often called TD9), the TD Countdown (1 to 13) and the support and resistance levels left by completed setups. It has no dependencies, runs in Node and in the browser, and is about 110 lines written from the plain-English rules in [SPEC.md](SPEC.md), with tests.

It powers the free [TD Sequential counter](https://moolish.com/tools/td-sequential-counter/) on moolish.com, where you can check the current count on a crypto pair without installing anything.

## What is TD Sequential?

TD Sequential is Tom DeMark's method for spotting a stretched run of closes. A setup counts consecutive bars that close beyond the close four bars earlier; a completed 9 can start a countdown that needs 13 qualifying bars. A 9 or a 13 describes past prices and gives no direction on its own. A longer explanation is in the [TD Sequential guide](https://moolish.com/learn/td-sequential/).

## Install

There is no package to install. Copy `src/td-sequential.js` into your project, or clone this repository, and import it as an ES module.

## Usage

```js
import { computeTdSequential, latest } from './src/td-sequential.js';

// Closed bars only, oldest first. Drop the candle that is still forming.
const bars = [{ t: 1750032000000, o: 105594, h: 108952, l: 104980, c: 106794 } /* ... */];

const result = computeTdSequential(bars); // one record per bar
const now = latest(result);               // summary of the last bar
```

Each record: `t`, `buySetup`, `sellSetup`, `buyCountdown`, `sellCountdown`, `resistance`, `support`, `buyDeferred`, `sellDeferred`. See the output contract in [SPEC.md](SPEC.md).

`latest(result)` returns the current setup counts, the countdown in progress per side (`{ count, paused }` or `null`), whether a 13 just completed, the time of the last completed setup 9 and countdown 13 per side, and the active resistance and support.

Run the tests with `npm test` (Node 20 or newer).

## Rules in short

- **Setup.** A bar counts for the buy side when its close is lower than the close 4 bars earlier, and for the sell side when it is higher. The counter resets to 0 on a bar that does not qualify, and keeps going past 9 (10, 11, ...). A "setup 9" is the bar where the counter equals 9.
- **Levels.** A buy setup 9 adds a resistance at the highest high of its 9 bars; a sell setup 9 adds a support at the lowest low. A level is broken when price closes beyond it or a whole bar sits beyond it.
- **Countdown.** After a buy setup 9, bars whose close is at or below the low 2 bars earlier are counted up to 13, not necessarily consecutively. Sell is the mirror image. A 13th bar must also pass the "13 versus 8" test, otherwise it is deferred. An opposite setup 9, or a broken level, cancels the countdown.

## Not included

Perfection, TD Combo, risk levels, "true high / true low" level variants, volume, and any trading signal or alert. This library counts bars; it does not tell you what to do.

## Notes

- Counting depends on where the list starts. Compare results only on the same bars from the same first bar.
- Prices are compared as plain floating-point numbers, with no rounding.

## Attribution and disclaimer

Moolish is not affiliated with, endorsed by or sponsored by Tom DeMark or DeMARK Analytics. TD Sequential is a method created by Tom DeMark, and DeMARK is a trademark of DeMARK Analytics.

This is educational software, not financial advice. Markets carry risk, and a count is a description of past prices, not a prediction.

## Licence

MIT, copyright 2026 Moolish. See [LICENSE](LICENSE).
