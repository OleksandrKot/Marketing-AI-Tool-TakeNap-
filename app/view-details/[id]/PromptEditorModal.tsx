'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Ad } from '@/lib/core/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/core/supabase';
import dynamic from 'next/dynamic';
import Slider from '@mui/material/Slider';
// date-fns utilities removed; not currently needed in this modal

// Drag-and-drop removed for compact inline UI

type SupabaseSessionLike = { session?: { user?: Record<string, unknown> } };

interface PromptParameter {
  id: string;
  key: string;
  label: string;
  value: string;
  isAdditional?: boolean;
}

interface PromptEditorModalProps {
  ad: Ad;
  isOpen: boolean;
  onClose: () => void;
}

// Aligned with creative_concepts from raw_json
const MAIN_PARAMETERS: Array<{ key: string; label: string }> = [
  { key: 'Hook', label: 'Hook' },
  { key: 'Topic', label: 'Topic' },
  { key: 'Concept', label: 'Concept' },
  { key: 'Realisation', label: 'Realisation' },
  { key: 'Character', label: 'Character' },
  { key: 'Persona', label: 'Persona' },
  { key: 'Primary_Subject', label: 'Primary Subject' },
  { key: 'Text', label: 'Text' },
  { key: 'Mood', label: 'Mood' },
  { key: 'Style', label: 'Style' },
  { key: 'Visual_Focus', label: 'Visual Focus' },
  { key: 'Color_Palette', label: 'Color Palette' },
  { key: 'Lighting', label: 'Lighting' },
  { key: 'Camera_Style', label: 'Camera Style' },
  { key: 'Composition', label: 'Composition' },
  { key: 'Environment', label: 'Environment' },
  { key: 'Secondary_Elements', label: 'Secondary Elements' },
  { key: 'Background_Elements', label: 'Background Elements' },
  { key: 'Symbolism', label: 'Symbolism' },
  { key: 'Call_To_Action', label: 'Call To Action' },
];

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

async function generateThumbnailsFromUrl(
  url: string,
  maxFrames: number = 180
): Promise<{ thumbnails: string[]; duration: number }> {
  // Guard for server-side environments
  if (typeof window === 'undefined') {
    return { thumbnails: [], duration: 0 };
  }

  return new Promise((resolve, reject) => {
    console.log('[generateThumbnails] Creating video element with src:', url.substring(0, 100));
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      console.log('[generateThumbnails] Cleaning up');
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.src = '';
    };

    const onError = () => {
      console.error(
        '[generateThumbnails] Video load error:',
        video.error?.message,
        video.error?.code
      );
      cleanup();
      reject(new Error(`Video load failed: ${video.error?.message || 'Unknown error'}`));
    };

    const onLoadedMetadata = async () => {
      try {
        const duration = video.duration;
        console.log('[generateThumbnails] Duration:', duration);
        if (!duration || Number.isNaN(duration)) {
          cleanup();
          return reject(new Error('Invalid video duration'));
        }

        const totalSeconds = Math.floor(duration);
        const framesToRender = Math.min(totalSeconds, maxFrames);
        console.log('[generateThumbnails] Rendering frames:', framesToRender);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Unable to get 2D canvas context'));
        }

        const targetWidth = 120; // width of each thumbnail
        const ratio =
          video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 9 / 16;
        const targetHeight = Math.floor(targetWidth * ratio);

        console.log('[generateThumbnails] Video dimensions:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          targetWidth,
          targetHeight,
        });

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const thumbnails: string[] = [];

        // Helper to seek to a specific time and wait until it's ready
        const seekTo = (time: number) =>
          new Promise<void>((res, rej) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onSeekError);
              res();
            };
            const onSeekError = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onSeekError);
              console.error('[generateThumbnails] Seek error at time:', time, video.error);
              rej(
                new Error(`Error seeking video to ${time}s for thumbnail: ${video.error?.message}`)
              );
            };
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onSeekError, { once: true });
            try {
              video.currentTime = time;
            } catch (e) {
              console.error('[generateThumbnails] currentTime set error:', e);
              onSeekError();
            }
          });

        // Generate one frame per second
        for (let second = 0; second < framesToRender; second++) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await seekTo(second);
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            thumbnails.push(dataUrl);
          } catch (seekErr) {
            console.error('[generateThumbnails] Error at frame', second, ':', seekErr);
            throw seekErr;
          }
        }

        console.log('[generateThumbnails] Successfully generated', thumbnails.length, 'thumbnails');
        cleanup();
        resolve({ thumbnails, duration });
      } catch (err) {
        console.error('[generateThumbnails] Error in onLoadedMetadata:', err);
        cleanup();
        reject(err);
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
  });
}

const PromptEditorModal = ({ ad, isOpen, onClose }: PromptEditorModalProps) => {
  const [wordCount, setWordCount] = useState<'200' | '500' | '1000' | 'unlimited'>('500');
  const [videoSegment, setVideoSegment] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [showLogin, setShowLogin] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Thumbnails state for YouTube-like timeline
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [thumbsError, setThumbsError] = useState<string | null>(null);
  const [sliderHoverX, setSliderHoverX] = useState<number | null>(null);
  const [sliderHoverTime, setSliderHoverTime] = useState<number | null>(null);
  const sliderContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Handle mouse move over the segment slider to show frame tooltip
  const handleSliderMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderContainerRef.current || videoDuration <= 0) {
      setSliderHoverX(null);
      setSliderHoverTime(null);
      return;
    }

    // Calculate relative X position inside the slider container
    const rect = sliderContainerRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    const percent = x / rect.width;
    const time = percent * videoDuration;

    setSliderHoverX(x);
    setSliderHoverTime(time);
  };

  // Clear tooltip when pointer leaves the slider
  const handleSliderMouseLeave = () => {
    setSliderHoverX(null);
    setSliderHoverTime(null);
  };

  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });

  // Initialize parameters from ad data
  const initialParams: PromptParameter[] = useMemo(() => {
    const main: PromptParameter[] = MAIN_PARAMETERS.map((p) => ({
      id: p.key,
      key: p.key,
      label: p.label,
      value: '',
      isAdditional: false,
    }));

    // Map existing ad/unified fields to parameters (best-effort)
    const A = ad as unknown as Record<string, unknown>;

    // Try to parse raw_json first (new field), then shortPromptJson
    let creativeConcepts: Record<string, string> = {};
    try {
      // Parse creative_concepts from raw_json
      if (A.raw_json) {
        let rawJson: Record<string, unknown> | null = null;
        if (typeof A.raw_json === 'string') {
          rawJson = JSON.parse(A.raw_json as string);
        } else if (typeof A.raw_json === 'object' && A.raw_json !== null) {
          rawJson = A.raw_json as Record<string, unknown>;
        }

        if (rawJson && rawJson.creative_concepts) {
          creativeConcepts = rawJson.creative_concepts as Record<string, string>;
        }
      }
    } catch (e) {
      console.error('Error parsing creative_concepts:', e);
    }

    const setIf = (key: string, ...vals: unknown[]) => {
      for (const val of vals) {
        if (val !== undefined && val !== null && String(val).trim()) {
          const target = main.find((p) => p.key === key);
          if (target) {
            target.value = String(val).trim();
            return;
          }
        }
      }
    };

    // Set all fields from creative_concepts
    setIf('Hook', creativeConcepts.Hook);
    setIf('Topic', creativeConcepts.Topic);
    setIf('Concept', creativeConcepts.Concept);
    setIf('Realisation', creativeConcepts.Realisation);
    setIf('Character', creativeConcepts.Character);
    setIf('Persona', creativeConcepts.Persona);
    setIf('Primary_Subject', creativeConcepts.Primary_Subject);
    setIf('Text', creativeConcepts.Text);
    setIf('Mood', creativeConcepts.Mood);
    setIf('Style', creativeConcepts.Style);
    setIf('Visual_Focus', creativeConcepts.Visual_Focus);
    setIf('Color_Palette', creativeConcepts.Color_Palette);
    setIf('Lighting', creativeConcepts.Lighting);
    setIf('Camera_Style', creativeConcepts.Camera_Style);
    setIf('Composition', creativeConcepts.Composition);
    setIf('Environment', creativeConcepts.Environment);
    setIf('Secondary_Elements', creativeConcepts.Secondary_Elements);
    setIf('Background_Elements', creativeConcepts.Background_Elements);
    setIf('Symbolism', creativeConcepts.Symbolism);
    setIf('Call_To_Action', creativeConcepts.Call_To_Action);

    const additional: PromptParameter[] = [
      {
        id: 'title',
        key: 'title',
        label: 'Title',
        value: ad.title || '',
        isAdditional: true,
      },
      {
        id: 'text',
        key: 'text',
        label: 'Text',
        value: ad.text || '',
        isAdditional: true,
      },
      {
        id: 'caption',
        key: 'caption',
        label: 'Caption',
        value: ad.caption || '',
        isAdditional: true,
      },
      {
        id: 'cta_text',
        key: 'cta_text',
        label: 'CTA Text',
        value: ad.cta_text || '',
        isAdditional: true,
      },
      {
        id: 'cta_type',
        key: 'cta_type',
        label: 'CTA Type',
        value: ad.cta_type || '',
        isAdditional: true,
      },
      {
        id: 'audio_script',
        key: 'audio_script',
        label: 'Audio Script',
        value: ad.audio_script || '',
        isAdditional: true,
      },
      {
        id: 'video_script',
        key: 'video_script',
        label: 'Video Script',
        value: ad.video_script || '',
        isAdditional: true,
      },
      {
        id: 'page_name',
        key: 'page_name',
        label: 'Page Name',
        value: ad.page_name || '',
        isAdditional: true,
      },
      {
        id: 'display_format',
        key: 'display_format',
        label: 'Display Format',
        value: ad.display_format || '',
        isAdditional: true,
      },
      {
        id: 'publisher_platform',
        key: 'publisher_platform',
        label: 'Publisher Platform',
        value: ad.publisher_platform || '',
        isAdditional: true,
      },
      {
        id: 'link_url',
        key: 'link_url',
        label: 'Link URL',
        value: ad.link_url || '',
        isAdditional: true,
      },
      {
        id: 'new_scenario',
        key: 'new_scenario',
        label: 'New Scenario',
        value: (A.new_scenario as string) || '',
        isAdditional: true,
      },
      {
        id: 'tags',
        key: 'tags',
        label: 'Tags',
        value: Array.isArray(A.tags) ? (A.tags as string[]).join(', ') : '',
        isAdditional: true,
      },
    ];

    return [...main, ...additional];
  }, [ad]);

  const [parameters, setParameters] = useState<PromptParameter[]>(initialParams);
  const [originalParameters, setOriginalParameters] = useState<PromptParameter[]>(initialParams);

  // Reset to original when modal opens
  useEffect(() => {
    if (isOpen) {
      setParameters([...initialParams]);
      setOriginalParameters([...initialParams]);
      setWordCount('500');
      setVideoSegment(null);
    }
  }, [isOpen, initialParams]);

  const isVideo = ['VIDEO', 'DCO'].includes(String(ad.display_format).toUpperCase());

  // Initialize video duration from script (fallback if metadata is not available)
  useEffect(() => {
    if (isOpen && isVideo && ad.video_storage_path) {
      let totalSec = 0;
      if (ad.video_script) {
        const timeMatches = ad.video_script.match(/\d{1,2}:\d{2}/g);
        if (timeMatches && timeMatches.length > 0) {
          const lastTime = timeMatches[timeMatches.length - 1];
          const parts = lastTime.split(':').map(Number);
          if (parts.length === 2) {
            const [min, sec] = parts;
            if (!Number.isNaN(min) && !Number.isNaN(sec)) {
              totalSec = min * 60 + sec;
            }
          }
        }
      }

      // Ensure reasonable duration
      if (totalSec < 5) totalSec = 5;
      if (totalSec > 600) totalSec = 600; // Cap at 10 minutes

      setVideoDuration(totalSec);

      // Set initial segment: if video < 5 sec, use full length; otherwise 0-15 or 0-totalSec if shorter
      if (totalSec <= 5) {
        setVideoSegment({ start: 0, end: totalSec });
      } else {
        setVideoSegment({ start: 0, end: Math.min(15, totalSec) });
      }
    } else if (isOpen) {
      // Reset for non-video
      setVideoDuration(0);
      setVideoSegment(null);
    }
  }, [isOpen, ad, isVideo]);

  // Load full video URL (signed) for preview and thumbnails
  useEffect(() => {
    if (!isOpen || !isVideo || !ad.ad_archive_id || !ad.video_storage_path) {
      setVideoUrl(null);
      return;
    }

    let mounted = true;
    setVideoLoading(true);

    async function loadVideo() {
      try {
        console.log('[loadVideo] Loading video:', {
          video_storage_path: ad.video_storage_path,
          ad_archive_id: ad.ad_archive_id,
        });

        const response = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'creatives',
            path:
              ad.video_storage_path ||
              ad.storage_path ||
              `business-unknown/${ad.ad_archive_id}.mp4`,
            expires: 3600, // 1 hour expiration for video
          }),
        });

        const data = await response.json().catch(() => null);
        if (!mounted) return;

        console.log('[loadVideo] Response:', data);

        if (data?.url) {
          console.log('[loadVideo] Setting videoUrl:', data.url.substring(0, 100));
          setVideoUrl(data.url);
        } else {
          console.log('[loadVideo] No URL in response');
          setVideoUrl(null);
        }
        setVideoLoading(false);
      } catch (error) {
        console.error('Error loading video:', error);
        if (mounted) {
          setVideoUrl(null);
          setVideoLoading(false);
        }
      }
    }

    loadVideo();

    return () => {
      mounted = false;
    };
  }, [isOpen, ad, ad.ad_archive_id, isVideo]);

  // Generate thumbnails once we have a video URL (YouTube-like timeline)
  useEffect(() => {
    if (!isOpen || !isVideo || !videoUrl) {
      console.log('[thumbnails] Skipping thumbnails:', {
        isOpen,
        isVideo,
        videoUrl: videoUrl ? 'yes' : 'no',
      });
      setThumbnails([]);
      setThumbsError(null);
      return;
    }

    console.log('[thumbnails] Starting generation for:', videoUrl.substring(0, 100));

    let cancelled = false;

    const run = async () => {
      try {
        setThumbsLoading(true);
        setThumbsError(null);

        const { thumbnails: thumbs, duration } = await generateThumbnailsFromUrl(
          videoUrl,
          180 // hard cap: 180 seconds => 3 min of thumbnails
        );
        if (cancelled) return;

        console.log('[thumbnails] Generated:', thumbs.length, 'duration:', duration);

        setThumbnails(thumbs);

        // If metadata duration from thumbnails is more reliable, sync it
        if (duration && !Number.isNaN(duration) && duration > 0) {
          setVideoDuration((prev) => (prev > 0 ? prev : Math.ceil(duration)));
        }
      } catch (err) {
        console.error('Failed to generate thumbnails:', err);
        if (!cancelled) {
          const errorMsg =
            err instanceof Error ? err.message : 'Failed to generate thumbnails preview';
          console.error('Error message:', errorMsg);
          setThumbsError(errorMsg);
        }
      } finally {
        if (!cancelled) {
          setThumbsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isVideo, videoUrl]);

  const updateParameter = (id: string, value: string) => {
    setParameters((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };

  // Reordering removed for compact UI

  const handleReset = () => {
    setParameters([...originalParameters]);
    setWordCount('500');
    if (isVideo && videoDuration > 0) {
      if (videoDuration <= 5) {
        setVideoSegment({ start: 0, end: videoDuration });
      } else {
        setVideoSegment({ start: 0, end: Math.min(15, videoDuration) });
      }
    } else {
      setVideoSegment(null);
    }
  };

  const generatePromptJSON = () => {
    const mainParams = parameters.filter((p) => !p.isAdditional);
    const additionalParams = parameters.filter((p) => p.isAdditional);

    const json: Record<string, unknown> = {};

    // Main parameters
    for (const param of mainParams) {
      if (param.value.trim()) {
        json[param.key] = param.value;
      }
    }

    // Additional parameters
    const additional: Record<string, unknown> = {};
    for (const param of additionalParams) {
      if (param.value.trim()) {
        additional[param.key] = param.value;
      }
    }
    if (Object.keys(additional).length > 0) {
      json.additional_concepts = additional;
    }

    // Word count and segment
    if (wordCount !== 'unlimited') {
      json.word_count = parseInt(wordCount, 10);
    } else {
      json.word_count = 'unlimited';
    }

    if (isVideo && videoSegment) {
      json.segment = {
        start: videoSegment.start,
        end: videoSegment.end,
      };
    }

    return JSON.stringify(json, null, 2);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!ad.ad_archive_id) {
      setSaveError('No ad ID available');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // Prepare data to save
      const mainParams = parameters.filter((p) => !p.isAdditional);
      const updateData: Record<string, unknown> = {};

      // Save main parameters directly to their columns
      for (const param of mainParams) {
        if (param.value.trim()) {
          updateData[param.key] = param.value;
        }
      }

      // Save all parameters to raw_json as well
      const promptJSON = generatePromptJSON();
      updateData.raw_json = JSON.parse(promptJSON);

      // Make API call to update the ad
      const response = await fetch(`/api/ads/${ad.ad_archive_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save');
      }

      // Success - close modal
      onClose();

      // Optionally refresh the page to show updated data
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving ad:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAndClose = async () => {
    try {
      // Check auth
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

      const json = generatePromptJSON();
      await navigator.clipboard.writeText(json);
      onClose();
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const mainParams = parameters.filter((p) => !p.isAdditional);
  const additionalParams = parameters.filter((p) => p.isAdditional);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-[90vw] max-h-[100vh] overflow-hidden flex flex-col border-slate-200 rounded-2xl">
          <CardHeader className="flex max-h-[60px] items-center justify-between border-b border-slate-200 bg-slate-50 position-relative">
            <h2 className="text-xl font-semibold text-slate-900">Edit Prompt</h2>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Word Count Selector */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="block text-sm font-medium text-slate-700 mb-3">
                Choose length of generated prompt:
              </div>
              <div className="flex flex-wrap gap-4">
                {(['200', '500', '1000', 'unlimited'] as const).map((count) => (
                  <label key={count} className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="wordCount"
                      value={count}
                      checked={wordCount === count}
                      onChange={() => setWordCount(count)}
                      className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {count === 'unlimited' ? 'Unlimited' : `${count} words`}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Video Segment + Preview Timeline */}
              {isVideo && (
                <div>
                  <div className="block text-sm font-medium text-slate-700 mb-2">
                    Select video segment for description
                  </div>
                  {videoLoading ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                      Loading video... Please wait.
                    </div>
                  ) : !videoUrl ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                      Video unavailable for segment selection. Please ensure video is loaded
                      properly.
                    </div>
                  ) : videoSegment ? (
                    <div className="space-y-4">
                      {/* Full Video Player */}
                      <div className="space-y-2">
                        <div className="relative w-full bg-black rounded-lg overflow-hidden">
                          <video
                            ref={videoRef}
                            src={videoUrl}
                            controls
                            className="w-full h-auto max-h-96"
                            onTimeUpdate={(e) => {
                              setCurrentTime(e.currentTarget.currentTime);
                            }}
                            onLoadedMetadata={(e) => {
                              const duration = e.currentTarget.duration;
                              if (!Number.isNaN(duration) && duration > 0) {
                                const ceilDur = Math.ceil(duration);
                                setVideoDuration(ceilDur);
                                // Initialize segment to first 5 seconds or full duration if shorter
                                setVideoSegment({
                                  start: 0,
                                  end: Math.min(5, ceilDur),
                                });
                              }
                            }}
                          >
                            <track kind="captions" srcLang="en" src="" />
                          </video>
                        </div>
                        {/* Current playback info */}
                        <div className="text-xs text-slate-600 text-center">
                          Current: {formatTime(currentTime)} | Total: {formatTime(videoDuration)}
                        </div>
                        {thumbsLoading && (
                          <div className="text-xs text-slate-500 text-center">
                            Generating thumbnails...
                          </div>
                        )}
                        {thumbsError && (
                          <div className="text-xs text-rose-600 text-center">{thumbsError}</div>
                        )}

                        {/* Selected Segment Display */}
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <div className="flex items-center justify-between text-sm font-medium text-blue-900 mb-2">
                            <span>Selected Segment</span>
                            <span>{videoSegment.end - videoSegment.start}s</span>
                          </div>
                          <div className="flex gap-4 text-sm text-blue-800">
                            <div>Start: {formatTime(videoSegment.start)}</div>

                            <div>End: {formatTime(videoSegment.end)}</div>
                          </div>
                          <div className="relative mt-3" ref={sliderContainerRef}>
                            {/* Slider with segment selection */}
                            <Slider
                              min={0}
                              max={Math.max(0, videoDuration)}
                              value={[videoSegment.start, videoSegment.end]}
                              onChange={(_, newValue) => {
                                const [rangeStart, rangeEnd] = newValue as number[];
                                if (rangeEnd - rangeStart > 15) return false;
                                else {
                                  setVideoSegment({ start: rangeStart, end: rangeEnd });
                                  if (videoRef.current) {
                                    videoRef.current.currentTime = rangeStart;
                                  }
                                }
                              }}
                              // We use container-level mouse events to calculate tooltip position
                              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              onMouseMove={handleSliderMouseMove}
                              onMouseLeave={handleSliderMouseLeave}
                            />

                            {/* Frame tooltip above the slider */}
                            {sliderHoverTime !== null &&
                              sliderHoverX !== null &&
                              thumbnails.length > 0 && (
                                <div
                                  className="absolute bottom-full mb-2 flex flex-col items-center pointer-events-none"
                                  style={{
                                    left: sliderHoverX,
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  {/* Frame preview image */}
                                  <div className="overflow-hidden rounded-md border border-slate-200 bg-black shadow-lg">
                                    <img
                                      src={
                                        thumbnails[
                                          Math.min(
                                            thumbnails.length - 1,
                                            Math.max(0, Math.floor(sliderHoverTime))
                                          )
                                        ]
                                      }
                                      alt={`Preview at ${Math.floor(sliderHoverTime)}s`}
                                      className="w-24 h-auto object-cover"
                                    />
                                  </div>
                                  {/* Time label */}
                                  <span className="mt-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
                                    {formatTime(sliderHoverTime)}
                                  </span>
                                </div>
                              )}

                            {/* Slider min/max labels */}
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                              <span>0s</span>
                              <span>{formatTime(Math.max(0, videoDuration))}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Segment length validation */}
                      {(videoSegment.end - videoSegment.start < 5 ||
                        videoSegment.end - videoSegment.start > 15) && (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-4">
                          <div className="pt-2 space-y-1">
                            {videoSegment.end - videoSegment.start < 5 && (
                              <div className="text-xs text-amber-600 font-medium">
                                ⚠ Minimum segment length is 5 seconds
                              </div>
                            )}
                            {videoSegment.end - videoSegment.start > 15 && (
                              <div className="text-xs text-amber-600 font-medium">
                                ⚠ Maximum segment length is 15 seconds
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Main Parameters (Compact inline grid) */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Main Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mainParams
                    .filter((param) => param.value && param.value.trim())
                    .map((param) => {
                      const useTextarea = param.value && param.value.length > 60;
                      return (
                        <div key={param.id} className="flex flex-col gap-1">
                          <label
                            htmlFor={`param-${param.id}`}
                            className="text-xs font-medium text-slate-700"
                          >
                            {param.label}
                          </label>
                          {useTextarea ? (
                            <Textarea
                              id={`param-${param.id}`}
                              value={param.value}
                              onChange={(e) => updateParameter(param.id, e.target.value)}
                              placeholder={`Enter ${param.label.toLowerCase()}...`}
                              className="text-xs h-16 p-2"
                            />
                          ) : (
                            <Input
                              id={`param-${param.id}`}
                              value={param.value}
                              onChange={(e) => updateParameter(param.id, e.target.value)}
                              placeholder={`Enter ${param.label.toLowerCase()}...`}
                              className="text-xs h-8"
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Additional Concepts */}
            <div className="w-full">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Additional Concepts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {additionalParams
                  .filter((param) => param.value && param.value.trim())
                  .map((param) => (
                    <div key={param.id} className="flex flex-col gap-1">
                      <label
                        htmlFor={`param-${param.id}`}
                        className="text-xs font-medium text-slate-700"
                      >
                        {param.label}
                      </label>
                      <Textarea
                        id={`param-${param.id}`}
                        value={param.value}
                        onChange={(e) => updateParameter(param.id, e.target.value)}
                        placeholder={`Enter ${param.label.toLowerCase()}...`}
                        className="text-xs h-16 p-2"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
          <div className="border-t border-slate-200 p-6 bg-slate-50">
            {saveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Original
              </Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  onClick={handleCopyAndClose}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={saving}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy and Close
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
};

export default React.memo(
  PromptEditorModal,
  (prevProps, nextProps) => prevProps.isOpen === nextProps.isOpen
);
