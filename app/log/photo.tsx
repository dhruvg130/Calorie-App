import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, EmptyState, Screen, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { foodRecognizer } from '@/services/recognition';
import { encodeHandoff } from '@/services/nutrition/handoff';
import { colors, radius, spacing } from '@/theme';

/** Accepted at pick time; the bucket also enforces its own MIME allowlist. */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export default function PhotoScreen() {
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const validateAsset = (asset: ImagePicker.ImagePickerAsset): string | null => {
    const extension = asset.uri.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return 'Please choose a JPEG, PNG or WebP image.';
    }
    if (typeof asset.fileSize === 'number' && asset.fileSize > 15 * 1024 * 1024) {
      return 'That image is too large. Please choose one under 15 MB.';
    }
    return null;
  };

  const pick = async (mode: 'camera' | 'library') => {
    setError(null);

    try {
      // Ask for permission at the moment of use, so the prompt has obvious
      // context, and request nothing beyond what this action needs.
      const permission =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(
          mode === 'camera'
            ? 'Camera access is needed to photograph your meal.'
            : 'Photo access is needed to pick an image.',
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false, // Strips GPS and device metadata before it ever leaves the phone.
      };

      const result =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      const problem = validateAsset(asset);
      if (problem) {
        setError(problem);
        return;
      }

      setImageUri(asset.uri);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  const handleContinue = async () => {
    if (!imageUri || working) return;

    setWorking(true);
    setError(null);

    try {
      const result = await foodRecognizer.recognize(imageUri);
      router.push({
        pathname: '/log/confirm',
        params: {
          item: encodeHandoff({ ...result.item, source: 'photo' }),
          imageUri,
        },
      });
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setWorking(false);
    }
  };

  if (!imageUri) {
    return (
      <Screen scroll>
        <EmptyState
          icon="camera-outline"
          title="Photograph your meal"
          description="Take a picture and we'll start an entry for it. You can adjust the calories on the next screen."
          action={
            <View style={styles.actions}>
              <Button label="Take a photo" onPress={() => void pick('camera')} />
              <Button
                label="Choose from library"
                variant="secondary"
                onPress={() => void pick('library')}
              />
            </View>
          }
        />
        {error ? (
          <View style={styles.errorWrapper}>
            <Banner message={error} />
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.content}>
        <Image
          source={{ uri: imageUri }}
          style={styles.preview}
          contentFit="cover"
          transition={200}
          accessibilityLabel="Your meal photo"
        />

        <Banner
          tone="info"
          message="Automatic food recognition isn't switched on yet, so the next screen starts from a rough estimate. Please check the calories before saving."
        />

        {error ? <Banner message={error} /> : null}

        <Button
          label="Continue"
          onPress={() => void handleContinue()}
          loading={working}
        />
        <Button
          label="Retake"
          variant="secondary"
          onPress={() => {
            setImageUri(null);
            setError(null);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
  },
  actions: {
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  errorWrapper: {
    paddingTop: spacing.lg,
  },
});
