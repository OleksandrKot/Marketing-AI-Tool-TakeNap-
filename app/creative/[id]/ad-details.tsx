'use client';

import { useState, useCallback, memo } from 'react';
// favorites handled by HeartButton component
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Share2, Layers } from 'lucide-react';
import ModalLoading from '@/components/ui/modal-loading';
// lazy-load heavy modals to reduce initial bundle
const CollectionModal = dynamic(
  () => import('@/components/modals/collection-modal').then((m) => m.default),
  {
    loading: () => <ModalLoading />,
    ssr: false,
  }
);
import { HeartButton } from '@/app/favorites/components/HeartButton';
import { Button } from '@/components/ui/button';
import { ProfileDropdown } from '@/app/login-auth/components/profile-dropdown';
import { CreativeTabs } from '@/components/creative/tabs/CreativeTabs';
import ContentTab from './content-tab.client';
import { InfoTab } from './info-tab';
// tag manager removed from header for simplified detail view
import type { Ad } from '@/lib/core/types';

// Динамічне завантаження компонентів, які не потрібні одразу
const ShareModal = dynamic(() => import('./share-modal'), {
  loading: () => <ModalLoading />,
  ssr: false,
});

interface AdDetailsProps {
  ad: Ad;
  relatedAds?: Ad[] | null;
  // precomputed server-side values
  groupedSections?: { title: string; text: string }[];
  visualMainParagraphs?: string[];
  visualDerivedFromVideo?: boolean;
  metaAnalysis?: Record<string, unknown>;
  // adaptationScenarios removed with Adaptations feature
}

const AdDetails = memo(function AdDetails({
  ad,
  relatedAds,
  groupedSections = [],
  visualMainParagraphs = [],
}: AdDetailsProps) {
  const router = useRouter();
  // Normalize creative id to string to avoid mismatches (some ads have numeric ad_archive_id)
  const creativeId = String(ad.ad_archive_id ?? ad.id);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'info'>('content');
  // copiedAdId state removed because not used in UI

  const searchParams = useSearchParams();

  const handleBack = useCallback(() => {
    try {
      const from = searchParams?.get?.('from');
      if (from === 'advance-filter') {
        router.push('/advance-filter');
        return;
      }
    } catch (e) {
      // ignore and fallback to router.back()
    }

    // Prefer navigating back in history; fallback to root
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router, searchParams]);

  const handleShare = useCallback(() => {
    setShowShareModal(true);
  }, []);

  // copy-to-clipboard removed — not used in UI right now

  // tags update handler removed; folder/tag editing happens elsewhere

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button
              onClick={handleBack}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-4 mr-3"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Return Back
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/advance-filter?from=creative&page=${encodeURIComponent(ad.page_name || '')}`
                    )
                  }
                  className="p-0 text-sm italic text-slate-500 font-medium hover:underline"
                  title={`Show other ads from ${ad.page_name}`}
                  aria-label={`Filter by page ${ad.page_name}`}
                >
                  {ad.page_name}
                </Button>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">
                {ad.title || 'Creative Details'}
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={() => router.push('/')}
                className="text-slate-700 hover:text-slate-900 bg-white border border-slate-100 rounded-xl h-11 px-4"
                title="Go to Library"
              >
                Back to Library
              </Button>
              <HeartButton creativeId={creativeId} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCollectionsModal(true)}
                className="text-blue-600 hover:text-blue-800"
                title="Add to collections"
              >
                <Layers className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-blue-600 hover:text-blue-800"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <div className="hidden lg:block">
                <ProfileDropdown />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <CreativeTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Adaptations feature removed */}

        {/* Tab Content */}
        {activeTab === 'content' && (
          <ContentTab
            ad={ad}
            relatedAds={relatedAds}
            groupedSections={groupedSections}
            visualMainParagraphs={visualMainParagraphs}
          />
        )}
        {activeTab === 'info' && <InfoTab ad={ad} />}

        {/* Share Modal */}
        {showShareModal && <ShareModal ad={ad} onClose={() => setShowShareModal(false)} />}
        {showCollectionsModal && (
          <CollectionModal
            isOpen={showCollectionsModal}
            onClose={() => setShowCollectionsModal(false)}
            creativeId={creativeId}
          />
        )}
      </div>
    </div>
  );
});

export { AdDetails };
