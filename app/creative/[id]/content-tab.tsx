'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Ad } from '@/lib/types';

import ContentMedia from '@/components/content/ContentMedia';
import ContentControls from '@/components/content/ContentControls';
import DuplicatesGallery from '@/components/content/DuplicatesGallery';
import StorageImage from '@/lib/StorageImage';
import cleanAndSplit from './utils/cleanAndSplit';
import CollapsiblePanel from './components/CollapsiblePanel';
import GroupedSections from './components/GroupedSections';
import {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
} from './utils/adData';

interface ContentTabProps {
  ad: Ad;
  relatedAds?: Ad[] | null;
}

export function ContentTab({ ad, relatedAds }: ContentTabProps) {
  const router = useRouter();
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [adData, setAdData] = useState<Ad>(ad);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Download/restart handled by ContentControls

  const handleCopyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // cleanAndSplit util moved to ./utils/cleanAndSplit

  // Local collapsible panel used in this file
  // CollapsiblePanel moved to ./components/CollapsiblePanel

  // Preview image placeholder (we prefer storage bucket by ad_archive_id)

  // duplicates_preview_image will be rendered by DuplicatesGallery when present

  // measurement hook removed: leftHeight not used

  // Use shared parsing/analysis utilities
  // Fetch fresh ad data before parsing (in case original prop is stale). Log debug info.
  useEffect(() => {
    let mounted = true;
    const fetchLatest = async () => {
      try {
        console.debug('[ContentTab] fetching latest ad', ad.id);
        const res = await fetch(`/api/ads/${encodeURIComponent(ad.id)}`);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Fetch failed: ${res.status} ${text}`);
        }
        const j = await res.json().catch(() => null);
        const fresh = j?.data || null;
        if (mounted && fresh) {
          console.debug('[ContentTab] fetched latest ad', fresh);
          setAdData(fresh as Ad);
          setFetchError(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.debug('[ContentTab] failed to fetch latest ad', msg);
        setFetchError(msg);
      }
    };

    // only attempt if we have an id
    if (ad?.id) fetchLatest();
    return () => {
      mounted = false;
    };
  }, [ad.id]);

  const { visualMainParagraphs, visualDerivedFromVideo } = useMemo(() => {
    return getVisualParagraphs(adData);
  }, [adData]);

  const metaAnalysis = useMemo(
    () => buildMetaAnalysis(adData, visualMainParagraphs),
    [adData, visualMainParagraphs]
  );

  const rawScenarios = useMemo(() => parseScenarios(adData), [adData]);
  const adaptationScenarios = useMemo(() => sanitizeScenarios(rawScenarios), [rawScenarios]);

  const groupedSections = useMemo(
    () => buildGroupedSections(adData, metaAnalysis, adaptationScenarios, visualDerivedFromVideo),
    [adData, metaAnalysis, adaptationScenarios, visualDerivedFromVideo]
  );

  useEffect(() => {
    console.debug('[ContentTab] metaAnalysis', metaAnalysis);
    console.debug('[ContentTab] adaptationScenarios', adaptationScenarios);
    console.debug('[ContentTab] groupedSections', groupedSections);
  }, [metaAnalysis, adaptationScenarios, groupedSections]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div ref={leftColRef} className="lg:col-span-2 space-y-6">
        <Card className="overflow-hidden border-slate-200 rounded-2xl">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-slate-100">
              <ContentMedia ad={adData} />
            </div>
          </CardContent>
        </Card>

        {/* Media Controls */}
        <div className="flex gap-4 items-center">
          <ContentControls ad={adData} />
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
        </div>

        {/* Other duplicates gallery */}
        {adData.duplicates_preview_image && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">Other Duplicates</h2>
              </div>
              <DuplicatesGallery duplicates={adData.duplicates_preview_image} />
            </CardContent>
          </Card>
        )}

        {/* Ad Text */}
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

        {/* Duplicate Ad Text */}
        {adData.duplicates_ad_text && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Duplicate Ad Text</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyToClipboard(
                        cleanAndSplit(adData.duplicates_ad_text).join('\n\n'),
                        'duplicates_ad_text'
                      )
                    }
                    className="text-slate-500 hover:text-slate-700"
                  >
                    {copiedField === 'duplicates_ad_text' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-6">
                {cleanAndSplit(adData.duplicates_ad_text).map((p, i) => (
                  <p key={i} className="text-slate-700 leading-relaxed mb-3 whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Caption */}
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

        {/* Call to Action */}
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

        {/* Related Ads Section */}
        {relatedAds && relatedAds.length > 0 && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">
                  Related Ads ({relatedAds.length})
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {relatedAds.map((relatedAd) => (
                    <div
                      key={relatedAd.id}
                      role="button"
                      tabIndex={0}
                      className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer"
                      onClick={() => {
                        // Передаємо всі related ads (включаючи поточний ad) на нову сторінку
                        const allRelatedIds = [adData.id, ...relatedAds.map((ra) => ra.id)].filter(
                          (id) => id !== relatedAd.id
                        );
                        const relatedParam =
                          allRelatedIds.length > 0 ? `?related=${allRelatedIds.join(',')}` : '';
                        router.push(`/creative/${relatedAd.id}${relatedParam}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const allRelatedIds = [
                            adData.id,
                            ...relatedAds.map((ra) => ra.id),
                          ].filter((id) => id !== relatedAd.id);
                          const relatedParam =
                            allRelatedIds.length > 0 ? `?related=${allRelatedIds.join(',')}` : '';
                          router.push(`/creative/${relatedAd.id}${relatedParam}`);
                        }
                      }}
                    >
                      <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden mb-3">
                        {relatedAd.ad_archive_id ? (
                          <StorageImage
                            bucket={
                              relatedAd.display_format === 'VIDEO'
                                ? 'test10public_preview'
                                : 'test9bucket_photo'
                            }
                            path={`${relatedAd.ad_archive_id}.jpeg`}
                            alt={relatedAd.title || 'Related ad'}
                            fill={true}
                            className="w-full h-full object-cover"
                            onLoad={() => {
                              /* no-op */
                            }}
                          />
                        ) : relatedAd.image_url ? (
                          // We prefer storage images by ad_archive_id; if relatedAd has no ad_archive_id,
                          // show a simple placeholder instead of loading an external URL.
                          <div className="w-full h-full flex items-center justify-center bg-slate-100">
                            <div className="text-center">
                              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2">
                                <svg
                                  className="h-6 w-6 text-slate-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  ></path>
                                </svg>
                              </div>
                              <p className="text-xs text-slate-400">No preview</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <h3 className="font-medium text-slate-900 mb-1 line-clamp-2">
                        {relatedAd.title || 'Untitled Ad'}
                      </h3>
                      <p className="text-sm text-slate-500 mb-2">{relatedAd.page_name}</p>
                      {relatedAd.display_format === 'VIDEO' && (
                        <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                          📹 Video
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column - Links & Scripts */}
      <div className="space-y-6">
        {fetchError && (
          <Card className="border-red-200 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-sm text-red-700 font-medium">Ошибка обновления данных:</div>
                <div className="text-sm text-red-600 break-words">{fetchError}</div>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Grouped content: Visual Description, Formats & Creative Concepts, Additional content */}
        {/* Visual Description + Formats & Creative Concepts (combined panel) */}
        <div className="mb-6">
          <CollapsiblePanel
            title="Visual Description"
            defaultOpen={true}
            actions={
              <div className="flex items-center">
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
            {/* Render grouped title/text sections */}
            <div className="space-y-4 mb-4">
              <GroupedSections
                sections={groupedSections.filter(
                  (s) =>
                    s.title === 'Image / Visual Description' ||
                    s.title === 'Formats & Creative Concepts'
                )}
                onCopy={handleCopyToClipboard}
                copiedField={copiedField}
              />
            </div>
          </CollapsiblePanel>
        </div>

        {/* (Formats & Creative Concepts moved inside Visual Description panel) */}

        {/* Additional content */}
        <div className="mb-6">
          <CollapsiblePanel title="Additional content" defaultOpen={false}>
            <div className="space-y-6">
              <GroupedSections
                sections={groupedSections.filter(
                  (s) =>
                    s.title !== 'Image / Visual Description' &&
                    s.title !== 'Formats & Creative Concepts'
                )}
                onCopy={handleCopyToClipboard}
                copiedField={copiedField}
              />
            </div>
          </CollapsiblePanel>
        </div>
      </div>
    </div>
  );
}
