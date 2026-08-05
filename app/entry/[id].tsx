import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { deleteMealImage, getSignedImageUrl } from '@/api/images';
import { ServingForm, type ServingFormValues } from '@/components/ServingForm';
import { Button, ConfirmDialog, ErrorState, Screen } from '@/components/ui';
import { useDeleteEntry, useEntry, useUpdateEntry } from '@/hooks/useEntries';
import { toUserMessage } from '@/lib/errors';
import { useRequireUser } from '@/providers/AuthProvider';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing, typography } from '@/theme';

export default function EditEntryScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const user = useRequireUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = typeof id === 'string' ? id : '';

  const entryQuery = useEntry(user.id, entryId);
  const updateEntry = useUpdateEntry(user.id);
  const deleteEntry = useDeleteEntry(user.id);

  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const entry = entryQuery.data;

  // The bucket is private, so an image is only viewable through a signed URL.
  const imageQuery = useQuery({
    queryKey: ['meal-image', entry?.imagePath],
    queryFn: () => getSignedImageUrl(entry!.imagePath!),
    enabled: Boolean(entry?.imagePath),
    // Refresh comfortably before the one-hour signature expires.
    staleTime: 45 * 60_000,
  });

  const handleSave = async (values: ServingFormValues) => {
    setFormError(null);
    try {
      await updateEntry.mutateAsync({ id: entryId, input: values });
      router.back();
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  };

  const confirmDelete = async () => {
    try {
      const imagePath = entry?.imagePath ?? null;
      await deleteEntry.mutateAsync(entryId);

      // Only after the row is gone — otherwise a failed delete would leave an
      // entry pointing at a file we already removed.
      if (imagePath) {
        await deleteMealImage(imagePath).catch(() => undefined);
      }

      router.back();
    } catch (error) {
      setDeleteOpen(false);
      setFormError(toUserMessage(error));
    }
  };

  if (entryQuery.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Entry' }} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (entryQuery.isError || !entry) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Entry' }} />
        <ErrorState
          message={
            entryQuery.error
              ? toUserMessage(entryQuery.error)
              : 'We could not find that entry.'
          }
          onRetry={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll avoidKeyboard>
      <Stack.Screen
        options={{
          title: 'Edit entry',
          headerShown: true,
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            color: colors.text,
            fontSize: typography.subheading.fontSize,
            fontWeight: '600',
          },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.content}>
        {imageQuery.data ? (
          <Image
            source={{ uri: imageQuery.data }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Photo of ${entry.name}`}
          />
        ) : null}

        <ServingForm
          initial={{
            name: entry.name,
            brand: entry.brand,
            caloriesPerServing: entry.caloriesPerServing,
            servingQuantity: entry.servingQuantity,
            servingUnit: entry.servingUnit,
            proteinG: entry.proteinG,
            mealType: entry.mealType,
          }}
          submitLabel="Save changes"
          submitting={updateEntry.isPending}
          formError={formError}
          onSubmit={(values) => void handleSave(values)}
          footer={
            <Button
              label="Delete entry"
              variant="danger"
              onPress={() => setDeleteOpen(true)}
              loading={deleteEntry.isPending}
            />
          }
        />
      </View>

      <ConfirmDialog
        visible={deleteOpen}
        title="Delete entry"
        message={'This will remove it from today\u2019s total.'}
        confirmLabel="Delete"
        destructive
        loading={deleteEntry.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
  },
}));
