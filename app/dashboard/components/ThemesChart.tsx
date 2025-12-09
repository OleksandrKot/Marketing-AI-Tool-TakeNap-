'use client';

import type { DistributionItem } from '@/lib/core/types';
import { useMemo } from 'react';

interface ThemesChartProps {
  data: DistributionItem[];
}

export function ThemesChart({ data }: ThemesChartProps) {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.count - a.count);
  }, [data]);

  const maxCount = sortedData[0]?.count || 1;

  if (sortedData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-slate-500">No theme data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="space-y-4">
        {/* Bar Chart */}
        <div className="space-y-3">
          {sortedData.map((item, index) => (
            <div key={item.name} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                <span className="text-sm text-slate-600">
                  {item.count} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: `hsl(${(index * 360) / sortedData.length}, 70%, 50%)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">Most Common</p>
            <p className="text-sm font-semibold text-slate-900">{sortedData[0]?.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Themes</p>
            <p className="text-sm font-semibold text-slate-900">{sortedData.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
