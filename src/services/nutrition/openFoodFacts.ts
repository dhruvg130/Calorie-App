import { AppError } from '@/lib/errors';

import type { BarcodeLookupProvider, NutritionItem } from './types';

/**
 * Barcode lookup against Open Food Facts.
 *
 * No API key, so this is called directly from the client — there is no secret
 * to protect and routing it through a function would only add latency. Open
 * Food Facts asks that clients identify themselves via User-Agent.
 */
const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'CalorieTracker/1.0 (Expo React Native app)';

/** Only the fields we use, so the response stays small. */
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'serving_size',
  'nutriments',
].join(',');

type OffNutriments = {
  'energy-kcal_100g'?: number;
  'energy-kcal_serving'?: number;
  energy_100g?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  proteins_serving?: number;
  carbohydrates_serving?: number;
  fat_serving?: number;
};

type OffResponse = {
  status?: number;
  product?: {
    code?: string;
    product_name?: string;
    brands?: string;
    serving_size?: string;
    nutriments?: OffNutriments;
  };
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
};

/**
 * Shared by barcode lookup and text search: both endpoints return the same
 * product shape, so the nutrition maths and the database-constraint guards live
 * in one place rather than being duplicated and drifting apart.
 */
function toNutritionItem(
  product: OffProduct,
  source: 'search' | 'barcode',
  fallbackId?: string,
): NutritionItem | null {
  const nutriments = product.nutriments ?? {};

  const name = product.product_name?.trim();
  if (!name) return null;

  // Prefer per-serving figures when the label declares them, since that is what
  // the user is actually eating; otherwise fall back to per 100 g.
  const perServing = positiveNumber(nutriments['energy-kcal_serving']);
  const servingLabel = product.serving_size?.trim();
  const useServing = perServing !== null && Boolean(servingLabel);

  const kcal = useServing
    ? perServing
    : (positiveNumber(nutriments['energy-kcal_100g']) ??
      // Some products only report kilojoules.
      (positiveNumber(nutriments.energy_100g) !== null
        ? positiveNumber(nutriments.energy_100g)! / 4.184
        : null));

  if (kcal === null) return null;

  // Mirrors the database CHECK — never surface an item we could not save.
  const calories = round2(kcal);
  if (calories > 10_000) return null;

  const macro = (servingKey: keyof OffNutriments, per100Key: keyof OffNutriments) => {
    const raw = useServing
      ? positiveNumber(nutriments[servingKey])
      : positiveNumber(nutriments[per100Key]);
    return raw === null ? null : round2(raw);
  };

  const brand = product.brands?.split(',')[0]?.trim() ?? '';
  const code = product.code ?? fallbackId;
  if (!code) return null;

  return {
    id: code,
    name: name.slice(0, 200),
    brand: brand ? brand.slice(0, 120) : null,
    caloriesPerServing: calories,
    servingQuantity: 1,
    servingUnit: (useServing && servingLabel ? servingLabel : '100 g').slice(0, 60),
    proteinG: macro('proteins_serving', 'proteins_100g'),
    carbsG: macro('carbohydrates_serving', 'carbohydrates_100g'),
    fatG: macro('fat_serving', 'fat_100g'),
    source,
    ...(source === 'barcode' ? { barcode: code } : {}),
  };
}

export const openFoodFactsProvider: BarcodeLookupProvider = {
  async lookup(barcode: string, signal?: AbortSignal): Promise<NutritionItem | null> {
    // Validate before building a URL so a malformed scan cannot shape the request.
    if (!/^[0-9]{6,14}$/.test(barcode)) {
      throw new AppError('That barcode does not look valid.');
    }

    let response: Response;
    try {
      response = await fetch(
        `${BASE_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
        {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          ...(signal ? { signal } : {}),
        },
      );
    } catch {
      throw new AppError('Could not reach the product database. Check your connection.');
    }

    // 404 is the documented "unknown barcode" answer, not a failure.
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new AppError('Could not look up that product. Please try again.');
    }

    const payload = (await response.json()) as OffResponse;
    if (payload.status === 0 || !payload.product) return null;

    const item = toNutritionItem(payload.product, 'barcode', barcode);
    return item;
  },
};
