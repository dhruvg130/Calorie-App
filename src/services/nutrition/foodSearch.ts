import { supabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';

import type { NutritionItem, NutritionSearchProvider } from './types';

/**
 * Text search, proxied through the `food-search` Edge Function.
 *
 * The function queries USDA and Open Food Facts together and merges them. Two
 * reasons that happens server-side rather than here: the USDA API key must
 * never enter this bundle, and browsers both forbid the User-Agent header Open
 * Food Facts asks for and block its search host on CORS — so a direct call
 * would work on native and silently fail on web.
 *
 * `functions.invoke` attaches the caller's access token, and the function
 * rejects anything that does not resolve to a signed-in user.
 */
export const foodSearchProvider: NutritionSearchProvider = {
  async search(query: string, signal?: AbortSignal): Promise<NutritionItem[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const { data, error } = await supabase.functions.invoke<{ items?: NutritionItem[] }>(
      'food-search',
      {
        body: { query: trimmed, pageSize: 25 },
        ...(signal ? { signal } : {}),
      },
    );

    if (error) {
      // The function already returns user-safe text; anything else becomes a
      // generic message rather than leaking transport details.
      throw new AppError('Food search is unavailable right now. Please try again.');
    }

    return Array.isArray(data?.items) ? data.items : [];
  },
};
