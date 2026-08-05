import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ServingForm, type ServingFormValues } from '@/components/ServingForm';
import { Banner, ErrorState, Screen } from '@/components/ui';
import { useCreateEntry } from '@/hooks/useEntries';
import { formatRelativeDay } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { useRequireUser } from '@/providers/AuthProvider';
import { useSelectedDay } from '@/providers/SelectedDayProvider';
import { uploadMealImage } from '@/api/images';
import { decodeHandoff } from '@/services/nutrition/handoff';
import { spacing } from '@/theme';

/**
 * The one screen that writes a food entry, reached identically from search,
 * barcode and photo. Keeping a single save path means validation, image upload
 * and cache invalidation exist once rather than three times.
 */
export default function ConfirmScreen() {
  const router = useRouter();
  const user = useRequireUser();
  const params = useLocalSearchParams<{ item?: string; imageUri?: string }>();

  const createEntry = useCreateEntry(user.id);
  const { selectedDay, isViewingToday, timestampForNewEntry } = useSelectedDay();
  // The meal picker lives inside ServingForm, which is also what supplies the
  // saved value below. A second copy here was pure decoration: its state never
  // reached handleSubmit.
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Route params are untrusted by the time they come back to us, so the payload
  // is re-validated rather than cast.
  const item = useMemo(() => decodeHandoff(params.item), [params.item]);
  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : null;

  if (!item) {
    return (
      <Screen>
        <ErrorState
          message="We lost track of that food. Please pick it again."
          onRetry={() => router.back()}
        />
      </Screen>
    );
  }

  const handleSubmit = async (values: ServingFormValues) => {
    if (busy) return;

    setBusy(true);
    setFormError(null);

    try {
      // Upload first: if storage rejects the image we must not leave a saved
      // entry pointing at a file that does not exist.
      let imagePath: string | null = null;
      if (imageUri) {
        imagePath = await uploadMealImage(user.id, imageUri);
      }

      await createEntry.mutateAsync({
        name: values.name,
        brand: item.brand,
        caloriesPerServing: values.caloriesPerServing,
        servingQuantity: values.servingQuantity,
        servingUnit: values.servingUnit,
        // From the form, not the lookup: the field is seeded with whatever the
        // source reported and the user may have corrected it.
        proteinG: values.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        source: item.source,
        barcode: item.barcode ?? null,
        mealType: values.mealType,
        // Honours the day selected on Home, so logging while viewing a past
        // day back-dates the entry instead of silently landing on today.
        consumedAt: timestampForNewEntry(),
        imagePath,
      });

      // Back to Today rather than the search results, which are now stale in
      // the user's mind — they just finished the task.
      router.dismissTo('/');
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll avoidKeyboard>
      <Stack.Screen
        options={{
          title: isViewingToday ? 'Add to today' : `Add to ${formatRelativeDay(selectedDay)}`,
        }}
      />

      <View style={styles.content}>
        {isViewingToday ? null : (
          <Banner
            tone="info"
            message={`This will be added to ${formatRelativeDay(selectedDay)}, not today.`}
          />
        )}

        <ServingForm
          initial={{
            name: item.name,
            brand: item.brand,
            caloriesPerServing: item.caloriesPerServing,
            servingQuantity: item.servingQuantity,
            servingUnit: item.servingUnit,
            proteinG: item.proteinG,
          }}
          submitLabel={isViewingToday ? 'Add to today' : `Add to ${formatRelativeDay(selectedDay)}`}
          submitting={busy}
          formError={formError}
          onSubmit={(values) => void handleSubmit(values)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // Flush to the navigation header. The screen's headline is that header's
    // title, so any space below it read as a gap rather than as separation —
    // the total card can sit straight under it.
    paddingTop: 0,
    gap: spacing.lg,
  },
});
