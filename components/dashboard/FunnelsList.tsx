import Link from 'next/link';
import React from 'react';

export interface FunnelItem {
  id?: string;
  name: string;
  count?: number;
}

export function FunnelsList({ funnels }: { funnels: FunnelItem[] }) {
  if (!funnels || funnels.length === 0)
    return <div className="text-sm text-slate-500">No funnels</div>;

  return (
    <div className="space-y-2">
      {funnels.map((f) => (
        <div
          key={f.id ?? f.name}
          className="flex items-center justify-between p-2 bg-white rounded-md border border-slate-100"
        >
          <Link
            href={`/funnels/${encodeURIComponent((f.id ?? f.name) as string)}`}
            className="text-sm text-blue-700 hover:underline truncate"
          >
            {f.name}
          </Link>
          <div className="text-sm text-slate-600 ml-4">{f.count ?? '-'}</div>
        </div>
      ))}
    </div>
  );
}

export default FunnelsList;
