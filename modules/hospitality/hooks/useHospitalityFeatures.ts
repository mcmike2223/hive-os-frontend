import { useQuery } from "@tanstack/react-query";
import { fetchWaiterBootstrap } from "@/modules/hospitality/api";

export function useHospitalityFeatures(outletId?: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hospitality-features", outletId],
    queryFn: () => fetchWaiterBootstrap(outletId),
    staleTime: 1000 * 60 * 5,
  });

  const activeFeatures: Record<string, boolean> = data?.active_features ?? {};

  const isFeatureEnabled = (featureKey: string): boolean => {
    return Boolean(activeFeatures[featureKey]);
  };

  return {
    outlet: data?.outlet,
    activeFeatures,
    isFeatureEnabled,
    isLoading,
    error,
    refetch,
  };
}
