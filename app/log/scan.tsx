import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Banner, Button, EmptyState, Screen, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { barcodeLookup } from '@/services/nutrition';
import { encodeHandoff } from '@/services/nutrition/handoff';
import { absoluteFill, colors, radius, spacing } from '@/theme';

/** Product barcodes only — QR and friends would just waste lookups. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'itf14'] as const;

/**
 * Browsers expose `getUserMedia` only in a secure context — HTTPS, or
 * localhost. Served over plain HTTP on a LAN address (which is how the Expo dev
 * server is reached from a phone) the camera API is simply absent, so a
 * permission request can never resolve and the button looks broken. Detect it
 * up front and say so.
 */
function webCameraUnavailable(): boolean {
  if (Platform.OS !== 'web') return false;
  const isSecure =
    typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : false;
  const hasMediaDevices = Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
  return !isSecure || !hasMediaDevices;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  // The camera fires this continuously while a barcode is in frame. Without a
  // latch we would issue a lookup per frame.
  const handled = useRef(false);

  const handleScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (handled.current) return;
      handled.current = true;

      setError(null);
      setNotFound(null);
      setLooking(true);

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      try {
        const item = await barcodeLookup.lookup(data);

        if (!item) {
          setNotFound(data);
          return;
        }

        router.replace({
          pathname: '/log/confirm',
          params: { item: encodeHandoff(item) },
        });
      } catch (caught) {
        setError(toUserMessage(caught));
      } finally {
        setLooking(false);
      }
    },
    [router],
  );

  const resetScanner = () => {
    handled.current = false;
    setError(null);
    setNotFound(null);
  };

  // Permission state is still loading.
  if (!permission) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (webCameraUnavailable()) {
    return (
      <Screen scroll>
        <EmptyState
          icon="lock-closed-outline"
          title="Scanning needs the mobile app"
          description="Browsers only allow camera access over HTTPS, and the dev server runs over plain HTTP. Open this project in Expo Go on your phone to scan barcodes \u2014 or search for the product by name."
          action={
            <Button
              label="Search instead"
              onPress={() => router.replace('/log/search')}
            />
          }
        />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen scroll>
        <EmptyState
          icon="camera-outline"
          title="Camera access needed"
          description={
            permission.canAskAgain
              ? 'We use the camera only to read barcodes. Nothing is recorded or uploaded.'
              : 'Camera access is turned off. Enable it in your device settings to scan barcodes.'
          }
          action={
            permission.canAskAgain ? (
              <Button label="Allow camera" onPress={() => void requestPermission()} />
            ) : (
              <Button
                label="Search instead"
                variant="secondary"
                onPress={() => router.replace('/log/search')}
              />
            )
          }
        />
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen scroll>
        <EmptyState
          icon="help-circle-outline"
          title="Product not found"
          description={`Barcode ${notFound} isn't in the Open Food Facts database. You can search for it by name instead.`}
          action={
            <View style={styles.actions}>
              <Button label="Search by name" onPress={() => router.replace('/log/search')} />
              <Button label="Scan another" variant="secondary" onPress={resetScanner} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={{ top: false }}>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={handled.current ? undefined : (result) => void handleScanned(result)}
        />

        {/* Reticle: a plain overlay, so it costs nothing and reads clearly. */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
        </View>

        {looking ? (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={colors.textInverse} />
            <Text variant="captionMedium" color="inverse">
              Looking it up…
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {error ? <Banner message={error} /> : null}

        <View style={styles.hintRow}>
          <Ionicons name="barcode-outline" size={18} color={colors.textSecondary} />
          <Text variant="caption" color="secondary" style={styles.hint}>
            Line the barcode up inside the frame.
          </Text>
        </View>

        {error ? <Button label="Try again" variant="secondary" onPress={resetScanner} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrapper: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  overlay: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: '78%',
    aspectRatio: 1.6,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  statusPill: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  hint: {
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
    alignSelf: 'stretch',
  },
});
