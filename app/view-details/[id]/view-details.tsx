'use client';

import React, { useState, useCallback, memo, useMemo } from 'react';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ModalLoading from '@/components/ui/modal-loading';
import StorageVideo from '@/lib/storage/StorageVideo';
import StorageImage from '@/lib/storage/StorageImage';
import {
  ArrowLeft,
  X,
  Video,
  Download,
  Share2,
  Heart,
  RotateCcw,
  Calendar,
  Clock,
  Info,
  Link,
  Play,
  ImageIcon,
  ExternalLink,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfileDropdown } from '@/app/login-auth/components/profile-dropdown';
import { formatDate } from '@/lib/core/utils';
import type { Ad } from '@/lib/core/types';
import PromptEditorModal from './PromptEditorModal';
import { supabase } from '@/lib/core/supabase';

type SupabaseSessionLike = { session?: { user?: Record<string, unknown> } };

// Dynamic imports defined once at module scope.
// This avoids re-creating dynamic components on each render.
const CollectionModal = dynamic(
  () => import('@/components/modals/collection-modal').then((m) => m.default),
  {
    loading: () => <ModalLoading />,
    ssr: false,
  }
);

const ShareModal = dynamic(() => import('../../creative/[id]/share-modal'), {
  loading: () => <ModalLoading />,
  ssr: false,
});

const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
  ssr: false,
  loading: () => null,
});

interface ViewDetailsProps {
  ad: Ad;
}

/**
 * Helper: safely open a URL in a new tab.
 */
function openInNewTab(url: string | null | undefined) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Right column: Creative info block.
 * Memoized to avoid re-rendering when only left-column state changes.
 */
interface CreativeInfoCardProps {
  ad: Ad;
  isVideo: boolean;
  activeDays: number;
  copiedField: string | null;
  onCopy: (value: string, field: string) => void;
  onOpenMetaAd: () => void;
  onOpenMetaPage: () => void;
}

const CreativeInfoCard = memo(function CreativeInfoCard({
  ad,
  isVideo,
  activeDays,
  copiedField,
  onCopy,
  onOpenMetaAd,
  onOpenMetaPage,
}: CreativeInfoCardProps) {
  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        <div className="bg-blue-50 p-6 border-b border-slate-200">
          <div className="flex items-center">
            <Info className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-slate-900">Creative Info</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Quick Meta Library actions */}
          {(ad.meta_ad_url || ad.ad_archive_id || ad.page_name) && (
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMetaAd}
                className="text-slate-700"
                title="Open in Meta Ad Library"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Meta Ad Library
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMetaPage}
                className="text-slate-700"
                title="Open Meta Library Page"
              >
                <Link className="h-4 w-4 mr-2" />
                Open Meta Library Page
              </Button>
            </div>
          )}

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
                  onClick={() => onCopy(ad.ad_archive_id!, 'archive_id')}
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
      </CardContent>
    </Card>
  );
});

/**
 * Right column: Links card.
 */
interface LinksCardProps {
  ad: Ad;
  copiedField: string | null;
  onCopy: (value: string, field: string) => void;
  onOpenMetaAd: () => void;
  onOpenMetaPage: () => void;
}

const LinksCard = memo(function LinksCard({
  ad,
  copiedField,
  onCopy,
  onOpenMetaAd,
  onOpenMetaPage,
}: LinksCardProps) {
  if (!ad.link_url && !ad.meta_ad_url && !ad.ad_archive_id && !ad.page_name) {
    return null;
  }

  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        <div className="bg-emerald-50 p-6 border-b border-slate-200">
          <div className="flex items-center">
            <Link className="h-5 w-5 text-emerald-600 mr-2" />
            <h2 className="text-xl font-semibold text-slate-900">Links</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {(ad.meta_ad_url || ad.ad_archive_id || ad.page_name) && (
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMetaAd}
                className="text-slate-700"
                title="Open in Meta Ad Library"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Meta Ad Library
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMetaPage}
                className="text-slate-700"
                title="Open Meta Library Page"
              >
                <Link className="h-4 w-4 mr-2" />
                Open Meta Library Page
              </Button>
            </div>
          )}

          {ad.link_url && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Landing Page</h3>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <a
                  href={ad.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm break-all flex-1 mr-2"
                >
                  {ad.link_url}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(ad.link_url!, 'link_url')}
                  className="text-slate-500 hover:text-slate-700"
                >
                  {copiedField === 'link_url' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {ad.meta_ad_url && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Meta Ad Library</h3>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <a
                  href={ad.meta_ad_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm break-all flex-1 mr-2"
                >
                  {ad.meta_ad_url}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(ad.meta_ad_url!, 'meta_ad_url')}
                  className="text-slate-500 hover:text-slate-700"
                >
                  {copiedField === 'meta_ad_url' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Right column: Visual description card with prompt editor.
 */
interface VisualDescriptionCardProps {
  ad: Ad;
  showPromptEditor: boolean;
  onOpenPrompt: () => void;
  onClosePrompt: () => void;
}

const VisualDescriptionCard = memo(function VisualDescriptionCard({
  ad,
  showPromptEditor,
  onOpenPrompt,
  onClosePrompt,
}: VisualDescriptionCardProps) {
  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        <div className="bg-slate-50 p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Visual Description</h2>
        </div>
        <div className="p-6">
          <Button onClick={onOpenPrompt} className="bg-blue-600 hover:bg-blue-700 text-white">
            Edit prompt
          </Button>
          {showPromptEditor && (
            <PromptEditorModal ad={ad} isOpen={showPromptEditor} onClose={onClosePrompt} />
          )}
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Main ViewDetails component.
 */
const ViewDetailsInner = ({ ad }: ViewDetailsProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [isLoading, setIsLoading] = useState(false);
  const [isLikedLocal, setIsLikedLocal] = useState(false);
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  // Derived values memoized so they don't get recomputed on every render.
  const isVideo = useMemo(() => ad.display_format === 'VIDEO', [ad.display_format]);
  const creativeId = useMemo(() => ad.ad_archive_id || ad.id.toString(), [ad.ad_archive_id, ad.id]);
  const isLiked = useMemo(
    () => isFavorite(creativeId) || isLikedLocal,
    [isFavorite, creativeId, isLikedLocal]
  );

  const activeDays = useMemo(() => {
    const createdDate = new Date(ad.created_at);
    const today = new Date();
    return Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [ad.created_at]);

  const handleBack = useCallback(() => {
    const from = searchParams?.get?.('from');
    if (from === 'advance-filter' || from === 'filter' || from === 'filter-constructor') {
      router.push('/advance-filter');
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  }, [router, searchParams]);

  const handleDownload = useCallback(async () => {
    setIsLoading(true);
    try {
      // Video download via signed URL
      if (ad.ad_archive_id && isVideo) {
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'test8public',
            path: `${ad.ad_archive_id}.mp4`,
            expires: 60,
          }),
        });
        const j = await res.json().catch(() => null);
        if (!j || typeof j !== 'object') return;
        const rec = j as Record<string, unknown>;
        const u = rec.url;
        if (typeof u === 'string') {
          const response = await fetch(u);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${ad.title || 'creative'}.mp4`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
        return;
      }

      // Image download via signed URL
      if (ad.ad_archive_id && !isVideo) {
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'test9bucket_photo',
            path: `${ad.ad_archive_id}.jpeg`,
            expires: 60,
          }),
        });
        const j = await res.json().catch(() => null);
        const rec = j as Record<string, unknown> | null;
        const u = rec?.url;
        if (typeof u === 'string') {
          const response = await fetch(u);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${ad.title || 'creative'}.jpeg`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
        return;
      }

      // Fallback: direct external image/video URL
      const urlToDownload = ad.image_url;
      if (!urlToDownload) return;
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ad.title || 'creative'}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ad, isVideo]);

  const handleLike = useCallback(() => {
    toggleFavorite(creativeId);
    setIsLikedLocal((prev) => !prev);

    // After a short delay, rely only on global favorite state
    setTimeout(() => setIsLikedLocal(false), 500);
  }, [toggleFavorite, creativeId]);

  const handleShare = useCallback(() => {
    setShowShareModal(true);
  }, []);

  const handleRestartVideo = useCallback(() => {
    // We assume there is only one main <video> element on the page.
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  }, []);

  const handleCopyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      // Require authenticated session to copy
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = (sessionData as unknown as SupabaseSessionLike).session?.user;
        if (!sessionUser) {
          setShowLogin(true);
          return;
        }
      } catch (e) {
        setShowLogin(true);
        return;
      }

      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const handleOpenMetaAd = useCallback(() => {
    const adUrl =
      ad.meta_ad_url ||
      (ad.ad_archive_id
        ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(ad.ad_archive_id)}`
        : null);
    openInNewTab(adUrl);
  }, [ad.meta_ad_url, ad.ad_archive_id]);

  const handleOpenMetaPage = useCallback(() => {
    if (!ad.page_name) return;
    const q = encodeURIComponent(ad.page_name || '');
    const pageUrl = `https://www.facebook.com/ads/library/?q=${q}&active_status=all&ad_type=all&country=US`;
    openInNewTab(pageUrl);
  }, [ad.page_name]);

  const handleOpenLanding = useCallback(() => {
    openInNewTab(ad.link_url);
  }, [ad.link_url]);

  const handleOpenPrompt = useCallback(() => {
    setShowPromptEditor(true);
  }, []);

  const handleClosePrompt = useCallback(() => {
    setShowPromptEditor(false);
  }, []);

  const handleOpenCollections = useCallback(() => {
    setShowCollectionsModal(true);
  }, []);

  const handleCloseCollections = useCallback(() => {
    setShowCollectionsModal(false);
  }, []);

  const handleCloseShare = useCallback(() => {
    setShowShareModal(false);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLogin(false);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="flex items-center gap-2 mr-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              {searchParams?.get?.('from') === 'advance-filter' && (
                <Button
                  variant="ghost"
                  onClick={() => router.push('/advance-filter')}
                  className="text-slate-500 hover:text-slate-700"
                  title="Close and return to Filter Constructor"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/advance-filter?from=view-details&page=${encodeURIComponent(
                        ad.page_name || ''
                      )}`
                    )
                  }
                  className="p-0 text-sm italic text-slate-500 font-medium hover:underline"
                  title={`Show other ads from ${ad.page_name}`}
                  aria-label={`Filter by page ${ad.page_name}`}
                >
                  {ad.page_name}
                </Button>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">
                {ad.title || 'Creative Details'}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLike}
              className={`transition-colors ${
                isLiked ? 'text-red-500 hover:text-red-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenCollections}
              className="text-slate-400 hover:text-slate-600"
              title="Add to collections"
            >
              <Layers className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="text-slate-400 hover:text-slate-600"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <ProfileDropdown />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Media & Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Media Player */}
            <Card className="overflow-hidden border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-slate-100">
                  {isVideo ? (
                    <div className="relative w-full h-full">
                      <StorageVideo
                        ad={ad}
                        className="w-full h-full"
                        onLoaded={() => setVideoLoaded(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full relative">
                      {ad.ad_archive_id ? (
                        <div className="absolute inset-0 w-full h-full">
                          <StorageImage
                            bucket="test9bucket_photo"
                            path={`${ad.ad_archive_id}.jpeg`}
                            alt={ad.title || 'preview'}
                            fill={true}
                            className="w-full h-full object-cover"
                            onLoad={() => setImageLoaded(true)}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Video className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500">No preview available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(isVideo && !videoLoaded) || (!isVideo && !imageLoaded) ? (
                    <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                      <div className="text-slate-400">Loading...</div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Media Controls */}
            <div className="flex gap-4">
              {isVideo && ad.ad_archive_id && (
                <Button
                  onClick={handleRestartVideo}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart Video
                </Button>
              )}
              {(ad.ad_archive_id || ad.image_url) && (
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-xl h-11 transition-all duration-200 bg-transparent"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? 'Downloading...' : `Download ${isVideo ? 'Video' : 'Image'}`}
                </Button>
              )}
              {ad.link_url && (
                <Button
                  variant="outline"
                  onClick={handleOpenLanding}
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visit Landing
                </Button>
              )}
            </div>
          </div>

          {/* Right Column - Details & Scripts */}
          <div className="space-y-6">
            <CreativeInfoCard
              ad={ad}
              isVideo={isVideo}
              activeDays={activeDays}
              copiedField={copiedField}
              onCopy={handleCopyToClipboard}
              onOpenMetaAd={handleOpenMetaAd}
              onOpenMetaPage={handleOpenMetaPage}
            />

            <LinksCard
              ad={ad}
              copiedField={copiedField}
              onCopy={handleCopyToClipboard}
              onOpenMetaAd={handleOpenMetaAd}
              onOpenMetaPage={handleOpenMetaPage}
            />

            <VisualDescriptionCard
              ad={ad}
              showPromptEditor={showPromptEditor}
              onOpenPrompt={handleOpenPrompt}
              onClosePrompt={handleClosePrompt}
            />
          </div>
        </div>

        {/* Modals */}
        {showShareModal && <ShareModal ad={ad} onClose={handleCloseShare} />}

        {showCollectionsModal && (
          <CollectionModal
            isOpen={showCollectionsModal}
            onClose={handleCloseCollections}
            creativeId={creativeId}
          />
        )}

        {showLogin && <LoginModal onClose={handleCloseLogin} />}
      </div>
    </div>
  );
};

// Wrap ViewDetails in React.memo to avoid re-renders
// when the same ad object (by id) is passed again.
const ViewDetails = memo(
  ViewDetailsInner,
  (prevProps, nextProps) =>
    prevProps.ad.id === nextProps.ad.id && prevProps.ad.ad_archive_id === nextProps.ad.ad_archive_id
);

export { ViewDetails };
