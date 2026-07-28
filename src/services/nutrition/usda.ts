import { supabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';

import type { NutritionItem, NutritionSearchProvider } from './types';

/**
 * Text search, proxied through the `usda-search` Edge Function.
 *
 * The USDA API key is never in this bundle — the function holds it and calls
 * USDA server-side. `functions.invoke` attaches the caller's access token, and
 * the function rejects anything that does not resolve to a signed-in user.
 */
export const usdaSearchProvider: NutritionSearchProvider = {
  async search(query: string, signal?: AbortSignal): Promise<NutritionItem[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const { data, error } = await supabase.functions.invoke<{ items?: NutritionItem[] }>(
      'usda-search',
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
