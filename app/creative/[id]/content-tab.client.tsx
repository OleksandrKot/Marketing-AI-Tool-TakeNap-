'use client';

import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import { getRelatedAdsPage } from '@/app/actions';
import { supabase } from '@/lib/core/supabase';
import { useRouter } from 'next/navigation';
import { Copy, Check, ExternalLink, Link, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import ContentMedia from '@/components/creative/content/ContentMedia';
import ContentControls from '@/components/creative/content/ContentControls';
import StorageImage from '@/lib/storage/StorageImage';
import cleanAndSplit from './utils/cleanAndSplit';
import CollapsiblePanel from './components/CollapsiblePanel';
import GroupedSections from './components/GroupedSections';

import type { UnifiedAd } from './utils/adData.ts';
import type { Ad } from '@/lib/core/types';

type SupabaseSessionLike = { session?: { user?: Record<string, unknown> } };

interface ContentTabClientProps {
  ad: UnifiedAd;
  relatedAds?: UnifiedAd[] | null;
}

// Memoized Related Ads component
interface RelatedAdsSectionProps {
  relatedAds: UnifiedAd[] | null | undefined;
  currentAdId: string | number;
  currentAdData: UnifiedAd;
}

const RelatedAdsSectionMemo = memo(function RelatedAdsSection({
  relatedAds,
  currentAdData,
}: RelatedAdsSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [displayedAds, setDisplayedAds] = useState(relatedAds?.slice(0, 24) || []);
  const [hasMore, setHasMore] = useState((relatedAds?.length || 0) > 24);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadMore = async () => {
    if (!hasMore || isLoading) return;
    setIsLoading(true);
    try {
      const nextPageOfAds = await getRelatedAdsPage(currentAdData as Ad, page, 24);
      if (nextPageOfAds && nextPageOfAds.length > 0) {
        setDisplayedAds((prev) => [...prev, ...nextPageOfAds]);
        setPage((prev) => prev + 1);
        setHasMore(nextPageOfAds.length === 24);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      showToast({ message: 'Failed to load more ads', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const scraperRelated = (displayedAds || []).filter((it) =>
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
          {hasMore && (
            <div className="text-center mt-6">
              <Button onClick={handleLoadMore} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// Use memoized component directly (Suspense will handle lazy loading)
export default memo(function ContentTabClient({ ad, relatedAds }: ContentTabClientProps) {
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showAttributesEditor, setShowAttributesEditor] = useState(false);

  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });

  const DynamicStructuredAttributesModal = dynamic(
    () => import('./components/StructuredAttributesModal').then((m) => m.default),
    { ssr: false, loading: () => <div className="p-2">Loading editor...</div> }
  );

  const PromptEditorModal = dynamic(
    () => import('@/app/view-details/[id]/PromptEditorModal').then((m) => m.default),
    { ssr: false, loading: () => null }
  );

  const adData = ad;

  const groupedSections = adData.groupedSections || [];

  const visualMainParagraphs = useMemo(() => {
    const vis = groupedSections.find(
      (s) => s.title === 'Image / Visual Description' || s.title === 'Visual Description'
    )?.text;

    return vis ? [vis] : [];
  }, [groupedSections]);

  const [localGroupedSections, setLocalGroupedSections] = useState(groupedSections);
  useEffect(() => setLocalGroupedSections(groupedSections), [groupedSections]);

  // const applyAttributesToVisual = (obj: Record<string, unknown>) => {
  //   try {
  //     const json = JSON.stringify(obj, null, 2);
  //     const idx = localGroupedSections.findIndex(
  //       (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
  //     );
  //
  //     let updated = [...localGroupedSections];
  //     if (idx >= 0) updated[idx] = { ...updated[idx], text: json };
  //     else updated = [{ title: 'Image / Visual Description', text: json }, ...updated];
  //
  //     setLocalGroupedSections(updated);
  //   } catch {
  //     // ignore
  //   }
  // };

  const scraperRelated = Array.isArray(relatedAds)
    ? relatedAds.filter((it) =>
        Boolean(it && (typeof it.id === 'string' || typeof it.id === 'number'))
      )
    : [];

  const handleCopyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = (sessionData as unknown as SupabaseSessionLike).session?.user;
        if (!sessionUser) {
          setShowLogin(true);
          return false;
        }
      } catch {
        setShowLogin(true);
        return false;
      }

      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      return false;
    }
  }, []);

  // const relatedTotal = scraperRelated.length;
  // Video if: display_format is VIDEO, OR (display_format is DCO AND has video_storage_path)
  const isVideo =
    String(adData.display_format).toUpperCase() === 'VIDEO' ||
    (String(adData.display_format).toUpperCase() === 'DCO' && Boolean(adData.video_storage_path));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div ref={leftColRef} className="lg:col-span-2 space-y-6">
        <Card className="overflow-hidden border-slate-200 rounded-2xl">
          <CardContent className="p-0">
            <div className="bg-slate-100 flex items-center justify-center h-[360px] md:h-[480px] overflow-hidden">
              <ContentMedia ad={adData as unknown as Ad} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 items-center flex-wrap">
          <ContentControls ad={adData as unknown as Ad} />

          {adData.link_url && (
            <Button
              variant="outline"
              onClick={() => window.open(adData.link_url, '_blank', 'noopener,noreferrer')}
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-medium rounded-xl h-11 transition-all duration-200"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit Landing
            </Button>
          )}

          {(adData.meta_ad_url || adData.ad_archive_id || adData.page_name) && (
            <>
              <div className="hidden sm:inline-flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const adUrl =
                      adData.meta_ad_url ||
                      (adData.ad_archive_id
                        ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(
                            adData.ad_archive_id
                          )}`
                        : null);
                    if (adUrl) window.open(adUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Meta Ad Library
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (!adData.page_name) return;
                    const q = encodeURIComponent(adData.page_name || '');
                    const pageUrl = `https://www.facebook.com/ads/library/?q=${q}&active_status=all&ad_type=all&country=US`;
                    window.open(pageUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <Link className="h-4 w-4 mr-2" />
                  Open Meta Library Page
                </Button>
              </div>

              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 px-3">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {adData.meta_ad_url || adData.ad_archive_id ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          const adUrl =
                            adData.meta_ad_url ||
                            (adData.ad_archive_id
                              ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(
                                  adData.ad_archive_id
                                )}`
                              : null);
                          if (adUrl) window.open(adUrl, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        Open in Meta Ad Library
                      </DropdownMenuItem>
                    ) : null}
                    {adData.page_name ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          const q = encodeURIComponent(adData.page_name || '');
                          const pageUrl = `https://www.facebook.com/ads/library/?q=${q}&active_status=all&ad_type=all&country=US`;
                          window.open(pageUrl, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        Open Meta Library Page
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>

        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                const esc = (v: unknown) => {
                  const s = v === null || v === undefined ? '' : String(v);
                  return `"${s.replace(/"/g, '""')}"`;
                };

                const header = [
                  'id',
                  'ad_archive_id',
                  'page_name',
                  'title',
                  'text',
                  'caption',
                  'cta_text',
                  'cta_type',
                  'display_format',
                  'link_url',
                  'meta_ad_url',
                  'image_url',
                  'created_at',
                  'publisher_platform',
                  'audio_script',
                  'video_script',
                  'concept',
                  'realization',
                  'topic',
                  'hook',
                  'character',
                ];

                const row = [
                  adData.id,
                  adData.ad_archive_id ?? '',
                  adData.page_name ?? '',
                  adData.title ?? '',
                  adData.text ?? '',
                  adData.caption ?? '',
                  adData.cta_text ?? '',
                  adData.cta_type ?? '',
                  adData.display_format ?? '',
                  adData.link_url ?? '',
                  adData.meta_ad_url ?? '',
                  adData.image_url ?? '',
                  adData.created_at ?? '',
                  adData.publisher_platform ?? '',
                  adData.audio_script ?? '',
                  adData.video_script ?? '',
                  adData.concept ?? '',
                  adData.realization ?? '',
                  adData.topic ?? '',
                  adData.hook ?? '',
                  adData.character ?? '',
                ];

                const csvLines: string[] = [];
                csvLines.push(header.join(';'));
                csvLines.push(row.map(esc).join(';'));

                const bom = '\uFEFF';
                const blob = new Blob([bom + csvLines.join('\n')], {
                  type: 'text/csv;charset=utf-8;',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `creative-${String(adData.id)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);

                showToast({ message: 'Creative CSV exported', type: 'success' });
              } catch (e) {
                console.error('Export failed', e);
                showToast({ message: 'Export failed', type: 'error' });
              }
            }}
          >
            Export Creative (CSV)
          </Button>
        </div>

        <RelatedAdsSectionMemo
          relatedAds={scraperRelated}
          currentAdId={adData.id ?? ''}
          currentAdData={adData}
        />

        {adData.text && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Ad Text</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyToClipboard(cleanAndSplit(adData.text).join('\n\n'), 'text')
                    }
                    className="text-slate-500 hover:text-slate-700"
                  >
                    {copiedField === 'text' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-6">
                {cleanAndSplit(adData.text).map((p, i) => (
                  <p key={i} className="text-slate-700 leading-relaxed mb-3 whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {adData.caption && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-emerald-50 p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Caption</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyToClipboard(cleanAndSplit(adData.caption).join('\n\n'), 'caption')
                    }
                    className="text-slate-500 hover:text-slate-700"
                  >
                    {copiedField === 'caption' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-6">
                {cleanAndSplit(adData.caption).map((p, i) => (
                  <p key={i} className="text-slate-700 leading-relaxed mb-3 whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {adData.cta_text && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-orange-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">Call to Action</h2>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200">
                    {adData.cta_text}
                  </Button>
                  <div className="text-sm text-slate-500">
                    Type:{' '}
                    <span className="font-medium text-slate-700">{adData.cta_type || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <div className="mb-6">
          <CollapsiblePanel
            title="Visual Description"
            defaultOpen={true}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleCopyToClipboard(visualMainParagraphs.join('\n\n'), 'visual_description')
                  }
                  className="text-slate-500 hover:text-slate-700"
                >
                  {copiedField === 'visual_description' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            }
          >
            <div className="space-y-4 mb-4">
              <div className="space-y-3">
                {!isVideo && (
                  <div className="mb-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAttributesEditor(true)}
                      className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 font-medium"
                    >
                      Edit Attributes
                    </Button>
                  </div>
                )}

                {isVideo && (
                  <div className="mb-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowPromptEditor(true)}
                      className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 font-medium"
                    >
                      Edit Attributes
                    </Button>
                  </div>
                )}

                <GroupedSections
                  sections={localGroupedSections.filter(
                    (s) =>
                      s.title === 'Image / Visual Description' || s.title === 'Visual Description'
                  )}
                  onCopy={handleCopyToClipboard}
                  copiedField={copiedField}
                />

                {(() => {
                  const fccSection = localGroupedSections.find(
                    (s) => s.title === 'Formats & Creative Concepts'
                  );
                  if (!fccSection) return null;

                  const lines = fccSection.text.split('\n').filter((line) => line.trim());

                  return (
                    <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-700 space-y-3">
                      <div className="font-bold text-black mb-3 text-base">
                        Format & Creative Concepts:
                      </div>
                      <div className="space-y-2">
                        {lines.map((line, idx) => {
                          const colonIndex = line.indexOf(':');
                          if (colonIndex === -1)
                            return (
                              <div key={idx} className="whitespace-pre-wrap break-words">
                                {line}
                              </div>
                            );

                          const label = line.substring(0, colonIndex + 1);
                          const value = line.substring(colonIndex + 1);

                          return (
                            <div key={idx} className="whitespace-pre-wrap break-words">
                              <span className="text-black">{label}</span>
                              {value}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  if (!adData.group_description) return null;

                  return (
                    <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-700 space-y-3">
                      <div className="font-bold text-black mb-3 text-base">Group Description:</div>
                      <div className="whitespace-pre-wrap break-words text-slate-700">
                        {adData.group_description}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </CollapsiblePanel>
        </div>

        <div className="mb-6">
          <CollapsiblePanel title="Additional content" defaultOpen={false}>
            {(() => {
              const baseTitles = [
                'Title',
                'Ad Text',
                'Call to Action',
                'Visual Description',
                'Audio Description',
                'Sound Transcription',
                'Audio Style',
                'Social Proof',
                'Target Audience',
              ];
              const extraStaticTitles = ['Visual Elements', 'Text on Image'];
              const allowed = isVideo ? baseTitles : baseTitles.concat(extraStaticTitles);

              const filtered = groupedSections.filter((s) => allowed.includes(String(s.title)));

              return (
                <GroupedSections
                  sections={filtered}
                  onCopy={handleCopyToClipboard}
                  copiedField={copiedField}
                />
              );
            })()}
          </CollapsiblePanel>
        </div>
      </div>

      {showLogin ? <LoginModal onClose={() => setShowLogin(false)} /> : null}

      {showAttributesEditor && (
        <DynamicStructuredAttributesModal
          groupedSections={localGroupedSections}
          ad={
            {
              ...adData,
              raw_json: adData.raw_json,
            } as unknown as Record<string, unknown>
          }
          isOpen={showAttributesEditor}
          onClose={() => setShowAttributesEditor(false)}
          onApply={(obj) => {
            const json = JSON.stringify(obj, null, 2);
            const idx = localGroupedSections.findIndex(
              (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
            );
            let updated = [...localGroupedSections];
            if (idx >= 0) updated[idx] = { ...updated[idx], text: json };
            else updated = [{ title: 'Image / Visual Description', text: json }, ...updated];
            setLocalGroupedSections(updated);
          }}
        />
      )}

      {showPromptEditor && (
        <PromptEditorModal
          ad={adData as unknown as Ad}
          isOpen={showPromptEditor}
          onClose={() => setShowPromptEditor(false)}
        />
      )}
    </div>
  );
});
