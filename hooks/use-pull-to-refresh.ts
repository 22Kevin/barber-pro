import { useState, useCallback } from "react";

/**
 * Simple pull-to-refresh hook.
 * Usage:
 *   const { refreshing, onRefresh } = usePullToRefresh(() => utils.myQuery.invalidate());
 *   <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A84C" colors={["#C9A84C"]} />}>
 */
export function usePullToRefresh(invalidateFn: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await invalidateFn();
    } finally {
      setRefreshing(false);
    }
  }, [invalidateFn]);

  return { refreshing, onRefresh };
}
