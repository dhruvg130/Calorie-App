/**
 * The single shape every nutrition source normalises to.
 *
 * `caloriesPerServing` is the energy in ONE serving as described by
 * `servingUnit` (e.g. "100 g", "1 bar (45 g)"). `servingQuantity` is then just a
 * multiplier the user adjusts. Keeping the label human-readable and the maths on
 * a plain multiplier is what makes "1.5 × 1 cup" work without unit conversion.
 */
export type NutritionItem = {
  /** Stable id from the upstream source; used only as a React list key. */
  id: string;
  name: string;
  brand: string | null;
  caloriesPerServing: number;
  servingQuantity: number;
  servingUnit: string;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: 'search' | 'barcode';
  /** Present only for barcode lookups. */
  barcode?: string | null;
};

export interface NutritionSearchProvider {
  search(query: string, signal?: AbortSignal): Promise<NutritionItem[]>;
}

export interface BarcodeLookupProvider {
  lookup(barcode: string, signal?: AbortSignal): Promise<NutritionItem | null>;
}
