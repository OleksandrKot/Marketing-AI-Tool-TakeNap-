import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check as CheckIcon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Ad } from '@/lib/core/types';
import { formatDate, truncateText } from '@/lib/core/utils';
import { getPublicImageUrl } from '@/lib/storage/helpers';
import { useImageObjectUrl } from '@/lib/hooks/useImageObjectUrl';

interface AdCardProps {
  ad: Ad;
  relatedAds?: Ad[];
  relatedCount?: number;
  from?: string;
  index?: number;
  // defaultCardsExpanded?: boolean; // Unused
  // selection props
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function AdCardComponent({
  ad,
  relatedAds = [],
  relatedCount,
  from,
  index,
  selectionMode,
  selected,
  onToggleSelect,
}: AdCardProps) {
  const title = ad.title || 'Untitled Ad';
  const isVideo = ad.display_format === 'VIDEO';

  // Calculate active days
  const createdDate = new Date(ad.created_at as string);
  const today = new Date();
  const activeDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  const relatedAdsIds = relatedAds.map((relatedAd) => relatedAd.ad_archive_id).join(',');
  const baseUrl = `/creative/${ad.ad_archive_id}`;
  const params = [] as string[];
  if (relatedAdsIds) params.push(`related=${encodeURIComponent(relatedAdsIds)}`);
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  const href = params.length > 0 ? `${baseUrl}?${params.join('&')}` : baseUrl;

  const previewFromStorage = !!ad.ad_archive_id;
  // Prefer env-configured bucket, fallback to 'creatives'
  const bucket = process.env.NEXT_PUBLIC_AD_BUCKET || 'creatives';
  // For image preview, do NOT use video file path. Prefer image storage_path.
  const storagePath = ad.storage_path;
  const signedUrl = ad.signed_image_url ?? undefined;

  // DEBUG: Log what we have
  // Only warn when we truly have no reasonable fallback image
  if (!storagePath && !ad.image_url && !ad.video_preview_image_url) {
    console.info('[AdCard] Missing storage_path and no image URLs for ad:', ad.ad_archive_id);
  }

  const [publicSrc, setPublicSrc] = useState<string>(() => {
    // 1) Signed URL (already resolved image)
    if (signedUrl) return signedUrl;
    // 2) For videos, prefer preview image URL
    if (isVideo && ad.video_preview_image_url) return ad.video_preview_image_url;
    // 3) External image URL if present
    if (ad.image_url) return ad.image_url;
    // 4) Storage image path from bucket
    if (previewFromStorage && storagePath) return getPublicImageUrl(`${bucket}/${storagePath}`);
    // 5) Fallback to conventional path by id (may 404 if not uploaded)
    if (ad.ad_archive_id)
      return getPublicImageUrl(`${bucket}/business-unknown/${ad.ad_archive_id}.jpeg`);
    // 6) Last resort
    return '/placeholder.svg';
  });

  const { objectUrl: optimizedSrc } = useImageObjectUrl(publicSrc);

  // Fallback if image fails to load
  const handleImageError = () => {
    // Try fallbacks in order: video preview image, external image_url, storage image, placeholder
    if (isVideo && ad.video_preview_image_url && ad.video_preview_image_url !== publicSrc) {
      setPublicSrc(ad.video_preview_image_url);
      return;
    }
    if (ad.image_url && ad.image_url !== publicSrc) {
      setPublicSrc(ad.image_url);
      return;
    }
    if (previewFromStorage && storagePath) {
      const url = getPublicImageUrl(`${bucket}/${storagePath}`);
      if (url !== publicSrc) {
        setPublicSrc(url);
        return;
      }
    }
    setPublicSrc('/placeholder.svg');
  };

  // Fetch cards previews for this ad
  const [, setCards] = useState<
    Array<{ storage_bucket: string; storage_path: string; card_index: number }>
  >([]);
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        if (!ad.ad_archive_id) return;
        const res = await fetch(`/api/ads/cards/${encodeURIComponent(String(ad.ad_archive_id))}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = await res.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCards(rows);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        /* noop */
      }
    };
    run();
    return () => {
      controller.abort();
    };
  }, [ad.ad_archive_id]);

  // Compute unique related ads once per render; avoid calling hooks conditionally
  const uniqueRelatedAds = useMemo(() => {
    const seen = new Set<string>();
    const list = (relatedAds || []).filter((r) => {
      const k = String(r.ad_archive_id ?? r.id ?? '');
      if (!k || k === String(ad.ad_archive_id ?? ad.id ?? '')) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return list.slice(0, 8);
  }, [relatedAds, ad]);

  return (
    <Card className="group overflow-hidden bg-white border border-slate-200 rounded-2xl h-full flex flex-col hover:border-blue-200 hover:shadow-lg transition-all duration-300 ease-out">
      <CardHeader className="relative p-6 pb-4 flex flex-row items-start justify-between">
        {/* index badge for debugging order */}
        {typeof index === 'number' && (
          <div className="absolute left-3 top-3 bg-white border border-slate-100 text-xs text-slate-700 rounded-full px-2 py-0.5 shadow-sm">
            #{index}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 truncate text-lg leading-tight mb-1">
            {truncateText(title, 35)}
          </h3>
          <p className="text-sm text-slate-500 font-medium">{ad.page_name}</p>
        </div>
        {isVideo && (
          <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-medium px-3 py-1 rounded-full border">
            📹 Video
          </Badge>
        )}
        {/* selection checkbox (top-right) */}
        {selectionMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onToggleSelect) onToggleSelect(String(ad.id));
            }}
            className={`absolute right-3 top-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ${
              selected ? 'bg-blue-600' : 'border border-slate-300 bg-white'
            }`}
            title={selected ? 'Deselect' : 'Select'}
          >
            {selected ? <CheckIcon className="h-4 w-4 text-white" /> : null}
          </button>
        ) : null}
      </CardHeader>

      <CardContent className="p-6 pt-0 flex flex-col flex-grow">
        <div className="mb-3 bg-slate-100 rounded-xl overflow-hidden group-hover:shadow-md transition-shadow duration-300 flex items-center justify-center h-56 md:h-64">
          <img
            src={optimizedSrc || publicSrc}
            alt={title}
            className="max-h-full max-w-full object-contain transition-all duration-300 group-hover:scale-105"
            onError={handleImageError}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </div>

        <p className="text-sm text-slate-600 line-clamp-3 mb-3 leading-relaxed">
          {truncateText(ad.text || '', 120)}
        </p>

        {/* Debug: show IDs so user can reconcile UI <-> DB quickly */}
        <div className="mt-3 text-xs text-slate-400">
          <div>
            ad_archive_id:{' '}
            <span className="font-mono text-slate-700">{String(ad.ad_archive_id ?? '')}</span>
          </div>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mt-3">
            <div className="flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              <span>{formatDate(ad.created_at as string)}</span>
            </div>
            <div className="flex items-center">
              <span className="text-orange-600 font-medium">Active: {activeDays} days</span>
              <div className="w-2 h-2 bg-green-500 rounded-full ml-2" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mt-2">
            <div />
            <div className="flex items-center">
              <span className="text-slate-700 font-medium mr-3">
                Variations:{' '}
                <span className="text-slate-900">
                  {typeof relatedCount === 'number' ? relatedCount : relatedAds?.length ?? 0}
                </span>
              </span>
            </div>
          </div>

          {/* Keep existing related creatives UI if provided */}
          {uniqueRelatedAds.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 font-medium">Similar creatives</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {uniqueRelatedAds.map((r, i) => {
                  const src = r.signed_image_url
                    ? r.signed_image_url
                    : r.storage_path
                    ? getPublicImageUrl(`creatives/${r.storage_path}`)
                    : r.ad_archive_id
                    ? getPublicImageUrl(`creatives/business-unknown/${r.ad_archive_id}.jpeg`)
                    : r.image_url || '/placeholder.svg';
                  return (
                    <div key={`${r.ad_archive_id}-${i}`} className="relative">
                      <Link href={`/creative/${r.ad_archive_id}`} className="block">
                        <img
                          src={src}
                          alt={r.title || 'related'}
                          className="w-full h-20 object-cover rounded-md border border-slate-100"
                          loading="lazy"
                          decoding="async"
                        />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Link
          href={href}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 flex items-center justify-center transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25"
        >
          View Details
        </Link>
      </CardFooter>
    </Card>
  );
}

export { AdCardComponent as AdCard };
export default AdCardComponent;
