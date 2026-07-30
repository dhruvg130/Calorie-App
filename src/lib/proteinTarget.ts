/**
 * A protein target for the day, scaled by how hard the user actually trained.
 *
 * WHY BODYWEIGHT AND NOT A STORED NUMBER
 *
 * Protein needs scale with body mass, which is why every published guideline is
 * expressed per kilogram rather than as a flat figure. We already store weight,
 * so the target can be derived — no new column, no goal for the user to set and
 * then forget to update, and it tracks their weight as it changes.
 *
 * WHAT THE MULTIPLIERS ARE
 *
 * 1.6–2.2 g/kg is the range commonly cited for active people; the low end for
 * rest days, the top end after hard training. Strain picks the point in that
 * range. These are ordinary sports-nutrition rules of thumb, not a prescription.
 */

/** WHOOP strain runs 0–21 on a non-linear scale; these are its usual bands. */
const BANDS = [
  { maxStrain: 8, basis: 'Rest day', gPerKg: 1.6 },
  { maxStrain: 14, basis: 'Moderate day', gPerKg: 1.8 },
  { maxStrain: 18, basis: 'Hard day', gPerKg: 2.0 },
  { maxStrain: Infinity, basis: 'Very hard day', gPerKg: 2.2 },
] as const;

/** Above this, a "target" is more likely a data error than a plan. */
const MAX_SENSIBLE_GRAMS = 300;

export type ProteinTarget = {
  grams: number;
  /** Human-readable reason, e.g. "Hard day". */
  basis: string;
  gPerKg: number;
};

/**
 * Null when there is no weight to scale from — a target invented without one
 * would be a guess dressed up as a recommendation.
 *
 * A missing strain is treated as a rest day rather than skipped: most days have
 * no WHOOP score until they are, and the rest-day figure is the safe floor.
 */
export function proteinTarget(
  weightKg: number | null | undefined,
  strain: number | null | undefined,
): ProteinTarget | null {
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const effectiveStrain =
    typeof strain === 'number' && Number.isFinite(strain) && strain >= 0 ? strain : 0;

  const band = BANDS.find((candidate) => effectiveStrain < candidate.maxStrain) ?? BANDS[3];

  const grams = Math.min(Math.round(weightKg * band.gPerKg), MAX_SENSIBLE_GRAMS);

  return { grams, basis: band.basis, gPerKg: band.gPerKg };
}
