import { Stack, useRouter } from 'expo-router';

import { Screen } from '@/components/ui';
import { ServingForm, type ServingFormValues } from '@/components/ServingForm';
import { formatRelativeDay } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { useCreateEntry } from '@/hooks/useEntries';
import { useRequireUser } from '@/providers/AuthProvider';
import { useSelectedDay } from '@/providers/SelectedDayProvider';
import { useState } from 'react';

/**
 * Enter a food by hand.
 *
 * The escape hatch for anything the databases do not have — a home-cooked
 * meal, a restaurant dish, or a label you would rather type than search for.
 * Reuses ServingForm, so the fields, validation and serving maths are the same
 * ones the search and scan paths go through; only the starting values differ.
 */
export default function ManualEntryScreen() {
  const router = useRouter();
  const user = useRequireUser();
  const createEntry = useCreateEntry(user.id);
  const { selectedDay, isViewingToday, timestampForNewEntry } = useSelectedDay();

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (values: ServingFormValues) => {
    setFormError(null);
    try {
      await createEntry.mutateAsync({
        name: values.name,
        brand: null,
        caloriesPerServing: values.caloriesPerServing,
        servingQuantity: values.servingQuantity,
        servingUnit: values.servingUnit,
        // Hand-entered food has no macro data unless the user knows it; leaving
        // these null is honest, and the summary hides the macro row when a day
        // has none rather than showing three misleading zeroes.
        proteinG: null,
        carbsG: null,
        fatG: null,
        source: 'manual',
        barcode: null,
        mealType: values.mealType,
        consumedAt: timestampForNewEntry(),
        imagePath: null,
      });
      router.dismissTo('/');
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  };

  return (
    <Screen scroll avoidKeyboard>
      <Stack.Screen
        options={{
          title: isViewingToday ? 'Add manually' : `Add to ${formatRelativeDay(selectedDay)}`,
        }}
      />

      <ServingForm
        initial={{
          name: '',
          brand: null,
          caloriesPerServing: 0,
          servingQuantity: 1,
          servingUnit: 'serving',
        }}
        submitLabel={isViewingToday ? 'Add to today' : `Add to ${formatRelativeDay(selectedDay)}`}
        submitting={createEntry.isPending}
        formError={formError}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </Screen>
  );
}
