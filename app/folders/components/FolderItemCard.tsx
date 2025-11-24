'use client';

import Link from 'next/link';
import StorageImage from '@/lib/storage/StorageImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import placeholder from '../../../public/placeholder.svg';
import { truncateText } from '@/lib/core/utils';
import type { Ad } from '@/lib/core/types';

type FolderItem = {
  creative_id: string;
  note?: string | null;
};

type Props = {
  it: FolderItem;
  ad?: Ad | null;
  onOpenNote: (creativeId: string) => void;
  onRemove: (creativeId: string) => void;
};

export default function FolderItemCard({ it, ad, onOpenNote, onRemove }: Props) {
  const id = it.creative_id;

  return (
    <Card key={id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4 pt-6">
        <div className="w-28 h-20 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          {ad?.ad_archive_id ? (
            <div className="relative w-full h-full">
              <StorageImage
                bucket={
                  ad.display_format === 'VIDEO' ? 'test10public_preview' : 'test9bucket_photo'
                }
                path={`${ad.ad_archive_id}.jpeg`}
                alt={ad?.title || 'preview'}
                fill={true}
                className="object-cover"
              />
            </div>
          ) : (
            <img
              src={placeholder.src || '/placeholder.svg'}
              alt="placeholder"
              width={48}
              height={48}
              className="opacity-40"
            />
          )}
        </div>
        <div className="flex-1">
          <div className="font-medium text-slate-900">
            {truncateText(ad?.title || `Creative ${id}`, 60)}
          </div>
          <div className="text-sm text-slate-500">{ad?.page_name || 'Unknown source'}</div>
          {it?.note && <div className="text-xs text-slate-600 mt-1">Note: {it.note}</div>}
        </div>
        <div className="flex flex-col gap-2">
          <Link href={`/creative/${id}`}>
            <Button variant="outline" className="w-full">
              View
            </Button>
          </Link>
          <Button variant="ghost" onClick={() => onOpenNote(id)}>
            Note
          </Button>
          <Button variant="ghost" onClick={() => onRemove(id)} className="text-red-600">
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
