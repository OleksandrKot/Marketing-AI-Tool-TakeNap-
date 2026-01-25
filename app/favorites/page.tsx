'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/modals/confirm-modal';
import Link from 'next/link';
import StorageImage from '@/lib/storage/StorageImage';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, GridIcon, LayoutList, ArrowLeft, ArrowUpDown } from 'lucide-react';
import type { Ad } from '@/lib/core/types';
import placeholder from '../../public/placeholder.svg';
import { truncateText } from '@/lib/core/utils';

type SortOrder = 'newest' | 'oldest' | 'alphabetical';
type ViewMode = 'grid' | 'list';

export default function FavoritesPage() {
  const { favorites, exportJSON, importJSON, removeFavorite } = useFavorites();
  const [importError, setImportError] = useState<string | null>(null);
  const [adMap, setAdMap] = useState<Record<string, Ad | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Fetch ad metadata (image preview) for favorites
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const idsToFetch = favorites.map((f) => f.creativeId).filter((id) => !adMap[id]);
      if (idsToFetch.length === 0) return;

      setIsLoading(true);
      try {
        const promises = idsToFetch.map(async (id) => {
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
          for (const r of results) {
            if (r && r.id) next[r.id] = r.data;
          }
          return next;
        });
      } catch (e) {
        console.error('Failed to load favorite previews', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [favorites]);

  const handleExport = useCallback(() => {
    try {
      const json = exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favorites-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }, [exportJSON]);

  const handleImport = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const txt = await file.text();
        const ok = importJSON(txt);
        if (!ok) setImportError('Invalid file format');
        else setImportError(null);
      } catch (e) {
        console.error(e);
        setImportError('Failed to read file');
      }
    },
    [importJSON]
  );

  const handleClearAll = useCallback(() => {
    // Open confirm modal instead of browser confirm
    setClearConfirmOpen(true);
  }, [favorites, removeFavorite]);

  const filteredFavorites = favorites
    .filter((f) => {
      if (!searchQuery) return true;
      const ad = adMap[f.creativeId];
      const searchLower = searchQuery.toLowerCase();
      return (
        ad?.title?.toLowerCase().includes(searchLower) ||
        ad?.page_name?.toLowerCase().includes(searchLower) ||
        f.creativeId.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const adA = adMap[a.creativeId];
      const adB = adMap[b.creativeId];

      switch (sortOrder) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'alphabetical':
          const titleA = adA?.title || `Creative ${a.creativeId}`;
          const titleB = adB?.title || `Creative ${b.creativeId}`;
          return titleA.localeCompare(titleB);
        default:
          return 0;
      }
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">Favorites</h1>
            <p className="text-slate-600 font-medium text-lg">
              Your saved creatives from <span className="text-blue-600 font-bold">TakeNap</span>
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Button onClick={handleExport} variant="outline" className="bg-white">
              Export Collection
            </Button>
            <label className="inline-block">
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => handleImport(e.target.files ? e.target.files[0] : null)}
              />
              <Button variant="outline" className="bg-white">
                Import Collection
              </Button>
            </label>
            <Button
              variant="ghost"
              onClick={handleClearAll}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Clear All
            </Button>
            <Link href="/">
              <Button
                variant="ghost"
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Library
              </Button>
            </Link>
          </div>
        </div>

        {importError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
            {importError}
          </div>
        )}

        {/* Search and Controls */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search favorites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-lg px-3 ${viewMode === 'grid' ? 'bg-slate-100' : ''}`}
                >
                  <GridIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`rounded-lg px-3 ${viewMode === 'list' ? 'bg-slate-100' : ''}`}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  className="bg-white flex items-center gap-2"
                  onClick={() => {
                    const orders: SortOrder[] = ['newest', 'oldest', 'alphabetical'];
                    const currentIndex = orders.indexOf(sortOrder);
                    const nextIndex = (currentIndex + 1) % orders.length;
                    setSortOrder(orders[nextIndex]);
                  }}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortOrder === 'newest'
                    ? 'Newest First'
                    : sortOrder === 'oldest'
                    ? 'Oldest First'
                    : 'Alphabetical'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{filteredFavorites.length}</span> of{' '}
            {favorites.length} saved creatives
            {searchQuery && <span> matching &quot;{searchQuery}&quot;</span>}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
              <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
            </div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="h-8 w-8 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No favorites yet</h3>
              <p className="text-slate-500">
                Open a creative and click the heart icon to add it to your favorites.
              </p>
            </div>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No matches found</h3>
              <p className="text-slate-500">
                Try adjusting your search query to find what you are looking for.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {filteredFavorites.map((f) => {
              const ad = adMap[f.creativeId];
              const isVideo = ad?.display_format === 'VIDEO';

              return viewMode === 'grid' ? (
                <Card
                  key={f.creativeId}
                  className="group bg-white border border-slate-200 rounded-2xl h-full flex flex-col hover:border-blue-200 hover:shadow-lg transition-all duration-300 ease-out"
                >
                  <CardHeader className="p-6 pb-4 flex flex-row items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate text-lg leading-tight mb-1">
                        {truncateText(ad?.title ?? '', 35)}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">{ad?.title}</p>
                    </div>
                    {isVideo === true ? (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-medium px-3 py-1 rounded-full border">
                        📹 Video
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-medium px-3 py-1 rounded-full border">
                        📸 Photo
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-6 flex-grow space-y-4">
                    <div className="aspect-square rounded-2xl overflow-hidden bg-white relative">
                      {ad?.ad_archive_id ? (
                        <div className="relative w-full h-full">
                          {/* storage-backed preview */}
                          <StorageImage
                            bucket="creatives"
                            path={ad.storage_path || `business-unknown/${ad.ad_archive_id}.jpeg`}
                            alt={ad?.title || 'preview'}
                            fill={true}
                            className="object-cover transition-all duration-300 group-hover:scale-105"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                          <img
                            src={placeholder.src || '/placeholder.svg'}
                            alt="placeholder"
                            width={48}
                            height={48}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                          Added {new Date(f.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-sm">From: {ad?.page_name || 'Unknown'}</div>
                      </div>

                      <h3 className="font-medium text-xl text-slate-900">
                        {ad?.title || `Creative ${f.creativeId}`}
                      </h3>
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0 flex items-center justify-between mt-4">
                    <Link href={`/creative/${f.creativeId}`}>
                      <Button
                        variant="outline"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25"
                      >
                        View Details
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() => removeFavorite(f.creativeId)}
                      className="bg-black-900 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card
                  key={f.creativeId}
                  className="bg-white border border-slate-200 rounded-2xl h-full overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <CardContent className="flex items-center justify-between m-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-16 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {ad?.ad_archive_id ? (
                          <div className="relative w-full h-full">
                            {/* storage-backed preview */}
                            <StorageImage
                              bucket="creatives"
                              path={ad.storage_path || `business-unknown/${ad.ad_archive_id}.jpeg`}
                              alt={ad?.title || 'preview'}
                              fill={true}
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <img
                            src={placeholder.src || '/placeholder.svg'}
                            alt="placeholder"
                            width={32}
                            height={32}
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 mb-1">
                          {ad?.title || `Creative ${f.creativeId}`}
                        </div>
                        <div className="text-sm text-slate-500">
                          Added {new Date(f.createdAt).toLocaleDateString()}
                        </div>
                        {ad?.page_name && (
                          <div className="text-sm text-slate-400 mt-1">From: {ad.page_name}</div>
                        )}
                      </div>
                    </div>
                    <CardFooter className="flex items-center gap-3">
                      {isVideo && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-medium px-3 py-1 rounded-full">
                          📹 Video
                        </Badge>
                      )}
                      <Link href={`/creative/${f.creativeId}`}>
                        <Button
                          variant="outline"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25"
                        >
                          View Details
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => removeFavorite(f.creativeId)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </CardFooter>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={clearConfirmOpen}
        title="Clear all favorites"
        message={'Are you sure you want to clear all favorites? This cannot be undone.'}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={() => {
          for (const f of favorites) removeFavorite(f.creativeId);
          setClearConfirmOpen(false);
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
}
