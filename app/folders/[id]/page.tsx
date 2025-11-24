'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StorageImage from '@/lib/storage/StorageImage';
import { useFolders } from '@/lib/hooks/useFolders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { truncateText } from '@/lib/core/utils';
import placeholder from '../../../public/placeholder.svg';
import type { Ad } from '@/lib/core/types';
import type { Folder, FolderItem } from '@/lib/hooks/useFolders';

export default function FolderDetailsPage() {
  const params = useParams() as { id?: string };
  const folderId = params?.id || null;
  const { folders } = useFolders();
  const [adMap, setAdMap] = useState<Record<string, Ad | null>>({});

  const folder = useMemo(
    () => folders.find((f: Folder) => f.id === folderId) || null,
    [folders, folderId]
  ) as Folder | null;

  useEffect(() => {
    if (!folder) return;
    const ids: string[] = Array.from(
      new Set(((folder.folder_items || []) as FolderItem[]).map((i) => i.creative_id))
    );
    let cancelled = false;
    (async () => {
      try {
        const promises = ids.map(async (id: string) => {
          try {
            const res = await fetch(`/api/ads/${encodeURIComponent(id)}`);
            if (!res.ok) return { id, data: null };
            const payload = await res.json();
            return { id, data: payload?.data || null };
          } catch (e) {
            return { id, data: null };
          }
        });
        const results = await Promise.all(promises);
        if (cancelled) return;
        setAdMap((prev) => {
          const next = { ...prev };
          for (const r of results) if (r?.id) next[r.id] = r.data;
          return next;
        });
      } catch (e) {
        console.error('Failed to load folder previews', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  // build a mapping of creativeId -> array of folder names it's in
  const inFoldersMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const f of folders) {
      const ids = ((f.folder_items || []) as FolderItem[]).map((i) => i.creative_id);
      for (const id of ids) {
        map[id] = map[id] || [];
        map[id].push(f.name);
      }
    }
    return map;
  }, [folders]);

  if (!folderId) return <div className="p-8">Missing folder id</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">{folder?.name || 'Folder'}</h1>
            <p className="text-slate-600">{folder?.description || 'Folder details'}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/folders">
              <Button variant="ghost">Back to Folders</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            const items = (folder?.folder_items || []) as FolderItem[];
            if (items.length === 0)
              return <div className="text-slate-500">This folder is empty.</div>;
            return items.map((it: FolderItem) => {
              const id = it.creative_id;
              const ad = adMap[id];
              return (
                <Card
                  key={id}
                  className="bg-white border border-slate-200 rounded-2xl h-full overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="w-full h-40 bg-slate-100 rounded-lg overflow-hidden mb-3">
                      {ad?.ad_archive_id ? (
                        <div className="relative w-full h-full">
                          <StorageImage
                            bucket={
                              ad.display_format === 'VIDEO'
                                ? 'test10public_preview'
                                : 'test9bucket_photo'
                            }
                            path={`${ad.ad_archive_id}.jpeg`}
                            alt={ad?.title || 'preview'}
                            fill={true}
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <img
                            src={placeholder.src || '/placeholder.svg'}
                            alt="placeholder"
                            width={48}
                            height={48}
                          />
                        </div>
                      )}
                    </div>
                    <div className="font-medium text-slate-900 mb-1">
                      {truncateText(ad?.title || `Creative ${id}`, 80)}
                    </div>
                    <div className="text-sm text-slate-500 mb-2">{ad?.page_name || 'Unknown'}</div>
                    {inFoldersMap[id] && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {inFoldersMap[id].map((n) => (
                          <span key={n} className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                    {it.note && <div className="text-xs text-slate-600">Note: {it.note}</div>}
                  </CardContent>
                  <CardFooter className="p-4">
                    <Link href={`/creative/${id}`}>
                      <Button className="w-full">View</Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
