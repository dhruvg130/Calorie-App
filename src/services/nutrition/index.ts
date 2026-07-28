import { openFoodFactsProvider } from './openFoodFacts';
import { usdaSearchProvider } from './usda';

export type {
  BarcodeLookupProvider,
  NutritionItem,
  NutritionSearchProvider,
} from './types';

/**
 * The app talks to these two bindings only, never to a specific vendor module.
 * Swapping in a different search or barcode source is a change to this file.
 */
export const nutritionSearch = usdaSearchProvider;
export const barcodeLookup = openFoodFactsProvider;
