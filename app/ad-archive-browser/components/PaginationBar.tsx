import React, { memo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ViewToggle } from '@/components/filters/ViewToggle';
import type { ViewMode } from '@/lib/core/types';

type Props = {
  visibleAdsCount: number;
  totalAds: number;
  currentPageAdsCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange?: (p: number) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  selectedCreativeType: string;
  productFilter: string;
  selectedTags: string[];
  pageSize?: number;
};

function PaginationBar({
  visibleAdsCount,
  totalAds,
  currentPageAdsCount,
  currentPage,
  totalPages,
  onPageChange,
  viewMode,
  setViewMode,
  selectedCreativeType,
  productFilter,
  selectedTags,
  pageSize = 12,
}: Props) {
  return (
    <div className="flex items-center justify-between w-full gap-4 mb-8">
      <p className="text-slate-500 text-sm font-medium">
        Showing <span className="font-semibold text-slate-700">{visibleAdsCount}</span> of{' '}
        <span className="font-semibold text-slate-700">{totalAds}</span> ads{' '}
        <span className="text-slate-400">({currentPageAdsCount} on this page)</span>
        {selectedCreativeType !== 'all' && (
          <span className="text-blue-600"> ({selectedCreativeType} only)</span>
        )}
        {productFilter && <span className="text-blue-600"> for &quot;{productFilter}&quot;</span>}
        {selectedTags.length > 0 && (
          <span className="text-purple-600"> with tags: {selectedTags.join(', ')}</span>
        )}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* Prev link - preserves filters via query params */}
          <Link
            href={(() => {
              const params = new URLSearchParams();
              params.set('page', String(Math.max(1, currentPage - 1)));
              params.set('pageSize', String(pageSize));
              if (productFilter) params.set('search', productFilter);
              if (selectedCreativeType && selectedCreativeType !== 'all')
                params.set('display_format', selectedCreativeType.toUpperCase());
              if (selectedTags && selectedTags.length > 0)
                params.set('tags', selectedTags.join(','));
              return `?${params.toString()}`;
            })()}
            scroll={false}
            onClick={(e) => {
              // Prevent default navigation — update client state and URL without scrolling
              e.preventDefault();
              const params = new URLSearchParams();
              params.set('page', String(Math.max(1, currentPage - 1)));
              params.set('pageSize', String(pageSize));
              if (productFilter) params.set('search', productFilter);
              if (selectedCreativeType && selectedCreativeType !== 'all')
                params.set('display_format', selectedCreativeType.toUpperCase());
              if (selectedTags && selectedTags.length > 0)
                params.set('tags', selectedTags.join(','));
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `?${params.toString()}`);
              }
              onPageChange?.(Math.max(1, currentPage - 1));
            }}
            className={`h-8 w-8 p-0 rounded-md text-slate-600 flex items-center justify-center hover:bg-slate-200/70 hover:text-slate-900 transition-colors ${
              currentPage === 1 ? 'opacity-50 pointer-events-none' : ''
            }`}
            aria-disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <span className="text-sm text-slate-600 font-medium px-2">
            Page {currentPage} of {totalPages}
          </span>

          {/* Next link */}
          <Link
            href={(() => {
              const params = new URLSearchParams();
              params.set('page', String(Math.min(totalPages, currentPage + 1)));
              params.set('pageSize', String(pageSize));
              if (productFilter) params.set('search', productFilter);
              if (selectedCreativeType && selectedCreativeType !== 'all')
                params.set('display_format', selectedCreativeType.toUpperCase());
              if (selectedTags && selectedTags.length > 0)
                params.set('tags', selectedTags.join(','));
              return `?${params.toString()}`;
            })()}
            scroll={false}
            onClick={(e) => {
              e.preventDefault();
              const params = new URLSearchParams();
              params.set('page', String(Math.min(totalPages, currentPage + 1)));
              params.set('pageSize', String(pageSize));
              if (productFilter) params.set('search', productFilter);
              if (selectedCreativeType && selectedCreativeType !== 'all')
                params.set('display_format', selectedCreativeType.toUpperCase());
              if (selectedTags && selectedTags.length > 0)
                params.set('tags', selectedTags.join(','));
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `?${params.toString()}`);
              }
              onPageChange?.(Math.min(totalPages, currentPage + 1));
            }}
            className={`h-8 w-8 p-0 rounded-md text-slate-600 flex items-center justify-center hover:bg-slate-200/70 hover:text-slate-900 transition-colors ${
              currentPage === totalPages ? 'opacity-50 pointer-events-none' : ''
            }`}
            aria-disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
      </div>
    </div>
  );
}

export default memo(PaginationBar);
PaginationBar.displayName = 'PaginationBar';
