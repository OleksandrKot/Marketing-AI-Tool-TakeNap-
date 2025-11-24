'use client';

import { useState, useCallback } from 'react';
import { Calendar, Clock, Info, Play, ImageIcon, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/core/utils';
import type { Ad } from '@/lib/core/types';

interface InfoTabProps {
  ad: Ad;
}

export function InfoTab({ ad }: InfoTabProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isVideo = ad.display_format === 'VIDEO';
  const createdDate = new Date(ad.created_at);
  const today = new Date();
  const activeDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  const handleCopyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  return (
    <div className="max-w-2xl">
      {/* Creative Information */}
      <Card className="border-slate-200 rounded-2xl">
        <CardContent className="p-0">
          <div className="bg-blue-50 p-6 border-b border-slate-200">
            <div className="flex items-center">
              <Info className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-slate-900">Creative Information</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-500 mb-2">Format</h3>
                <Badge
                  className={`${
                    isVideo
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  } font-medium px-3 py-1.5 rounded-full border`}
                >
                  {isVideo ? (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Video
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-3 w-3 mr-1" />
                      Image
                    </>
                  )}
                </Badge>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-500 mb-2">Created Date</h3>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                  <p className="text-slate-900 font-medium">{formatDate(ad.created_at)}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-500 mb-2">Active Days</h3>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-slate-400" />
                  <p className="text-slate-900 font-medium">{activeDays} days</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-500 mb-2">Platform</h3>
                <p className="text-slate-900 font-medium">{ad.publisher_platform || 'N/A'}</p>
              </div>

              {ad.ad_archive_id && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Archive ID</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-900 font-mono text-sm break-all">{ad.ad_archive_id}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(ad.ad_archive_id, 'archive_id')}
                      className="text-slate-500 hover:text-slate-700 ml-2"
                    >
                      {copiedField === 'archive_id' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
