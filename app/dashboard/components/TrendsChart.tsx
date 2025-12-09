'use client';

import type { TrendsData } from '@/lib/core/types';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TrendsChartProps {
  trendsData: TrendsData;
}

export function TrendsChart({ trendsData }: TrendsChartProps) {
  const hasThemesData = trendsData.themesOverTime && trendsData.themesOverTime.length > 0;
  const hasFunnelsData = trendsData.funnelsOverTime && trendsData.funnelsOverTime.length > 0;

  // Calculate max values for scaling
  const { maxTheme, maxFunnel } = useMemo(() => {
    let maxTheme = 0;
    let maxFunnel = 0;

    if (hasThemesData) {
      trendsData.themesOverTime.forEach((point) => {
        point.series.forEach((s) => {
          if (s.value > maxTheme) maxTheme = s.value;
        });
      });
    }

    if (hasFunnelsData) {
      trendsData.funnelsOverTime.forEach((point) => {
        point.series.forEach((s) => {
          if (s.value > maxFunnel) maxFunnel = s.value;
        });
      });
    }

    return { maxTheme, maxFunnel };
  }, [trendsData, hasThemesData, hasFunnelsData]);

  if (!hasThemesData && !hasFunnelsData) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-slate-500">Not enough data for trend analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Insights */}
      {(trendsData.insights.increasing.length > 0 || trendsData.insights.decreasing.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trendsData.insights.increasing.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Increasing Trends (Last 30 days)</h3>
              </div>
              <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                {trendsData.insights.increasing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {trendsData.insights.decreasing.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-900">Decreasing Trends (Last 30 days)</h3>
              </div>
              <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                {trendsData.insights.decreasing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Themes Over Time */}
      {hasThemesData && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Themes Over Time</h3>
          <div className="relative h-64">
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Y-axis labels */}
              <text x="10" y="20" className="text-xs fill-slate-500">
                {maxTheme}
              </text>
              <text x="10" y="130" className="text-xs fill-slate-500">
                {Math.round(maxTheme / 2)}
              </text>
              <text x="10" y="240" className="text-xs fill-slate-500">
                0
              </text>

              {/* Grid lines */}
              <line x1="50" y1="20" x2="100%" y2="20" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="50" y1="130" x2="100%" y2="130" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="50" y1="240" x2="100%" y2="240" stroke="#e2e8f0" strokeWidth="1" />

              {/* Line chart */}
              {trendsData.themesOverTime.length > 0 &&
                trendsData.themesOverTime[0].series.map((seriesItem, seriesIdx) => {
                  const points = trendsData.themesOverTime
                    .map((point, idx) => {
                      const serie = point.series.find((s) => s.name === seriesItem.name);
                      if (!serie) return null;
                      const x = 50 + (idx / (trendsData.themesOverTime.length - 1)) * 85;
                      const y = 240 - ((serie.value / maxTheme) * 220 || 0);
                      return `${x}%,${y}`;
                    })
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <polyline
                      key={seriesItem.name}
                      points={points}
                      fill="none"
                      stroke={`hsl(${
                        (seriesIdx * 360) / trendsData.themesOverTime[0].series.length
                      }, 70%, 50%)`}
                      strokeWidth="2"
                      className="transition-all"
                    />
                  );
                })}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-2 px-12 text-xs text-slate-500">
              {trendsData.themesOverTime.map((point, idx) =>
                idx % Math.ceil(trendsData.themesOverTime.length / 5) === 0 ? (
                  <span key={point.date}>{point.date}</span>
                ) : null
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {trendsData.themesOverTime[0]?.series.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: `hsl(${
                      (idx * 360) / trendsData.themesOverTime[0].series.length
                    }, 70%, 50%)`,
                  }}
                />
                <span className="text-xs text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Funnels Over Time */}
      {hasFunnelsData && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Funnels Over Time</h3>
          <div className="relative h-64">
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Y-axis labels */}
              <text x="10" y="20" className="text-xs fill-slate-500">
                {maxFunnel}
              </text>
              <text x="10" y="130" className="text-xs fill-slate-500">
                {Math.round(maxFunnel / 2)}
              </text>
              <text x="10" y="240" className="text-xs fill-slate-500">
                0
              </text>

              {/* Grid lines */}
              <line x1="50" y1="20" x2="100%" y2="20" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="50" y1="130" x2="100%" y2="130" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="50" y1="240" x2="100%" y2="240" stroke="#e2e8f0" strokeWidth="1" />

              {/* Line chart */}
              {trendsData.funnelsOverTime.length > 0 &&
                trendsData.funnelsOverTime[0].series.map((seriesItem, seriesIdx) => {
                  const points = trendsData.funnelsOverTime
                    .map((point, idx) => {
                      const serie = point.series.find((s) => s.name === seriesItem.name);
                      if (!serie) return null;
                      const x = 50 + (idx / (trendsData.funnelsOverTime.length - 1)) * 85;
                      const y = 240 - ((serie.value / maxFunnel) * 220 || 0);
                      return `${x}%,${y}`;
                    })
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <polyline
                      key={seriesItem.name}
                      points={points}
                      fill="none"
                      stroke={`hsl(${
                        (seriesIdx * 360) / trendsData.funnelsOverTime[0].series.length
                      }, 65%, 45%)`}
                      strokeWidth="2"
                      className="transition-all"
                    />
                  );
                })}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-2 px-12 text-xs text-slate-500">
              {trendsData.funnelsOverTime.map((point, idx) =>
                idx % Math.ceil(trendsData.funnelsOverTime.length / 5) === 0 ? (
                  <span key={point.date}>{point.date}</span>
                ) : null
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {trendsData.funnelsOverTime[0]?.series.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: `hsl(${
                      (idx * 360) / trendsData.funnelsOverTime[0].series.length
                    }, 65%, 45%)`,
                  }}
                />
                <span className="text-xs text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
