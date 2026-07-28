import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { FoodResultRow } from '@/components/FoodResultRow';
import { EmptyState, EntryListSkeleton, ErrorState, Input, Screen, Text } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { toUserMessage } from '@/lib/errors';
import { nutritionSearch, type NutritionItem } from '@/services/nutrition';
import { encodeHandoff } from '@/services/nutrition/handoff';
import { colors, spacing } from '@/theme';

const MIN_QUERY_LENGTH = 2;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim());

  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ['nutrition-search', debouncedQuery],
    queryFn: ({ signal }) => nutritionSearch.search(debouncedQuery, signal),
    enabled,
    // Results for a given term do not change minute to minute; caching them
    // makes back-navigation instant and saves upstream quota.
    staleTime: 10 * 60_000,
  });

  const handleSelect = (item: NutritionItem) => {
    router.push({
      pathname: '/log/confirm',
      params: { item: encodeHandoff(item) },
    });
  };

  return (
    <Screen padded={false} edges={{ top: false }}>
      <View style={styles.searchBar}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a food…"
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search for a food"
          right={
            query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            ) : (
              <Ionicons name="search" size={18} color={colors.textTertiary} />
            )
          }
        />
      </View>

      <FlatList
        data={searchQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FoodResultRow item={item} onPress={handleSelect} />}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !enabled ? (
            <EmptyState
              icon="search"
              title="Find a food"
              description="Start typing to search the USDA nutrition database."
            />
          ) : searchQuery.isPending ? (
            <EntryListSkeleton rows={5} />
          ) : searchQuery.isError ? (
            <ErrorState
              message={toUserMessage(searchQuery.error)}
              onRetry={() => void searchQuery.refetch()}
            />
          ) : (
            <EmptyState
              icon="help-circle-outline"
              title="No matches"
              description={`Nothing found for "${debouncedQuery}". Try a simpler term, like "banana".`}
            />
          )
        }
        ListFooterComponent={
          searchQuery.data && searchQuery.data.length > 0 ? (
            <Text variant="caption" color="tertiary" style={styles.attribution}>
              Nutrition data from USDA FoodData Central
            </Text>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  attribution: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
