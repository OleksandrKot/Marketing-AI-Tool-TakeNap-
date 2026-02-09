/* eslint-disable react/prop-types */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAds } from '@/app/actions';
import { PageNavigation } from '@/components/navigation/PageNavigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type {
  CompetitorAnalytics,
  CompetitorBreakdown,
  DistributionItem,
  VisualPattern,
  Ad,
} from '@/lib/core/types';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
// Removed ThemeDistribution side list per request
import FunnelsList from '@/components/dashboard/FunnelsList';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface DashboardClientProps {
  initialCompetitors: string[];
}

export default function DashboardClient({ initialCompetitors }: DashboardClientProps) {
  const router = useRouter();
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<CompetitorAnalytics | null>(null);
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all ads once on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = (await getAds()) as Ad[] | { data: Ad[] } | null;
        const ads = Array.isArray(raw) ? raw : (raw as { data: Ad[] })?.data || [];
        setAllAds(ads);
      } catch (err) {
        console.error('Failed to load ads:', err);
      }
    })();
  }, []);

  // Fetch analytics when selection changes
  useEffect(() => {
    if (selectedCompetitors.length === 0) {
      setAnalytics(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch('/api/analytics/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitors: selectedCompetitors }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.error || `Failed to fetch analytics (${res.status})`;
          throw new Error(errorMessage);
        }
        return res.json();
      })
      .then((data: CompetitorAnalytics) => {
        setAnalytics(data);
        setIsLoading(false);
        setError(null);
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        setAnalytics(null);
        setIsLoading(false);
      });
  }, [selectedCompetitors]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCompetitor = (competitor: string) => {
    setSelectedCompetitors((prev) =>
      prev.includes(competitor) ? prev.filter((c) => c !== competitor) : [...prev, competitor]
    );
  };

  const clearAll = () => {
    setSelectedCompetitors([]);
  };

  const removeCompetitor = (competitor: string) => {
    setSelectedCompetitors((prev) => prev.filter((c) => c !== competitor));
  };

  const filteredCompetitors = initialCompetitors.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const buttonSummary = (() => {
    if (selectedCompetitors.length === 0) return 'Select competitors...';
    if (selectedCompetitors.length <= 2) return selectedCompetitors.join(', ');
    return `${selectedCompetitors.slice(0, 2).join(', ')} +${selectedCompetitors.length - 2}`;
  })();

  const formatDistributionChart = (data: DistributionItem[], maxItems = 10) => {
    return data.slice(0, maxItems).map((item) => {
      const shortName = item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name;
      return {
        name: `${shortName} (${item.count})`,
        value: item.count,
        fullName: item.name,
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Analytics and insights for your creatives</p>
        </div>

        <div className="mb-8">
          <PageNavigation currentPage="dashboard" />
        </div>

        {/* Competitor Selector Dropdown */}
        <div className="mb-8 relative" ref={dropdownRef}>
          <label
            htmlFor="dashboard-competitor-toggle"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Select Competitors
          </label>
          <button
            id="dashboard-competitor-toggle"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full md:w-96 px-3 py-2 bg-white border border-slate-300 rounded-md text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <span className="text-slate-900 truncate">{buttonSummary}</span>
            <svg
              className={`ml-2 h-4 w-4 text-slate-500 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute z-50 mt-2 w-full md:w-96 bg-white border border-slate-200 rounded-md shadow-lg p-3">
              <input
                type="text"
                aria-label="Search competitors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search competitors..."
                className="w-full mb-3 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
              />

              {selectedCompetitors.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedCompetitors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => removeCompetitor(c)}
                      className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                    >
                      {c} ×
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-56 overflow-auto rounded-md" role="listbox">
                {filteredCompetitors.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-slate-500">No competitors found</div>
                ) : (
                  filteredCompetitors.map((competitor) => {
                    const selected = selectedCompetitors.includes(competitor);
                    return (
                      <button
                        key={competitor}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => toggleCompetitor(competitor)}
                        className={`w-full flex items-center justify-between py-1.5 px-2 text-left hover:bg-slate-50 rounded ${
                          selected ? 'bg-violet-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input type="checkbox" checked={selected} readOnly className="h-4 w-4" />
                          <span className="text-sm text-slate-700 truncate">{competitor}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">Loading analytics...</span>
          </div>
        )}

        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && selectedCompetitors.length === 0 && (
          <Card className="border-slate-200">
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-slate-600 text-lg">
                Select one or more competitors to view analytics
              </p>
            </CardContent>
          </Card>
        )}

        {analytics && !isLoading && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500 mb-1">Total Creatives</div>
                  <div className="text-3xl font-bold text-slate-900">
                    {analytics.totalCreatives}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500 mb-1">Avg Variations</div>
                  <div className="text-3xl font-bold text-slate-900">
                    {analytics.averageVariationCount}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500 mb-1">Funnels Used</div>
                  <div className="text-3xl font-bold text-slate-900">{analytics.funnelsUsed}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500 mb-1">Themes Used</div>
                  <div className="text-3xl font-bold text-slate-900">{analytics.themesUsed}</div>
                </CardContent>
              </Card>
            </div>

            {/* Competitor Breakdown + Summary side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2">
                <Card className="border-slate-200 rounded-2xl h-full">
                  <CardHeader>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Creative Count per Competitor
                    </h2>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analytics.competitorBreakdown.map((item: CompetitorBreakdown) => (
                        <div
                          key={item.competitor}
                          className="bg-slate-50 rounded-lg p-4 border border-slate-200"
                        >
                          <div className="text-sm text-slate-500 mb-1">{item.competitor}</div>
                          <div className="text-2xl font-bold text-slate-900">{item.count}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {item.percentage}% of total
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card className="border-slate-200 rounded-2xl h-full">
                  <CardHeader>
                    <h2 className="text-xl font-semibold text-slate-900">Summary by Parameters</h2>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-2">
                          Most Common Lengths:
                        </h3>
                        <p className="text-slate-600">
                          {analytics.durationDistribution.mostCommon.length > 0
                            ? analytics.durationDistribution.mostCommon.join(', ')
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-2">Main Mechanics:</h3>
                        <p className="text-slate-600">
                          {analytics.mechanicDistribution
                            .slice(0, 5)
                            .map((m) => m.name)
                            .join(', ')}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-2">
                          Most Common Character:
                        </h3>
                        <p className="text-slate-600">
                          {analytics.characterDistribution.mostCommon || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Theme Distribution */}
            {analytics.themeDistribution.length > 0 && (
              <Card className="mb-8 border-slate-200 rounded-2xl">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Theme Distribution</h2>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={formatDistributionChart(analytics.themeDistribution)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      {/* Names now include counts in parentheses */}
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number, name: string, props: unknown) => {
                          const p = props as { payload?: { fullName?: string } } | undefined;
                          return [`${value} creatives`, p?.payload?.fullName || name];
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        name="Creatives"
                        onClick={(data: unknown) => {
                          const d = data as { fullName?: string; name?: string } | undefined;
                          const themeName = d?.fullName || (d?.name as string | undefined) || '';

                          if (themeName && allAds.length > 0) {
                            // Filter ads with this theme
                            const adsWithTheme = allAds.filter(
                              (ad) => ad.topic === themeName || ad.concept === themeName
                            );

                            if (adsWithTheme.length > 0) {
                              // Get all page names from selected competitors (or all if none selected)
                              const selectedPages =
                                selectedCompetitors.length > 0
                                  ? selectedCompetitors
                                  : Array.from(
                                      new Set(allAds.map((ad) => ad.page_name).filter(Boolean))
                                    );

                              // Navigate with both topic and page parameters
                              const params = new URLSearchParams();
                              params.set('topic', themeName);
                              if (selectedPages.length > 0) {
                                params.set(
                                  'page',
                                  selectedPages
                                    .filter((p): p is string => Boolean(p))
                                    .map((p) => encodeURIComponent(p))
                                    .join(',')
                                );
                              }
                              router.push(`/advance-filter?${params.toString()}`);
                            }
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Hooks Distribution */}
            {analytics.hookDistribution && analytics.hookDistribution.length > 0 && (
              <Card className="mb-8 border-slate-200 rounded-2xl">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Hooks Distribution</h2>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={formatDistributionChart(analytics.hookDistribution)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number, name: string, props: unknown) => {
                          const p = props as { payload?: { fullName?: string } } | undefined;
                          return [`${value} creatives`, p?.payload?.fullName || name];
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="value"
                        fill="#10b981"
                        name="Creatives"
                        onClick={(data: unknown) => {
                          const d = data as { fullName?: string; name?: string } | undefined;
                          const hookName = d?.fullName || (d?.name as string | undefined) || '';

                          if (hookName && allAds.length > 0) {
                            // Filter ads with this hook
                            const adsWithHook = allAds.filter((ad) => ad.hook === hookName);

                            if (adsWithHook.length > 0) {
                              // Get all page names from selected competitors (or all if none selected)
                              const selectedPages =
                                selectedCompetitors.length > 0
                                  ? selectedCompetitors
                                  : Array.from(
                                      new Set(allAds.map((ad) => ad.page_name).filter(Boolean))
                                    );

                              // Navigate with both hook and page parameters
                              const params = new URLSearchParams();
                              params.set('hook', hookName);
                              if (selectedPages.length > 0) {
                                params.set(
                                  'page',
                                  selectedPages
                                    .filter((p): p is string => Boolean(p))
                                    .map((p) => encodeURIComponent(p))
                                    .join(',')
                                );
                              }
                              router.push(`/advance-filter?${params.toString()}`);
                            }
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Funnel Distribution */}
            {analytics.funnelDistribution.length > 0 && (
              <Card className="mb-8 border-slate-200 rounded-2xl">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Funnel Distribution</h2>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <FunnelsList
                      funnels={analytics.funnelDistribution.slice(0, 50).map((f) => ({
                        name: f.name,
                        count: f.count,
                        id: f.name,
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visual Patterns */}
            {analytics.visualPatterns.length > 0 && (
              <Card className="mb-8 border-slate-200 rounded-2xl">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Visual Patterns Analysis</h2>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analytics.visualPatterns.map((pattern: VisualPattern) => (
                      <div
                        key={pattern.id}
                        className="bg-slate-50 rounded-lg p-4 border border-slate-200"
                      >
                        <div className="text-lg font-semibold text-slate-900 mb-1">
                          {pattern.name}
                        </div>
                        <div className="text-sm text-slate-600 mb-2">{pattern.description}</div>
                        <div className="text-xs text-slate-500">{pattern.count} creatives</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Format Distribution */}
            <Card className="mb-8 border-slate-200 rounded-2xl">
              <CardHeader>
                <h2 className="text-xl font-semibold text-slate-900">Format Distribution</h2>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Video', value: analytics.formatDistribution.video },
                        { name: 'Static', value: analytics.formatDistribution.static },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1, 2, 3].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Trends */}
            {analytics.trendsOverTime.themesOverTime.length > 0 && (
              <Card className="mb-8 border-slate-200 rounded-2xl">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Trends Over Time</h2>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Themes Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.trendsOverTime.themesOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {analytics.trendsOverTime.themesOverTime[0]?.series
                          .slice(0, 5)
                          .map((s, idx) => (
                            <Line
                              key={s.name}
                              type="monotone"
                              dataKey={(d: unknown) => {
                                const dd = d as {
                                  series?: Array<{ name: string; value?: number }>;
                                };
                                const item = dd.series?.find((ss) => ss.name === s.name);
                                return item?.value || 0;
                              }}
                              name={s.name}
                              stroke={COLORS[idx % COLORS.length]}
                              strokeWidth={2}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-6 space-y-3">
                    {analytics.trendsOverTime.insights.increasing.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                          <h4 className="font-semibold text-green-900">Increasing Themes</h4>
                        </div>
                        <p className="text-sm text-green-700">
                          {analytics.trendsOverTime.insights.increasing.join(', ')}
                        </p>
                      </div>
                    )}
                    {analytics.trendsOverTime.insights.decreasing.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                          <h4 className="font-semibold text-red-900">Decreasing Themes</h4>
                        </div>
                        <p className="text-sm text-red-700">
                          {analytics.trendsOverTime.insights.decreasing.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
