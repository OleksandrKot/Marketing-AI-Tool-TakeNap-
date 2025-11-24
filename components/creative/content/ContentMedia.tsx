'use client';

import React, { useState } from 'react';
import type { Ad } from '@/lib/core/types';
/* eslint-disable jsx-a11y/media-has-caption */
import StorageImage from '@/lib/storage/StorageImage';
import StorageVideo from '@/lib/storage/StorageVideo';

interface Props {
  ad: Ad;
}

export default function ContentMedia({ ad }: Props) {
  const isVideo = ad.display_format === 'VIDEO';
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="w-full flex items-center justify-center">
      {/* For archived assets, show the preview/poster as the element's poster or image above the fold. */}
      {isVideo ? (
        <div className="flex items-center justify-center h-[360px] md:h-[480px]">
          <StorageVideo ad={ad} className="h-full" onLoaded={() => setVideoLoaded(true)} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-[360px] md:h-[480px]">
          {ad.ad_archive_id ? (
            <StorageImage
              bucket={isVideo ? 'test10public_preview' : 'test9bucket_photo'}
              path={`${ad.ad_archive_id}.jpeg`}
              alt={ad.title || 'preview'}
              fill={false}
              className="max-h-full max-w-full object-contain mx-auto"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3" />
                <p className="text-slate-500">No preview available</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading overlay */}
      {((isVideo && !videoLoaded) || (!isVideo && !imageLoaded)) && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center z-20">
          <div className="text-slate-400">Loading...</div>
        </div>
      )}
    </div>
  );
}
