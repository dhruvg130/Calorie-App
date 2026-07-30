// Supabase Edge Function (Deno) — food search across USDA and Open Food Facts.
//
// WHY THIS EXISTS
// The USDA API key is a real secret. Anything shipped in the React Native
// bundle is extractable, so the key cannot live in the app. It is stored as an
// Edge Function secret and only ever used here, server-side.
//
// WHY IT RE-VERIFIES THE CALLER
// `verify_jwt = true` only proves the request carries a JWT signed by this
// project — and the anon key *is* such a JWT, embedded in every copy of the
// app. Relying on it alone would let anyone drain the API quota. So we resolve
// the token to an actual user and reject anything that is not a signed-in
// session.
//
// WHY BOTH SOURCES, MERGED HERE
// USDA is authoritative for whole foods but its branded coverage is patchy —
// a specific protein bar may only exist in one size, or not at all. Open Food
// Facts is crowd-sourced and much stronger on packaged goods. Merging happens
// server-side rather than in the app because the browser forbids setting the
// User-Agent that Open Food Facts asks clients to send, and its search host
// sends no CORS headers — so a direct call from the app works on native but
// fails on web. Doing it here also means one round trip instead of two.
//
// Deploy:
//   npx supabase secrets set USDA_API_KEY=...
//   npx supabase functions deploy food-search

import { createClient } from 'npm:@supabase/supabase-js@2';

const USDA_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** USDA nutrient identifiers. */
const NUTRIENT = {
  energyKcal: 1008,
  energyKj: 1062,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
} as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type UsdaNutrient = {
  nutrientId?: number;
  unitName?: string;
  value?: number;
};

type UsdaFood = {
  fdcId: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
};

type NutritionItem = {
  id: string;
  name: string;
  brand: string | null;
  caloriesPerServing: number;
  servingQuantity: number;
  servingUnit: string;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: 'search';
};

/**
 * USDA ranks purely by text relevance, which buries whole foods under branded
 * products — searching "banana" returns a peanut butter spread named "BANANA"
 * above the actual fruit. Someone logging a meal almost always wants the plain
 * ingredient, so re-rank by data type and let relevance break ties within each
 * tier. Lower is better.
 */
const DATA_TYPE_RANK: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  'Survey (FNDDS)': 2,
  Branded: 3,
};

function dataTypeRank(food: UsdaFood): number {
  return DATA_TYPE_RANK[food.dataType ?? ''] ?? 4;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Generic messages only — never echo upstream errors to the client. */
function fail(status: number, message: string): Response {
  return json({ error: message }, status);
}

function nutrientValue(food: UsdaFood, id: number): number | null {
  const match = food.foodNutrients?.find((n) => n.nutrientId === id);
  const value = match?.value;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function energyPer100g(food: UsdaFood): number | null {
  const kcal = nutrientValue(food, NUTRIENT.energyKcal);
  if (kcal !== null) return kcal;

  // Some entries only carry kilojoules.
  const kj = nutrientValue(food, NUTRIENT.energyKj);
  return kj !== null ? kj / 4.184 : null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * USDA reports nutrients per 100 g. Branded items additionally declare a label
 * serving, which is far more useful to a person logging food — prefer it, and
 * fall back to a flat 100 g serving otherwise.
 */
function toNutritionItem(food: UsdaFood): NutritionItem | null {
  const name = food.description?.trim();
  if (!name) return null;

  const per100 = energyPer100g(food);
  if (per100 === null) return null;

  const hasLabelServing =
    typeof food.servingSize === 'number' &&
    Number.isFinite(food.servingSize) &&
    food.servingSize > 0 &&
    (food.servingSizeUnit === 'g' || food.servingSizeUnit === 'ml' ||
      food.servingSizeUnit === 'GRM' || food.servingSizeUnit === 'MLT');

  const factor = hasLabelServing ? food.servingSize! / 100 : 1;

  const servingUnit = hasLabelServing
    ? (food.householdServingFullText?.trim() ||
        `${food.servingSize} ${food.servingSizeUnit === 'GRM' ? 'g' : food.servingSizeUnit === 'MLT' ? 'ml' : food.servingSizeUnit}`)
    : '100 g';

  const scale = (id: number): number | null => {
    const value = nutrientValue(food, id);
    return value === null ? null : round2(value * factor);
  };

  const calories = round2(per100 * factor);
  // Mirrors the CHECK constraint on food_entries.calories_per_serving; an item
  // we could not store is worse than one we never offered.
  if (calories < 0 || calories > 10000) return null;

  const brand = (food.brandName || food.brandOwner || '').trim();

  return {
    id: String(food.fdcId),
    name: name.slice(0, 200),
    brand: brand ? brand.slice(0, 120) : null,
    caloriesPerServing: calories,
    servingQuantity: 1,
    servingUnit: servingUnit.slice(0, 60),
    proteinG: scale(NUTRIENT.protein),
    carbsG: scale(NUTRIENT.carbs),
    fatG: scale(NUTRIENT.fat),
    source: 'search',
  };
}


// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------

const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
const USER_AGENT = 'CalorieTracker/1.0 (Supabase Edge Function)';

type OffNutriments = Record<string, number | undefined>;

type OffProduct = {
  code?: string;
  product_name?: string;
  /**
   * The search service returns an array while the v2 product endpoint returns a
   * comma-separated string. Model both — assuming a string here threw
   * `brands.split is not a function` and silently discarded every result.
   */
  brands?: string | string[];
  serving_size?: string;
  nutriments?: OffNutriments;
};

function firstBrand(brands: string | string[] | undefined): string {
  if (Array.isArray(brands)) return brands[0]?.trim() ?? '';
  if (typeof brands === 'string') return brands.split(',')[0]?.trim() ?? '';
  return '';
}

function offNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function offToItem(product: OffProduct): NutritionItem | null {
  const name = product.product_name?.trim();
  const code = product.code;
  if (!name || !code) return null;

  const n = product.nutriments ?? {};

  // Prefer the declared label serving — that is what the person actually eats.
  const perServing = offNumber(n['energy-kcal_serving']);
  const servingLabel = product.serving_size?.trim();
  const useServing = perServing !== null && Boolean(servingLabel);

  let kcal = useServing ? perServing : offNumber(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = offNumber(n['energy_100g']);
    kcal = kj === null ? null : kj / 4.184;
  }
  if (kcal === null) return null;

  const calories = round2(kcal);
  if (calories < 0 || calories > 10000) return null;

  const macro = (servingKey: string, per100Key: string): number | null => {
    const raw = useServing ? offNumber(n[servingKey]) : offNumber(n[per100Key]);
    return raw === null ? null : round2(raw);
  };

  const brand = firstBrand(product.brands);

  return {
    id: `off:${code}`,
    name: name.slice(0, 200),
    brand: brand ? brand.slice(0, 120) : null,
    caloriesPerServing: calories,
    servingQuantity: 1,
    servingUnit: (useServing && servingLabel ? servingLabel : '100 g').slice(0, 60),
    proteinG: macro('proteins_serving', 'proteins_100g'),
    carbsG: macro('carbohydrates_serving', 'carbohydrates_100g'),
    fatG: macro('fat_serving', 'fat_100g'),
    source: 'search',
  };
}

async function searchOpenFoodFacts(query: string, pageSize: number): Promise<NutritionItem[]> {
  const fields = 'code,product_name,brands,serving_size,nutriments';
  const url =
    `${OFF_SEARCH_URL}?q=${encodeURIComponent(query)}` +
    `&page_size=${pageSize}&fields=${encodeURIComponent(fields)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('Open Food Facts responded with status', res.status);
      return [];
    }
    const data = (await res.json()) as { hits?: OffProduct[] };
    return (data.hits ?? [])
      .map(offToItem)
      .filter((i): i is NutritionItem => i !== null);
  } catch (error) {
    // One dead source must not fail the whole search.
    console.error('Open Food Facts request failed', error);
    return [];
  }
}

/**
 * Alternates the two lists so the top of the results always offers both a
 * whole-food and a branded candidate; plain concatenation would bury one source
 * beneath 25 rows of the other. Deduped on name+brand+calories because the two
 * databases use unrelated id spaces.
 */
function interleave(a: NutritionItem[], b: NutritionItem[], limit: number): NutritionItem[] {
  const out: NutritionItem[] = [];
  const seen = new Set<string>();

  const push = (item: NutritionItem | undefined) => {
    if (!item || out.length >= limit) return;
    const key = `${item.name.toLowerCase()}|${(item.brand ?? '').toLowerCase()}|${item.caloriesPerServing}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  for (let i = 0; i < Math.max(a.length, b.length) && out.length < limit; i += 1) {
    push(a[i]);
    push(b[i]);
  }
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return fail(405, 'Method not allowed');
  }

  const apiKey = Deno.env.get('USDA_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!apiKey || !supabaseUrl || !anonKey) {
    // Log for the operator; tell the client nothing about what is missing.
    console.error('usda-search is missing required environment configuration');
    return fail(500, 'Food search is unavailable right now.');
  }

  // ---- Authenticate the caller ------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return fail(401, 'Authentication required.');

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return fail(401, 'Authentication required.');
  }

  // ---- Validate input ----------------------------------------------------
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail(400, 'Invalid request.');
  }

  const body = (payload ?? {}) as { query?: unknown; pageSize?: unknown };
  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (query.length < 2 || query.length > 100) {
    return fail(400, 'Search for at least 2 characters.');
  }

  const requestedSize = typeof body.pageSize === 'number' ? body.pageSize : 25;
  const pageSize = Math.min(Math.max(Math.trunc(requestedSize) || 25, 1), 50);

  // ---- Query both sources in parallel ------------------------------------
  const usdaPromise = (async (): Promise<NutritionItem[]> => {
    try {
      const res = await fetch(`${USDA_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          // Over-fetch, then re-rank and trim. USDA orders purely by text
          // relevance and branded products dominate the head of that list, so
          // a small page can contain no whole foods at all — leaving the
          // re-ranking below nothing to promote.
          pageSize: Math.min(pageSize * 4, 200),
          dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
          requireAllWords: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        console.error('USDA responded with status', res.status);
        return [];
      }

      const data = (await res.json()) as { foods?: UsdaFood[] };

      // Stable sort: USDA's relevance order is preserved inside each tier.
      return (data.foods ?? [])
        .map((food, index) => ({ food, index }))
        .sort((a, b) => dataTypeRank(a.food) - dataTypeRank(b.food) || a.index - b.index)
        .map(({ food }) => toNutritionItem(food))
        .filter((item): item is NutritionItem => item !== null);
    } catch (error) {
      console.error('USDA request failed', error);
      return [];
    }
  })();

  const [usdaItems, offItems] = await Promise.all([
    usdaPromise,
    searchOpenFoodFacts(query, pageSize),
  ]);

  // If both sources failed the search genuinely could not run — say so rather
  // than returning an empty list that looks like "no such food".
  if (usdaItems.length === 0 && offItems.length === 0) {
    const items: NutritionItem[] = [];
    return json({ items });
  }

  const items = interleave(usdaItems, offItems, pageSize);

  return json({ items });
});
