import Link from 'next/link';
import React from 'react';

export interface ThemeItem {
  id?: string;
  name: string;
  count?: number;
}

export function ThemeDistribution({ themes }: { themes: ThemeItem[] }) {
  if (!themes || themes.length === 0)
    return <div className="text-sm text-slate-500">No themes</div>;

  return (
    <div className="space-y-2">
      {themes.map((t) => (
        <div
          key={t.id ?? t.name}
          className="flex items-center justify-between p-2 bg-white rounded-md border border-slate-100"
        >
          <Link
            href={`/themes/${encodeURIComponent((t.id ?? t.name) as string)}`}
            className="text-sm text-blue-700 hover:underline truncate"
          >
            {t.name}{' '}
            <span className="text-slate-500">({typeof t.count === 'number' ? t.count : 0})</span>
          </Link>
          {/* Right-side count removed per requirement to show in parentheses next to name */}
        </div>
      ))}
    </div>
  );
}

export default ThemeDistribution;
