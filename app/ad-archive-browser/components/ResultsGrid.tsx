import React from 'react';
import dynamic from 'next/dynamic';
import { AdCard } from '@/components/ads/AdCard';
import { Search } from 'lucide-react';
import type { Ad, ViewMode } from '@/lib/core/types';

const AINewsModal = dynamic(
  () => import('@/components/modals/ai-news-modal').then((mod) => mod.AINewsModal),
  { ssr: false, loading: () => null }
);

type Props = {
  isLoading: boolean;
  showAINewsModal: boolean;
  processingMessage: string;
  viewMode: ViewMode;
  currentPageAds: Ad[];
  adIdToGroupMap: Record<string, Ad[]>;
  adIdToRelatedCount?: Record<string, number>;
  filteredAdsByType: Ad[];
  selectedCreativeType: 'all' | 'video' | 'image';
  onCloseModal?: () => void;
  processingDone?: boolean;
};

function ResultsGrid({
  isLoading,
  showAINewsModal,
  processingMessage,
  viewMode,
  currentPageAds,
  adIdToGroupMap,
  adIdToRelatedCount,
  filteredAdsByType,
  selectedCreativeType,
  onCloseModal,
  processingDone,
}: Props) {
  return (
    <>
      {isLoading && !showAINewsModal ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-8 ${
            viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
          }`}
        >
          {currentPageAds.map((ad: Ad, idx: number) => {
            const fullGroup = adIdToGroupMap[ad.id] ?? [];
            const relatedAds = fullGroup.filter((a: Ad) => a.id !== ad.id);
            const relatedCount = adIdToRelatedCount
              ? adIdToRelatedCount[ad.id] ?? relatedAds.length
              : relatedAds.length;
            try {
              // Log first few entries so developer can inspect mapping in browser console
              if (typeof window !== 'undefined' && idx < 5) {
                // eslint-disable-next-line no-console
                console.debug(
                  '[ResultsGrid] ad=',
                  ad.id,
                  'relatedCount=',
                  relatedCount,
                  'exactGroup=',
                  fullGroup.length
                );
              }
            } catch (e) {
              /* noop */
            }
            return (
              <AdCard key={ad.id} ad={ad} relatedAds={relatedAds} relatedCount={relatedCount} />
            );
          })}

          {filteredAdsByType.length === 0 && (
            <div className="col-span-full text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No {selectedCreativeType === 'all' ? '' : selectedCreativeType} ads found
                </h3>
                <p className="text-slate-500">
                  Try adjusting your search criteria or filters to find what you are looking for.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <AINewsModal
        isOpen={showAINewsModal}
        onClose={onCloseModal || (() => {})}
        processingMessage={processingMessage}
        processingDone={processingDone}
      />
    </>
  );
}

export default ResultsGrid;
ResultsGrid.displayName = 'ResultsGrid';
