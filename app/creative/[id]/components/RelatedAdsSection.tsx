'use client';

import { useState, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StorageImage from '@/lib/storage/StorageImage';
import { useToast } from '@/components/ui/toast';
import type { UnifiedAd } from '../utils/adData';

interface RelatedAdsSectionProps {
  relatedAds: UnifiedAd[] | null | undefined;
  currentAdId: string | number;
  currentAdData: UnifiedAd;
}

const RelatedAdsSection = memo(function RelatedAdsSection({
  relatedAds,
  currentAdData,
}: RelatedAdsSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(false);

  const scraperRelated = (relatedAds || []).filter((it) =>
    Boolean(it && (typeof it.id === 'string' || typeof it.id === 'number'))
  );

  const relatedTotal = scraperRelated.length;

  const handleRefresh = useCallback(() => {
    try {
      router.refresh();
      showToast({ message: 'Refreshed related ads', type: 'success' });
    } catch {
      showToast({ message: 'Refresh failed', type: 'error' });
    }
  }, [router, showToast]);

  const handleAdClick = useCallback(
    (relatedAd: UnifiedAd) => {
      try {
        const allRelatedIds = [currentAdData.id, ...scraperRelated.map((ra) => ra.id)].filter(
          (id) => id !== relatedAd.id
        );
        const relatedParam = allRelatedIds.length ? `?related=${allRelatedIds.join(',')}` : '';
        router.push(`/creative/${relatedAd.id}${relatedParam}`);
      } catch {
        // ignore
      }
    },
    [currentAdData.id, scraperRelated, router]
  );

  if (relatedTotal === 0) {
    return (
      <Card className="border-slate-200 rounded-2xl">
        <CardContent className="p-6">
          <div className="text-center py-8 text-slate-500">No related ads detected</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        <div className="bg-blue-50 p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Related Ads ({relatedTotal})</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Refresh
              </Button>
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh((s) => !s)}
              >
                {autoRefresh ? 'Auto: On' : 'Auto: Off'}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scraperRelated.map((relatedAd) => (
              <button
                key={relatedAd?.id ?? JSON.stringify(relatedAd)}
                onClick={() => handleAdClick(relatedAd)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAdClick(relatedAd);
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer text-left"
              >
                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden mb-3">
                  {relatedAd.ad_archive_id ? (
                    <StorageImage
                      bucket="creatives"
                      path={
                        relatedAd.storage_path || `business-unknown/${relatedAd.ad_archive_id}.jpeg`
                      }
                      alt={relatedAd.title || 'Related ad'}
                      fill={true}
                      className="w-full h-full object-cover"
                    />
                  ) : relatedAd.image_url ? (
                    <img
                      src={relatedAd.image_url}
                      alt={relatedAd.title || 'Related ad'}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <h3 className="font-medium text-slate-900 mb-1 line-clamp-2">
                  {relatedAd.title || 'Untitled Ad'}
                </h3>
                <p className="text-sm text-slate-500 mb-2">{relatedAd.page_name}</p>

                {String(relatedAd.display_format).toUpperCase() === 'VIDEO' && (
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                    📹 Video
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default RelatedAdsSection;
