import { foodSearchProvider } from './foodSearch';
import { openFoodFactsProvider } from './openFoodFacts';

export type {
  BarcodeLookupProvider,
  NutritionItem,
  NutritionSearchProvider,
} from './types';

/**
 * The app talks to these bindings only, never to a specific vendor module.
 *
 * Search merges USDA (authoritative for whole foods) with Open Food Facts
 * (far better on packaged goods) inside the `food-search` Edge Function — see
 * the comment in ./foodSearch.ts for why the merge is server-side.
 *
 * Barcode lookup stays a direct client call: Open Food Facts needs no API key,
 * and the product endpoint does send CORS headers, so there is no secret to
 * protect and a proxy would only add latency.
 */
export const nutritionSearch = foodSearchProvider;
export const barcodeLookup = openFoodFactsProvider;
