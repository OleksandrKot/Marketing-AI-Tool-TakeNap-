'use client';

import type { DistributionItem } from '@/lib/core/types';

interface FunnelsTableProps {
  data: DistributionItem[];
}

export function FunnelsTable({ data }: FunnelsTableProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count);

  if (sortedData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-slate-500">No funnel data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
              Funnel
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
              Count
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
              Percentage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
              Distribution
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {sortedData.map((item, index) => (
            <tr key={item.name} className="hover:bg-slate-50 transition">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-3"
                    style={{
                      backgroundColor: `hsl(${(index * 360) / sortedData.length}, 65%, 50%)`,
                    }}
                  />
                  <span className="text-sm font-medium text-slate-900">{item.name}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-slate-700">{item.count}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-slate-700">{item.percentage.toFixed(1)}%</span>
              </td>
              <td className="px-6 py-4">
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: `hsl(${(index * 360) / sortedData.length}, 65%, 50%)`,
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
