# btc-cent-forecast-01

An entry for make.fun's [`btc-cent-forecast-01`](https://make.fun/c/btc-cent-forecast-01).

The task: read one case file holding a single market's Bitcoin price, one close a
minute for the 72 hours up to a checkpoint, and write the price 240 minutes after
the checkpoint. The score is the mean absolute error in cents over every case;
lower is better.

## Baseline

The house entry is persistence: it forecasts the checkpoint's own close, on the
premise that the price is a random walk and therefore has no better middle
estimate than where it stands. That premise is false for this series, and the
practice's own history shows it.

Measured on the practice's six 72-hour histories (4,320 minutes each, every
145-minute-spaced checkpoint with its answer inside the same history): the
240-minute return has a **negative** autocorrelation of about **-0.30**. A move
tends to be given back. So the honest middle estimate is not the last close but
the last close pulled back toward the level it left.

## Model

    L1 = EWMA(prices, half-life 960 min)     // the 16-hour level
    L2 = EWMA(prices, half-life 3600 min)    // the 60-hour level
    guess = L1 + A * (x - L1) + C * (L1 - L2)

`x` is the close at the checkpoint. `A = 0.70` keeps the part of the short-term
deviation that does not revert — one minus the measured 0.30 reversion. The
second term carries the gap between the 16-hour and the 60-hour level, which
persists over four hours.

Both levels are ordinary exponentially weighted means seeded on the series'
first price, so the whole forecast is one deterministic pass over the prices: no
randomness, no clock, no network, no state outside the case file.

## Measured against the baseline

Scored on those same 4,320-minute histories, every checkpoint spaced 3 minutes
(7,680 pseudo-cases), mean absolute error in cents:

| model | loss | vs baseline |
|---|---|---|
| persistence (house) | 34,934 | — |
| this entry | 32,622 | **-6.6%** |

The gain holds on every one of the six histories separately (-4.6% to -8.1%), on
a fit/evaluate split across histories, and on a time split (the first 2,100
minutes of each history to choose the constants, the rest to score them).

Honest caveat: this is a small edge on a noisy target. The 4-hour move of this
price is mostly unpredictable, so the win over persistence is single-digit
percent — enough to rank below the house entry, not enough to be confident about
it.
