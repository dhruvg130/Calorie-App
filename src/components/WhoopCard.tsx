import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { earnedCalories, isWhoopConfigured, recoveryBand, type WhoopDay } from '@/api/whoop';
import { Banner, Button, Card, ConfirmDialog, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import {
  isWhoopCancellation,
  useConnectWhoop,
  useDisconnectWhoop,
  useSyncWhoop,
  useWhoopConnection,
} from '@/hooks/useWhoop';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing, type Palette } from '@/theme';

type WhoopCardProps = {
  userId: string;
  /** The selected day's metrics, or undefined when that day has none. */
  day: WhoopDay | undefined;
  /** False when the day being viewed is not today, which changes the wording. */
  isToday: boolean;
};

const bandColor = (colors: Palette) =>
  ({
    green: colors.primary,
    yellow: colors.warning,
    red: colors.danger,
  }) as const;

const BAND_LABEL = {
  green: 'Recovered',
  yellow: 'Moderate',
  red: 'Low recovery',
} as const;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

/**
 * WHOOP's presence on the Weight tab rather than Home: this is body and
 * recovery data, which is what this tab is already about, and it keeps Home
 * focused on food.
 */
export function WhoopCard({ userId, day, isToday }: WhoopCardProps) {
  const colors = useColors();
  const styles = useStyles();
  const connectionQuery = useWhoopConnection(userId);
  const connect = useConnectWhoop(userId);
  const sync = useSyncWhoop(userId);
  const disconnect = useDisconnectWhoop(userId);

  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // A build without the client ID does not advertise a feature it cannot run.
  if (!isWhoopConfigured) return null;

  const connection = connectionQuery.data ?? null;

  const handleConnect = async () => {
    setError(null);
    try {
      await connect.mutateAsync();
    } catch (caught) {
      if (isWhoopCancellation(caught)) return;
      setError(toUserMessage(caught));
    }
  };

  const handleSync = async () => {
    setError(null);
    try {
      await sync.mutateAsync(14);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await disconnect.mutateAsync();
      setConfirmDisconnect(false);
    } catch (caught) {
      setConfirmDisconnect(false);
      setError(toUserMessage(caught));
    }
  };

  // ---- Not connected ------------------------------------------------------
  if (!connection) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text variant="overline" color="secondary">
            WHOOP
          </Text>
        </View>

        <Text variant="body" color="secondary">
          Connect WHOOP to see recovery, strain and sleep alongside your weight, and how much you
          burned in training each day.
        </Text>

        {error ? <Banner message={error} /> : null}

        <Button
          label="Connect WHOOP"
          onPress={() => void handleConnect()}
          loading={connect.isPending}
        />
      </Card>
    );
  }

  // ---- Connected, but the refresh token has been rejected ------------------
  if (connection.needsReauth) {
    return (
      <Card style={styles.card}>
        <Text variant="overline" color="secondary">
          WHOOP
        </Text>
        <Banner
          tone="info"
          message="Your WHOOP connection expired. Reconnect to keep syncing."
        />
        {error ? <Banner message={error} /> : null}
        <Button
          label="Reconnect WHOOP"
          onPress={() => void handleConnect()}
          loading={connect.isPending}
        />
      </Card>
    );
  }

  // ---- Connected ----------------------------------------------------------
  const recovery = day?.recoveryScore ?? null;
  const band = recovery !== null ? recoveryBand(recovery) : null;
  const earned = earnedCalories(day);

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text variant="overline" color="secondary">
            WHOOP
          </Text>

          <Pressable
            onPress={() => void handleSync()}
            disabled={sync.isPending}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Sync WHOOP now"
          >
            <Ionicons
              name="refresh"
              size={16}
              color={sync.isPending ? colors.textTertiary : colors.textSecondary}
            />
          </Pressable>
        </View>

        {day ? (
          <>
            {band ? (
              <View style={styles.recoveryRow}>
                <View style={[styles.dot, { backgroundColor: bandColor(colors)[band] }]} />
                <Text variant="display">{recovery}%</Text>
                <Text variant="body" color="secondary" style={styles.bandLabel}>
                  {BAND_LABEL[band]}
                </Text>
              </View>
            ) : null}

            <View style={styles.metrics}>
              {day.strain !== null ? (
                <Metric label="Strain" value={day.strain.toFixed(1)} />
              ) : null}
              {day.sleepDurationMin !== null ? (
                <Metric label="Sleep" value={formatDuration(day.sleepDurationMin)} />
              ) : null}
              {earned > 0 ? (
                <Metric label="Burned" value={`${earned.toLocaleString()} cal`} />
              ) : null}
            </View>
          </>
        ) : (
          <Text variant="body" color="secondary">
            {isToday
              ? 'No WHOOP data for today yet. It appears once your day is scored.'
              : 'No WHOOP data for this day.'}
          </Text>
        )}

        {error ? <Banner message={error} /> : null}

        <Pressable
          onPress={() => setConfirmDisconnect(true)}
          hitSlop={8}
          style={styles.disconnect}
          accessibilityRole="button"
          accessibilityLabel="Disconnect WHOOP"
        >
          <Text variant="captionMedium" color="danger">
            Disconnect
          </Text>
        </Pressable>
      </Card>

      <ConfirmDialog
        visible={confirmDisconnect}
        title="Disconnect WHOOP"
        message="This removes the WHOOP data synced to this app. Your data stays in WHOOP itself."
        confirmLabel="Disconnect"
        destructive
        loading={disconnect.isPending}
        onConfirm={() => void handleDisconnect()}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const styles = useStyles();

  return (
    <View style={styles.metric}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  bandLabel: {
    marginLeft: spacing.xs,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  metric: {
    gap: 2,
  },
  disconnect: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
}));
