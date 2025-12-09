'use client';

import type { VisualPattern } from '@/lib/core/types';
import { Eye } from 'lucide-react';

interface PatternsAnalysisProps {
  patterns: VisualPattern[];
}

export function PatternsAnalysis({ patterns }: PatternsAnalysisProps) {
  const sortedPatterns = [...patterns].sort((a, b) => b.count - a.count);

  if (sortedPatterns.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-slate-500">Not enough data for pattern analysis</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedPatterns.map((pattern, index) => (
        <div
          key={pattern.id}
          className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="inline-flex p-2 rounded-lg"
              style={{
                backgroundColor: `hsl(${(index * 360) / sortedPatterns.length}, 70%, 95%)`,
              }}
            >
              <Eye
                className="h-5 w-5"
                style={{
                  color: `hsl(${(index * 360) / sortedPatterns.length}, 70%, 40%)`,
                }}
              />
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
              {pattern.count} creatives
            </span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{pattern.name}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{pattern.description}</p>
          {pattern.examples && pattern.examples.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Examples:</p>
              <p className="text-xs text-slate-600 line-clamp-2">{pattern.examples.join(', ')}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
