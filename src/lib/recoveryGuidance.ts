import { recoveryBand, type RecoveryBand } from '@/api/whoop';

/**
 * Turns a recovery score into a suggestion for the day.
 *
 * Kept as a pure function, separate from the screen that shows it, because the
 * rules are the part worth reasoning about and testing — the layout is not.
 *
 * WHAT THIS IS NOT
 *
 * These are rules of thumb over the user's own numbers, phrased as suggestions.
 * Nothing here diagnoses anything, and nothing here ever recommends eating
 * *less* — a low recovery day is the worst possible moment to widen a deficit,
 * so the guidance only ever moves toward maintenance, never below it.
 */

export type RecoveryGuidance = {
  band: RecoveryBand;
  /** Short label for the day, e.g. "Recovery-focused day". */
  headline: string;
  /** One or two sentences of plain-language suggestion. */
  detail: string;
  /** Two or three words each — the things to actually do today. */
  focus: string[];
};

const GREEN_MIN = 67;
const YELLOW_MIN = 34;

export function recoveryGuidance(score: number, dailyGoal: number): RecoveryGuidance {
  const band = recoveryBand(score);
  const goal = dailyGoal.toLocaleString();

  if (band === 'green') {
    return {
      band,
      headline: 'Good to go',
      detail: `Recovery is strong. Your usual ${goal} calorie target is a sensible plan, and your body is in decent shape for a harder session if you want one.`,
      focus: ['Eat normally', 'Train as planned'],
    };
  }

  if (band === 'yellow') {
    return {
      band,
      headline: 'Middling recovery',
      detail: `Recovery is moderate. Protein and fluids tend to help more than cutting calories on a day like this — holding around ${goal} is reasonable rather than trying to push a bigger deficit.`,
      focus: ['Hit your protein', 'Drink more', 'Moderate training'],
    };
  }

  return {
    band,
    headline: 'Recovery-focused day',
    detail:
      'Recovery is low. Consider eating around maintenance today rather than pushing a deficit, leaning on carbohydrates and fluids, and getting an early night. A deficit on top of poor recovery usually costs more than it gains.',
    focus: ['Eat at maintenance', 'Carbs and fluids', 'Sleep early'],
  };
}

/** Shown under every suggestion, so the framing is never ambiguous. */
export const GUIDANCE_DISCLAIMER =
  'General suggestions based on your own data, not medical advice.';

export { GREEN_MIN, YELLOW_MIN };
