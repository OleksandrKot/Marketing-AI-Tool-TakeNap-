import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CompetitorAnalytics } from '@/lib/core/types';
import { fetchJSON } from '@/lib/api/client';

export function useDashboard(selectedCompetitors: string[]) {
  const competitorsQuery = useQuery<{ competitors: string[] }>({
    queryKey: ['analytics', 'competitors'],
    queryFn: () => fetchJSON('/api/analytics/competitors'),
    staleTime: 60_000,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    selectedCompetitors.forEach((c) => p.append('competitors', c));
    return p.toString();
  }, [selectedCompetitors]);

  const analyticsQuery = useQuery<CompetitorAnalytics | null>({
    queryKey: ['analytics', 'dashboard', selectedCompetitors],
    queryFn: () => fetchJSON(`/api/analytics/dashboard?${params}`),
    enabled: selectedCompetitors.length > 0,
    retry: 1,
  });

  return {
    analytics: analyticsQuery.data ?? null,
    isLoading: analyticsQuery.isLoading || competitorsQuery.isLoading,
    error:
      (analyticsQuery.error as { message?: string } | undefined)?.message ||
      (competitorsQuery.error as { message?: string } | undefined)?.message ||
      null,
    competitors: competitorsQuery.data?.competitors || [],
  };
}
