'use client';

import type { CompetitorAnalytics } from '@/lib/core/types';
import { BarChart3, Users, Layers, Tag, Wrench, TrendingUp } from 'lucide-react';

interface OverviewStatsProps {
  analytics: CompetitorAnalytics;
}

export function OverviewStats({ analytics }: OverviewStatsProps) {
  const stats = [
    {
      icon: BarChart3,
      label: 'Total Creatives',
      value: analytics.totalCreatives.toLocaleString(),
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: Users,
      label: 'Competitors',
      value: analytics.competitorBreakdown.length,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: TrendingUp,
      label: 'Avg Variations',
      value: analytics.averageVariationCount.toFixed(1),
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: Layers,
      label: 'Funnels Used',
      value: analytics.funnelsUsed,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: Tag,
      label: 'Themes Used',
      value: analytics.themesUsed,
      color: 'bg-pink-100 text-pink-600',
    },
    {
      icon: Wrench,
      label: 'Mechanics Used',
      value: analytics.mechanicsUsed,
      color: 'bg-indigo-100 text-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className={`inline-flex p-2 rounded-lg ${stat.color} mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm text-slate-600 mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Competitor Breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Creative Count per Competitor</h3>
        <div className="space-y-3">
          {analytics.competitorBreakdown.map((comp) => (
            <div key={comp.competitor} className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">{comp.competitor}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${comp.percentage}%` }}
                  />
                </div>
                <span className="text-slate-600 text-sm w-16 text-right">
                  {comp.count} ({comp.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
