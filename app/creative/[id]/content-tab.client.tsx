'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/core/supabase';
import { useRouter } from 'next/navigation';
import { Copy, Check, ExternalLink, Link, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Ad } from '@/lib/core/types';

import ContentMedia from '@/components/creative/content/ContentMedia';
import ContentControls from '@/components/creative/content/ContentControls';
type SupabaseSessionLike = { session?: { user?: Record<string, unknown> } };
import StorageImage from '@/lib/storage/StorageImage';
import cleanAndSplit from './utils/cleanAndSplit';
import CollapsiblePanel from './components/CollapsiblePanel';
import GroupedSections from './components/GroupedSections';

interface ContentTabClientProps {
  ad: Ad;
  relatedAds?: Ad[] | null;
  visualMainParagraphs: string[];
  groupedSections: { title: string; text: string }[];
}

export default function ContentTabClient({
  ad,
  relatedAds,
  visualMainParagraphs,
  groupedSections,
}: ContentTabClientProps) {
  const router = useRouter();
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });

  const DynamicStructuredAttributesModal = dynamic(
    () => import('./components/StructuredAttributesModal').then((m) => m.default),
    { ssr: false, loading: () => <div className="p-2">Loading editor...</div> }
  );

  // Loader component to avoid importing the heavy editor until user requests it
  // Note: the structured attributes modal is dynamically imported below
  // via `DynamicStructuredAttributesModal` when needed.
  const adData = ad; // server-prepared ad
  const [localGroupedSections, setLocalGroupedSections] = useState(groupedSections);

  useEffect(() => {
    setLocalGroupedSections(groupedSections);
  }, [groupedSections]);

  const applyAttributesToVisual = (obj: Record<string, unknown>) => {
    try {
      const json = JSON.stringify(obj, null, 2);
      const idx = localGroupedSections.findIndex(
        (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
      );
      let updated = [...localGroupedSections];
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], text: json };
      } else {
        updated = [{ title: 'Image / Visual Description', text: json }, ...updated];
      }
      setLocalGroupedSections(updated);
    } catch (e) {
      // ignore
    }
  };

  const handleCopyToClipboard = useCallback(
    async (text: string, fieldName: string): Promise<boolean> => {
      try {
        // require auth to copy
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const sessionUser = (sessionData as unknown as SupabaseSessionLike).session?.user;
          if (!sessionUser) {
            setShowLogin(true);
            return false;
          }
        } catch (e) {
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
    },
    []
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div ref={leftColRef} className="lg:col-span-2 space-y-6">
        <Card className="overflow-hidden border-slate-200 rounded-2xl">
          <CardContent className="p-0">
            <div className="bg-slate-100 flex items-center justify-center h-[360px] md:h-[480px] overflow-hidden">
              <ContentMedia ad={adData} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 items-center flex-wrap">
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

          {/* Meta Library quick actions: visible on sm+; on xs show a compact menu */}
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

              {/* Compact menu for small screens */}
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

        {/* Render duplicates as related-style cards so they match Related Ads styling */}
        {((relatedAds && relatedAds.length > 0) || adData.duplicates_preview_image) && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">Related Ads and Duplicates</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    // Build duplicate items from duplicates_preview_image (semicolon list)
                    const dupItems: Ad[] = [];
                    if (adData.duplicates_preview_image) {
                      const parts = adData.duplicates_preview_image
                        .split(';')
                        .map((s: string) => s.trim())
                        .filter((s: string) => s);
                      for (let i = 0; i < parts.length; i++) {
                        const url = parts[i];
                        const isHttp = String(url).startsWith('http');
                        const cleaned = String(url).replace(/^\/+/, '');
                        const partsArr = cleaned.split('/').filter(Boolean);
                        const fakeId = -(i + 1);
                        const fakeAd: Partial<Ad> = {
                          id: fakeId,
                          title: adData.title ? `${adData.title} (Duplicate)` : 'Duplicate',
                          page_name: adData.page_name || '',
                          display_format: 'IMAGE',
                        };
                        if (isHttp) fakeAd.image_url = url;
                        else if (partsArr.length >= 1) {
                          // treat as storage path where last segment may be archive id
                          fakeAd.ad_archive_id = partsArr[partsArr.length - 1].replace(
                            /\.[^/.]+$/,
                            ''
                          );
                        }
                        dupItems.push(fakeAd as unknown as Ad);
                      }
                    }

                    const combined = [...(relatedAds || []), ...(dupItems || [])];
                    if (combined.length === 0) return null;
                    return combined.map((relatedAd) => (
                      <div
                        key={relatedAd.id}
                        role="button"
                        tabIndex={0}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => {
                          const allRelatedIds = [
                            adData.id,
                            ...(relatedAds || []).map((ra) => ra.id),
                          ].filter((id) => id !== relatedAd.id);
                          const relatedParam =
                            allRelatedIds.length > 0 ? `?related=${allRelatedIds.join(',')}` : '';
                          router.push(`/creative/${relatedAd.id}${relatedParam}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const allRelatedIds = [
                              adData.id,
                              ...(relatedAds || []).map((ra) => ra.id),
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
                        {relatedAd.display_format === 'VIDEO' && (
                          <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                            📹 Video
                          </span>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            <div className="space-y-4 mb-4">
              <div className="space-y-3">
                <div className="mb-2">
                  <DynamicStructuredAttributesModal
                    groupedSections={localGroupedSections}
                    ad={adData}
                    onApply={applyAttributesToVisual}
                  />
                </div>
                <GroupedSections
                  sections={localGroupedSections.filter(
                    (s) =>
                      s.title === 'Image / Visual Description' || s.title === 'Visual Description'
                  )}
                  onCopy={handleCopyToClipboard}
                  copiedField={copiedField}
                />
              </div>
            </div>
          </CollapsiblePanel>
        </div>

        <div className="mb-6">
          <CollapsiblePanel title="Additional content" defaultOpen={false}>
            <div className="space-y-6">
              <GroupedSections
                sections={groupedSections.filter((s) =>
                  [
                    'Title',
                    'Ad Text',
                    'text_on_image',
                    'Call to Action',
                    'Video Description',
                    'Audio Description',
                    'Sound Transcription',
                    'Audio Style',
                    'Social Proof',
                    'Target Audience',
                  ].includes(String(s.title))
                )}
                onCopy={handleCopyToClipboard}
                copiedField={copiedField}
              />
            </div>
          </CollapsiblePanel>
        </div>
      </div>
      {showLogin ? <LoginModal onClose={() => setShowLogin(false)} /> : null}
    </div>
  );
}
