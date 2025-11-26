import React, { useState } from 'react';
import { Calendar, Tag } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Ad } from '@/lib/core/types';
import { formatDate, truncateText } from '@/lib/core/utils';
import { getPublicImageUrl } from '@/lib/storage/helpers';

interface AdCardProps {
  ad: Ad;
  relatedAds?: Ad[];
  relatedCount?: number;
  from?: string;
}

function AdCardComponent({ ad, relatedAds = [], relatedCount, from }: AdCardProps) {
  const [expanded, setExpanded] = useState(false);
  const title = ad.title || 'Untitled Ad';
  const isVideo = ad.display_format === 'VIDEO';

  // Calculate active days
  const createdDate = new Date(ad.created_at);
  const today = new Date();
  const activeDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  const relatedAdsIds = relatedAds.map((relatedAd) => relatedAd.id).join(',');
  const baseUrl = `/creative/${ad.id}`;
  const params = [] as string[];
  if (relatedAdsIds) params.push(`related=${encodeURIComponent(relatedAdsIds)}`);
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  const href = params.length > 0 ? `${baseUrl}?${params.join('&')}` : baseUrl;

  const previewFromStorage = !!ad.ad_archive_id;
  const previewStorageBucket = isVideo ? 'test10public_preview' : 'test9bucket_photo';
  const previewStorageFilename = `${ad.ad_archive_id}.jpeg`;
  const signedUrl = ad.signed_image_url ?? undefined;
  const publicSrc = signedUrl
    ? signedUrl
    : previewFromStorage
    ? getPublicImageUrl(`${previewStorageBucket}/${previewStorageFilename}`)
    : ad.image_url || ad.video_preview_image_url || '/placeholder.svg';

  const tags = Array.isArray(ad.tags) ? ad.tags : [];

  return (
    <Card className="group overflow-hidden bg-white border border-slate-200 rounded-2xl h-full flex flex-col hover:border-blue-200 hover:shadow-lg transition-all duration-300 ease-out">
      <CardHeader className="p-6 pb-4 flex flex-row items-start justify-between">
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
      </CardHeader>

      <CardContent className="p-6 pt-0 flex-grow">
        <div className="mb-3 bg-slate-100 rounded-xl overflow-hidden group-hover:shadow-md transition-shadow duration-300 flex items-center justify-center h-56 md:h-64">
          <img
            src={publicSrc}
            alt={title}
            className="max-h-full max-w-full object-contain transition-all duration-300 group-hover:scale-105"
          />
        </div>

        <p className="text-sm text-slate-600 line-clamp-3 mb-3 leading-relaxed">
          {truncateText(ad.text || '', 120)}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                className="bg-purple-50 text-purple-700 border-purple-200 font-medium px-2 py-1 rounded-full border text-xs"
              >
                <Tag className="h-3.5 w-3.5 mr-1" />
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium px-2 py-1 rounded-full border text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mt-3">
          <div className="flex items-center">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <span>{formatDate(ad.created_at)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-orange-600 font-medium">Active: {activeDays} days</span>
            <div className="w-2 h-2 bg-green-500 rounded-full ml-2" />
          </div>
        </div>

        {relatedAds && relatedAds.length > 0 && (
          <div className="mt-4">
            {!expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-sm text-slate-600 hover:text-slate-800 font-medium"
              >
                Show {relatedCount ?? relatedAds.length} similar
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 font-medium">Similar creatives</span>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {relatedAds.slice(0, 8).map((r) => {
                    const src = r.signed_image_url
                      ? r.signed_image_url
                      : r.ad_archive_id
                      ? getPublicImageUrl(
                          `${
                            r.display_format === 'VIDEO'
                              ? 'test10public_preview'
                              : 'test9bucket_photo'
                          }/${r.ad_archive_id}.jpeg`
                        )
                      : r.image_url || '/placeholder.svg';
                    return (
                      <Link key={r.id} href={`/creative/${r.id}`} className="block">
                        <img
                          src={src}
                          alt={r.title || 'related'}
                          className="w-full h-20 object-cover rounded-md border border-slate-100"
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
