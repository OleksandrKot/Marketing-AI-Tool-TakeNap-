'use client';

import React, { useState } from 'react';
import type { Ad } from '@/lib/types';
/* eslint-disable jsx-a11y/media-has-caption */
import StorageImage from '@/lib/StorageImage';
import StorageVideo from '../../lib/StorageVideo';

interface Props {
  ad: Ad;
}

export default function ContentMedia({ ad }: Props) {
  const isVideo = ad.display_format === 'VIDEO';
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="relative w-full h-full">
      {ad.ad_archive_id && (
        <div className="absolute inset-0 z-0">
          <StorageImage
            bucket={isVideo ? 'test10public_preview' : 'test9bucket_photo'}
            path={`${ad.ad_archive_id}.jpeg`}
            alt={ad.title || 'preview'}
            fill={true}
            className="w-full h-full object-cover"
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      )}
      {/* eslint-disable jsx-a11y/media-has-caption */}
      {isVideo ? (
        <StorageVideo
          ad={ad}
          className="w-full h-full object-fit relative z-10"
          onLoaded={() => setVideoLoaded(true)}
        />
      ) : (
        <div className="relative w-full h-full">
          {/* For non-video, show storage preview if available, otherwise placeholder will be rendered by StorageImage */}
          {ad.ad_archive_id ? (
            <div className="absolute inset-0">
              <StorageImage
                bucket={isVideo ? 'test10public_preview' : 'test9bucket_photo'}
                path={`${ad.ad_archive_id}.jpeg`}
                alt={ad.title || 'preview'}
                fill={true}
                className="w-full h-full object-fit"
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
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
