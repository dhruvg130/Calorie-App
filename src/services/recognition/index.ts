import type { NutritionItem } from '@/services/nutrition';

export type RecognitionResult = {
  item: NutritionItem;
  /** 0–1. Drives how loudly the UI tells the user to check the numbers. */
  confidence: number;
  /** True while this is the placeholder rather than a real model. */
  isEstimate: boolean;
};

export interface FoodRecognizer {
  recognize(imageUri: string): Promise<RecognitionResult>;
}

/**
 * Placeholder recogniser.
 *
 * The photo genuinely uploads to Supabase Storage and the entry genuinely
 * saves — only the identification is stubbed. It returns a deliberately
 * neutral, clearly-labelled estimate that the user is expected to correct on
 * the confirm screen, rather than inventing a specific food and a confident
 * number, which would be worse than saying nothing.
 *
 * To make this real, implement this same interface against a vision model
 * (called from an Edge Function, so the model API key stays server-side) and
 * swap the binding at the bottom of this file. Nothing else has to change.
 */
class PlaceholderRecognizer implements FoodRecognizer {
  async recognize(_imageUri: string): Promise<RecognitionResult> {
    return {
      item: {
        id: `photo-${Date.now()}`,
        name: 'Meal from photo',
        brand: null,
        caloriesPerServing: 400,
        servingQuantity: 1,
        servingUnit: '1 plate',
        proteinG: null,
        carbsG: null,
        fatG: null,
        source: 'search',
      },
      confidence: 0,
      isEstimate: true,
    };
  }
}

export const foodRecognizer: FoodRecognizer = new PlaceholderRecognizer();
