/* eslint-disable react/prop-types */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type {
  CompetitorAnalytics,
  CompetitorBreakdown,
  DistributionItem,
  VisualPattern,
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

interface CompetitorDashboardClientProps {
  initialPages: string[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CompetitorDashboardClient({
  initialPages,
}: CompetitorDashboardClientProps) {
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<CompetitorAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (competitors: string[]) => {
    if (competitors.length === 0) {
      setAnalytics(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitors }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }));
        throw new Error(err.error || 'Failed to fetch analytics');
      }

      const data = (await response.json()) as CompetitorAnalytics;
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompetitors.length > 0) {
      fetchAnalytics(selectedCompetitors);
    } else {
      setAnalytics(null);
    }
  }, [selectedCompetitors]);

  const toggleCompetitor = (page: string) => {
    setSelectedCompetitors((prev) => {
      if (prev.includes(page)) {
        return prev.filter((p) => p !== page);
      }
      return [...prev, page];
    });
  };

  const formatDistributionChart = (data: DistributionItem[], maxItems = 10) => {
    return data.slice(0, maxItems).map((item) => ({
      name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
      value: item.count,
      fullName: item.name,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Competitor Analytics Dashboard</h1>
          <p className="text-slate-600">
            Analyze marketing strategies, patterns, and trends across competitors
          </p>
        </div>

        {/* Competitor Selection */}
        <Card className="mb-8 border-slate-200 rounded-2xl">
          <CardHeader>
            <h2 className="text-xl font-semibold text-slate-900">Select Competitors</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {initialPages.map((page) => {
                const isSelected = selectedCompetitors.includes(page);
                return (
                  <Button
                    key={page}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => toggleCompetitor(page)}
                    className={
                      isSelected
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }
                  >
                    {page}
                    {isSelected && ' ✓'}
                  </Button>
                );
              })}
            </div>
            {selectedCompetitors.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">
                Select one or more competitors to view analytics
              </p>
            )}
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex justify-center items-center py-20">
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

            {/* Competitor Breakdown */}
            <Card className="mb-8 border-slate-200 rounded-2xl">
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
                      <div className="text-xs text-slate-400 mt-1">{item.percentage}% of total</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number, name: string, props: unknown) => {
                          const p = props as { payload?: { fullName?: string } } | undefined;
                          return [`${value} creatives`, p?.payload?.fullName || name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="value" fill="#3b82f6" name="Creatives" />
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
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analytics.funnelDistribution.slice(0, 20).map((item: DistributionItem) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {item.name}
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-sm font-semibold text-slate-900">{item.count}</div>
                          <div className="text-xs text-slate-500">{item.percentage}%</div>
                        </div>
                      </div>
                    ))}
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
                        <div className="text-xs text-slate-500">
                          {pattern.count} creatives in this pattern
                        </div>
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
                        { name: 'Carousel', value: analytics.formatDistribution.carousel },
                        { name: 'Other', value: analytics.formatDistribution.other },
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
                <div className="mt-4 text-sm text-slate-600 space-y-1">
                  <div>
                    Videos: {analytics.formatDistribution.video} (
                    {Math.round(
                      (analytics.formatDistribution.video / analytics.totalCreatives) * 100
                    )}
                    %)
                  </div>
                  <div>
                    Static: {analytics.formatDistribution.static} (
                    {Math.round(
                      (analytics.formatDistribution.static / analytics.totalCreatives) * 100
                    )}
                    %)
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary by Parameters */}
            <Card className="mb-8 border-slate-200 rounded-2xl">
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

            {/* Trends Over Time */}
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

                  {/* Insights */}
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
