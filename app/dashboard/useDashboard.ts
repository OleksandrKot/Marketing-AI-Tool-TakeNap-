import { useState, useEffect } from 'react';
import type { CompetitorAnalytics } from '@/lib/core/types';

export function useDashboard(selectedCompetitors: string[]) {
  const [analytics, setAnalytics] = useState<CompetitorAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<string[]>([]);

  // Fetch available competitors on mount
  useEffect(() => {
    async function fetchCompetitors() {
      try {
        const res = await fetch('/api/analytics/competitors');
        if (!res.ok) throw new Error('Failed to fetch competitors');
        const data = await res.json();
        setCompetitors(data.competitors || []);
      } catch (err) {
        console.error('Error fetching competitors:', err);
        setError('Failed to load competitors list');
      }
    }
    fetchCompetitors();
  }, []);

  // Fetch analytics when competitors change
  useEffect(() => {
    if (selectedCompetitors.length === 0) {
      setAnalytics(null);
      return;
    }

    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        selectedCompetitors.forEach((comp) => params.append('competitors', comp));

        const res = await fetch(`/api/analytics/dashboard?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await res.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
        setAnalytics(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [selectedCompetitors]);

  return { analytics, isLoading, error, competitors };
}
