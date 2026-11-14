// btc-cent-forecast-01 — mean-reversion entry.
//
// The house baseline guesses the price does not move (persistence). That is the
// best guess for a pure random walk. This price series is not one: measured on
// the practice's own 72-hour history, the 240-minute return has an
// autocorrelation of about -0.30, i.e. a move tends to give back roughly 30% of
// itself four hours later. So the honest middle estimate is not the last close
// but the last close pulled back toward the level it departed from:
//
//   L1 = EWMA(prices, half-life 960 min)    // the 16-hour level
//   L2 = EWMA(prices, half-life 3600 min)   // the 60-hour level
//   guess = L1 + KEEP * (x - L1) + CARRY * (L1 - L2)
//
// where x is the close at the checkpoint, KEEP is one minus the measured 0.30
// reversion (so 0.70, the part of the deviation that does not revert), and CARRY
// carries a 16-hour level that sits above or below the 60-hour one, which persists.
//
// Nothing is random and nothing reads the clock, so two runs of one case write
// the same bytes. Standard library only, no network.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const MIN_PRICE = 0.00001;
const MAX_PRICE = 9_999_999.99999;

/** Half-life of the level the price reverts toward, in minutes. */
const HL_LEVEL = 960;
/** Half-life of the slower level that sets the drift, in minutes. */
const HL_DRIFT = 3600;
/** Share of the checkpoint's deviation from the level that is kept. */
const KEEP = 0.7;
/** Share of the level's gap to the slower level that is carried forward. */
const CARRY = 0.4;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** Exponentially weighted mean of a series, seeded on its first price. */
function ewma(prices: number[], halfLife: number): number {
  const lambda = Math.pow(0.5, 1 / halfLife);
  let v = prices[0] as number;
  for (let i = 1; i < prices.length; i += 1) v = lambda * v + (1 - lambda) * (prices[i] as number);
  return v;
}

function forecast(m: CaseMarket): number {
  const prices = m.prices;
  if (!Array.isArray(prices) || prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const x = prices[prices.length - 1] as number;
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  if (prices.length < 3) return price5(x);
  for (const p of prices) {
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) throw new Error(`market ${m.id} has an unusable price`);
  }
  const l1 = ewma(prices, HL_LEVEL);
  const l2 = ewma(prices, HL_DRIFT);
  return price5(l1 + KEEP * (x - l1) + CARRY * (l1 - l2));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
