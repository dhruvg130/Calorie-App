# WHOOP features — what's built and what's next

## Built

- **Connect / disconnect / sync** — `WhoopCard`, on the Recovery tab.
- **Recovery, strain, sleep** for the selected day.
- **Weekly summary** — seven-day averages plus one observation, on the Recovery tab.
- **Protein target** scaled by strain, derived from bodyweight (`proteinTarget.ts`).
- **Strain / calories / weight** stacked trend chart, 30 days.
- **Recovery-based nutrition** — green/yellow/red drives a suggestion on the Recovery tab.
- **A dedicated Recovery tab** with per-day strain, sleep, HRV, resting HR and burn.
- **Burned calories** as a line on the Home summary, shown but never added to the
  goal. See the `earned` prop comment in `CalorieSummaryCard` for why.

## Planned

Ordered by what each one needs, not by how good it is. Two of these are gated on
having history to compare against — building them first would mean shipping a
screen that says nothing for a fortnight.


### 1. Protein target from strain

Scale the protein goal with the day's activity — rest day lower, double session
higher — with a progress bar against it.

Needs a protein goal on `profiles` (there is only a calorie goal today) and a
rule mapping strain to grams. One day of data.

### 2. Energy availability

Burned vs eaten, with an honest read when the gap is large. Note this is the one
feature where the *warning* direction is the safe one: flagging chronic
under-fuelling is useful, and it should never nudge toward a bigger deficit.

Needs `cycle_kcal` (already synced) rather than `workout_kcal`, since this is
about total expenditure. One day of data.

### 3. Strain vs calories vs weight chart

Three series on one time axis. `WeightChart` already plots by date and can be
generalised rather than duplicated.

Needs ~2 weeks before the shape means anything.

### 3. Weekly summary — BUILT

Sunday roundup: average strain, calories, protein, recovery, weight change, plus
a sentence naming the most obvious pattern.

Needs ~3 weeks. Aggregation is a query, not a table.

### 5. "What changed?" — the flagship

Today versus the user's own recent baseline: recovery, protein, bedtime, strain,
and which of those tend to move together.

Deliberately last. It is entirely a comparison against a personal average, so
with a thin history it either says nothing or says something wrong — and a
feature that fabricates patterns from five days of data is worse than no feature.
Roughly 4 weeks of synced history before it earns its screen.

## A framing rule for all of these

These are suggestions from simple rules over the user's own numbers, and should
read that way — "recovery is low, consider eating at maintenance", not clinical
instruction. No diagnosis, no medical claims, and never a nudge toward a deeper
deficit on a bad-recovery day.
