'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import Header from '@/app/ad-archive-browser/components/Header';
import { getPublicImageUrl, isStorageUrl } from '@/lib/storage/helpers';
import { createClientSupabaseClient } from '@/lib/core/supabase';
import { useToast } from '@/components/ui/toast';
import dynamic from 'next/dynamic';
const DynamicStructuredAttributesModal = dynamic(
  () => import('@/app/creative/[id]/components/StructuredAttributesModal').then((m) => m.default),
  { ssr: false, loading: () => <div className="p-4">Loading editor...</div> }
);

// NOTE: StructuredAttributes editor can be heavy and may import browser-only APIs.
// Temporarily avoid dynamic importing it at build/prerender time to prevent prerender errors.
// We keep a client-only placeholder UI instead; the editor can be re-enabled later.

// --- ВНЕШНИЙ КОМПОНЕНТ С SUSPENSE ---
export default function CreateAdaptationPage() {
  return (
    <Suspense fallback={null}>
      <CreateAdaptationPageInner />
    </Suspense>
  );
}

// --- ВНУТРЕННИЙ КЛИЕНТСКИЙ КОМПОНЕНТ, ГДЕ ИСПОЛЬЗУЕТСЯ useSearchParams ---
function CreateAdaptationPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dataParam = searchParams?.get('data') || '';
  const [prefill, setPrefill] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // generatedFromAttrs and structuredRef removed; Short Prompt is the single source
  const [autoFilled, setAutoFilled] = useState(false);
  const [showAttrEditor, setShowAttrEditor] = useState(true);
  // Short Prompt is the single source; parsed/applied on demand when user clicks Apply

  // decode prefill payload from query param `data`
  useEffect(() => {
    if (!dataParam) return;
    try {
      const decoded = decodeURIComponent(dataParam);
      let json = decoded;
      if (!decoded.trim().startsWith('{')) {
        try {
          json = atob(decoded);
        } catch (_) {
          // keep original
        }
      }
      const obj = JSON.parse(json);
      setPrefill(obj || {});
    } catch (e) {
      console.error('Failed to decode prefill data', e);
    }
  }, [dataParam]);

  // Short Prompt JSON (if present) will be parsed/applied on demand via Apply button

  const tryParse = (s: unknown) => {
    if (!s || typeof s !== 'string') return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  // mapping from display keys (labels) to canonical English keys
  const displayToEnglish: Record<string, string> = {
    'гендер персонажу': 'gender',
    персонаж: 'character',
    'тип фігури': 'body_type',
    тип: 'format',
    'особливості зовнішності': 'appearance',
    одяг: 'clothing',
    'колір волосся': 'hair_color',
    поза: 'pose',
    'розташування персонажа у кадрі': 'position_in_frame',
    emotions: 'emotions',
    'кольорова палітра візуалу': 'color_palette',
    локація: 'location',
    'елементи заднього фону': 'background_elements',
    'особливості елементів заднього фону': 'background_features',
    scene: 'scene',
    style: 'style',
    text_on_image: 'text_on_image',
  };

  // reverse map: english -> preferred display key
  const englishToDisplay: Record<string, string> = {};
  for (const k of Object.keys(displayToEnglish)) {
    englishToDisplay[displayToEnglish[k]] = k;
  }

  // StructuredAttributes dynamic loader intentionally disabled to avoid server-side prerender issues.
  // If you want to re-enable it, replace the aside placeholder below with a dynamic import.

  const normalizeKey = (k: string) =>
    String(k)
      .toLowerCase()
      .replace(/[\s_\-]+/g, '')
      .replace(/[^\w\u0400-\u04FF]/g, '');

  // мощное автозаполнение из всех источников
  useEffect(() => {
    if (!prefill || Object.keys(prefill).length === 0) return;
    if (autoFilled) return;

    const grouped = Array.isArray(prefill.groupedSections)
      ? (prefill.groupedSections as unknown[])
      : [];

    const sources: Record<string, unknown>[] = [];

    if (
      prefill.shortPromptJson &&
      typeof prefill.shortPromptJson === 'object' &&
      !Array.isArray(prefill.shortPromptJson)
    ) {
      sources.push(prefill.shortPromptJson as Record<string, unknown>);
    }

    const spFromText =
      tryParse(prefill.shortPromptText) ||
      tryParse(prefill.shortPrompt) ||
      tryParse(prefill.imageVisualDescription);
    if (spFromText && typeof spFromText === 'object' && !Array.isArray(spFromText)) {
      sources.push(spFromText);
    }

    if (grouped.length) {
      for (const sec of grouped) {
        const title = String((sec as Record<string, unknown>).title || '');
        const text = String((sec as Record<string, unknown>).text || '');
        if (!text.trim()) continue;

        const parsed = tryParse(text);
        if (parsed && typeof parsed === 'object') {
          sources.push(parsed as Record<string, unknown>);
        } else {
          const obj: Record<string, string> = {};
          text.split('\n').forEach((line) => {
            const m = line.match(/^([^:]+):\s*(.+)$/);
            if (m && m[1] && m[2]) {
              obj[m[1].trim()] = m[2].trim();
            }
          });
          if (Object.keys(obj).length) sources.push(obj);

          if (/formats/i.test(title) || /creative concepts/i.test(title)) {
            const fc: Record<string, string> = {};
            text.split('\n').forEach((line) => {
              const m = line.match(/^([^:]+):\s*(.+)$/);
              if (m && m[1] && m[2]) {
                fc[m[1].trim()] = m[2].trim();
              }
            });
            if (Object.keys(fc).length) sources.push(fc);
          }
        }
      }
    }

    const fcc = prefill['Formats & Creative Concepts'] || prefill.formats;
    if (fcc) {
      if (typeof fcc === 'object') {
        sources.push(fcc as Record<string, unknown>);
      } else if (typeof fcc === 'string') {
        const parsed = tryParse(fcc);
        if (parsed && typeof parsed === 'object') {
          sources.push(parsed as Record<string, unknown>);
        } else {
          const obj: Record<string, string> = {};
          String(fcc)
            .split('\n')
            .forEach((line) => {
              const m = line.match(/^([^:]+):\s*(.+)$/);
              if (m && m[1] && m[2]) {
                obj[m[1].trim()] = m[2].trim();
              }
            });
          if (Object.keys(obj).length) sources.push(obj);
        }
      }
    }

    sources.push(prefill);

    const mapping: Record<string, string[]> = {
      scene: ['scene', 'location', 'setting'],
      style: ['style', 'visual style', 'aesthetic'],
      emotions: ['emotions', 'mood', 'feeling'],
      text_on_image: ['text_on_image', 'text on image', 'textonimage', 'copy'],
      персонаж: ['character', 'subject', 'person', 'герой'],
      'гендер персонажу': ['gender', 'gender of character', 'гендер'],
      тип: ['format', 'type', 'тип'],
      scene_alt: ['scene'],
    };

    const updates: Record<string, string> = {};

    const pickFromSources = (aliases: string[], currentValue: unknown): string | null => {
      if (currentValue && String(currentValue).trim() !== '') return null;
      const aliasNorms = aliases.map((a) => normalizeKey(a));
      for (const src of sources) {
        for (const [k, v] of Object.entries(src)) {
          if (v == null) continue;
          const nk = normalizeKey(k);
          if (aliasNorms.includes(nk)) {
            const str = String(v).trim();
            if (str) return str;
          }
        }
      }
      return null;
    };

    for (const [finalKey, aliases] of Object.entries(mapping)) {
      const cur = prefill[finalKey];
      const val = pickFromSources(aliases, cur);
      if (val) updates[finalKey] = val;
    }

    if (!updates['персонаж'] && (!prefill['персонаж'] || !String(prefill['персонаж']).trim())) {
      const sub = pickFromSources(['subject'], prefill['персонаж']);
      if (sub) updates['персонаж'] = sub;
    }

    if (Object.keys(updates).length) {
      setPrefill((prev) => ({ ...prev, ...updates }));
    }

    setAutoFilled(true);
  }, [prefill, autoFilled]);

  const setField = (key: string, value: string) => {
    // Avoid merging when user is editing the Short Prompt directly
    if (key === 'shortPromptText' || key === 'shortPromptJson') {
      setPrefill((p) => ({ ...p, [key]: value }));
      return;
    }

    setPrefill((p) => {
      const next = { ...p, [key]: value };

      try {
        // determine canonical english key for this display key
        const canonical = displayToEnglish[key] || key;

        // only merge attribute-like keys (those we know)
        if (canonical) {
          // start from existing shortPromptJson or try to parse shortPromptText
          let base: Record<string, unknown> = {};
          if (p.shortPromptJson && typeof p.shortPromptJson === 'object')
            base = { ...(p.shortPromptJson as Record<string, unknown>) };
          else if (p.shortPromptText && typeof p.shortPromptText === 'string') {
            try {
              const parsed = JSON.parse(p.shortPromptText);
              if (parsed && typeof parsed === 'object') base = { ...parsed };
            } catch (_) {
              // not JSON — ignore
            }
          }

          if (value === '' || value == null) delete base[canonical];
          else base[canonical] = value;

          next.shortPromptJson = base;
          next.shortPromptText = JSON.stringify(base, null, 2);
        }
      } catch (e) {
        // if anything fails, still return updated field without touching short prompt
      }

      return next;
    });
  };

  const handleApplyAttributesJson = (jsonText?: string | null) => {
    const payload =
      jsonText && typeof jsonText === 'string'
        ? jsonText
        : prefill?.shortPromptText
        ? String(prefill.shortPromptText)
        : prefill?.shortPromptJson
        ? JSON.stringify(prefill.shortPromptJson)
        : null;
    if (!payload) return;
    try {
      const obj = JSON.parse(payload) as Record<string, unknown>;
      setPrefill((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(obj)) {
          // if incoming keys are English, map to display key for inputs
          const displayKey = englishToDisplay[k] || k;
          next[displayKey] = String((obj as Record<string, unknown>)[k] ?? '');
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to apply Short Prompt JSON to fields', e);
    }
  };

  const { showToast } = useToast();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      console.debug('[CreateAdaptation] payload', prefill);

      // Prepare short prompt object: prefer structured JSON, otherwise try to parse text,
      // otherwise send text as { text: ... }
      const shortPromptObj: Record<string, unknown> =
        prefill.shortPromptJson && typeof prefill.shortPromptJson === 'object'
          ? (prefill.shortPromptJson as Record<string, unknown>)
          : prefill.shortPromptText && typeof prefill.shortPromptText === 'string'
          ? (() => {
              try {
                return JSON.parse(prefill.shortPromptText as string) as Record<string, unknown>;
              } catch {
                return { text: String(prefill.shortPromptText) };
              }
            })()
          : {};

      // Determine a reference image URL.
      // Priority:
      // 1) explicit signed/full URL fields on the prefill
      // 2) use `getPublicImageUrl` to build a storage URL from bucket + object key
      // helper removed: we build/validate URLs using tryBuildFromField and isStorageUrl

      const signed =
        (prefill as Record<string, unknown>).signed_image_url ||
        (prefill as Record<string, unknown>).signed_url ||
        (prefill as Record<string, unknown>).signedUrl ||
        (prefill as Record<string, unknown>).signed;

      const imageUrlField =
        (prefill as Record<string, unknown>).image_url ||
        (prefill as Record<string, unknown>).imageUrl ||
        (prefill as Record<string, unknown>).image;

      const videoPreviewField =
        (prefill as Record<string, unknown>).video_preview_image_url ||
        (prefill as Record<string, unknown>).video_preview_image ||
        (prefill as Record<string, unknown>).videoPreview;

      let reference_image_url = '';

      // If ad_archive_id (or camelCase `adArchiveId`) is present, prefer constructing a Supabase public URL from buckets
      const formatRaw =
        (prefill as Record<string, unknown>).display_format ||
        (prefill as Record<string, unknown>).displayFormat ||
        (prefill as Record<string, unknown>).format ||
        '';
      const formatStr = typeof formatRaw === 'string' ? formatRaw.toLowerCase() : '';
      const isVideo = formatStr === 'video' || formatStr.includes('video');
      const adArchiveIdRaw =
        (prefill as Record<string, unknown>).ad_archive_id ??
        (prefill as Record<string, unknown>).adArchiveId ??
        (prefill as Record<string, unknown>).adArchiveID ??
        (prefill as Record<string, unknown>).adId ??
        (prefill as Record<string, unknown>).ad_id ??
        null;

      if (adArchiveIdRaw) {
        const id = String(adArchiveIdRaw);
        const bucket = isVideo
          ? process.env.NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW ||
            process.env.AD_BUCKET_VIDEO_PREVIEW ||
            'test10public_preview'
          : process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO ||
            process.env.AD_BUCKET_PHOTO ||
            'test9bucket_photo';
        reference_image_url = getPublicImageUrl(`${bucket}/${id}.jpeg`);
      }

      // We intentionally IGNORE external full URLs (Facebook CDN etc.).
      // If ad_archive_id already provided above, we already used it. Otherwise, try to
      // accept only Supabase storage URLs or build them from object keys.
      if (!reference_image_url) {
        const photoBucket =
          process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO ??
          process.env.AD_BUCKET_PHOTO ??
          'test9bucket_photo';
        const videoBucket =
          process.env.NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW ??
          process.env.AD_BUCKET_VIDEO_PREVIEW ??
          'test10public_preview';

        const tryBuildFromField = (field: unknown, preferVideoBucket = false) => {
          if (typeof field !== 'string' || !field.trim()) return '';
          const s = String(field).trim();
          const raw = s.replace(/^\/+/, '');

          const supabaseBase =
            process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';

          // If it's already a Supabase storage URL (public) or a Supabase-signed URL, accept it
          try {
            if (supabaseBase && s.startsWith(supabaseBase)) return s;
          } catch (e) {}

          // Also accept storage public path URLs that our `isStorageUrl` recognizes
          if (isStorageUrl(s)) return s;

          // If it's an external full URL (http...) from other domains, ignore it
          if (/^https?:\/\//i.test(s)) return '';

          // Otherwise treat as storage object key and build public URL
          const bucket = preferVideoBucket ? videoBucket : photoBucket;
          return getPublicImageUrl(raw.includes('/') ? raw : `${bucket}/${raw}`);
        };

        // prefer signed/object keys that are storage or keys
        reference_image_url =
          tryBuildFromField(signed, Boolean(isVideo)) ||
          tryBuildFromField(videoPreviewField, true) ||
          tryBuildFromField(imageUrlField, false) ||
          '';

        // as ultimate fallback, if ad_archive_id/adArchiveId exists use it (already handled above but keep safety)
        if (!reference_image_url && adArchiveIdRaw) {
          const id = String(adArchiveIdRaw);
          const bucket = (prefill as Record<string, unknown>).display_format
            ? String((prefill as Record<string, unknown>).display_format)
                .toLowerCase()
                .includes('video')
              ? videoBucket
              : photoBucket
            : photoBucket;
          reference_image_url = getPublicImageUrl(`${bucket}/${id}.jpeg`);
        }
      }

      // Ensure Supabase public URLs that are inaccessible (private bucket) are
      // exchanged for signed URLs via our server-side `/api/sign-image` route.
      let final_reference_image_url = reference_image_url;
      try {
        const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        if (
          final_reference_image_url &&
          typeof final_reference_image_url === 'string' &&
          supabaseBase &&
          final_reference_image_url.startsWith(supabaseBase)
        ) {
          try {
            const head = await fetch(final_reference_image_url, { method: 'HEAD' });
            if (!head.ok) {
              // parse bucket/path from URL, expecting /storage/v1/object/public/<bucket>/<path>
              const marker = '/storage/v1/object/public/';
              const idx = final_reference_image_url.indexOf(marker);
              if (idx !== -1) {
                const rest = final_reference_image_url.slice(idx + marker.length);
                const [bucket, ...parts] = rest.split('/');
                const path = parts.join('/');
                if (bucket && path) {
                  try {
                    const resp = await fetch('/api/sign-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ bucket, path, expiresIn: 60 * 5 }),
                    });
                    if (resp.ok) {
                      const json = await resp.json();
                      if (json?.url) final_reference_image_url = json.url;
                    }
                  } catch (e) {
                    // ignore signing failure, keep original URL
                  }
                }
              }
            }
          } catch (e) {
            // network error on HEAD — ignore and continue
          }
        }
      } catch (e) {
        // swallow any issues here
      }

      // Try to attach current user id (if available) to the payload
      let userId: string | null = null;
      try {
        try {
          const client = createClientSupabaseClient();
          try {
            const resp = await client.auth.getUser();
            userId = resp?.data?.user?.id ?? null;
          } catch (e) {
            // older supabase client versions may use auth.getUser or auth.user(); ignore failures
            try {
              // @ts-expect-error older client API may exist
              const u = typeof client.auth.user === 'function' ? client.auth.user() : null;
              userId = u?.id ?? null;
            } catch {}
          }
        } catch (e) {
          // can't create client or get user; ignore
        }
      } catch {}

      // Extract specific fields requested for the webhook payload
      const pickPrefillValue = (keys: string[]) => {
        for (const k of keys) {
          // direct prefill key
          if ((prefill as Record<string, unknown>)[k])
            return (prefill as Record<string, unknown>)[k];
        }
        // try in shortPromptObj with various casings
        for (const k of keys) {
          const lk = String(k).toLowerCase();
          if (
            shortPromptObj &&
            typeof shortPromptObj === 'object' &&
            lk in (shortPromptObj as Record<string, unknown>)
          ) {
            return (shortPromptObj as Record<string, unknown>)[lk];
          }
          // also try original case in shortPromptObj
          if (
            shortPromptObj &&
            typeof shortPromptObj === 'object' &&
            k in (shortPromptObj as Record<string, unknown>)
          ) {
            return (shortPromptObj as Record<string, unknown>)[k];
          }
        }
        return null;
      };

      const conceptVal = pickPrefillValue(['Concept', 'concept', 'concepts']);
      const formatVal = pickPrefillValue(['Format', 'format']);
      const realisationVal = pickPrefillValue([
        'Realisation',
        'realisation',
        'Realization',
        'realization',
      ]);
      const hookkVal = pickPrefillValue(['Hookk', 'Hook', 'hook', 'hookk']);
      const characterVal = pickPrefillValue(['Character', 'character', 'персонаж']);

      const webhookBody = {
        type: 'generate_visual_prompt',
        payload: {
          reference_image_url: final_reference_image_url,
          user_prompt: shortPromptObj,
          user_id: userId,
          Concept: conceptVal ?? null,
          Format: formatVal ?? null,
          Realisation: realisationVal ?? null,
          Hook: hookkVal ?? null,
          Character: characterVal ?? null,
          ad_archive_id: adArchiveIdRaw ?? null,
        },
      };

      // Try to fetch the image and embed it as a data URL (base64) instead of sending a long external link.
      // If fetching or conversion fails, we keep sending the URL.
      try {
        const ref = webhookBody.payload.reference_image_url;
        if (typeof ref === 'string' && /^https?:\/\//i.test(ref)) {
          try {
            const r = await fetch(ref);
            if (r.ok) {
              const blob = await r.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = (err) => reject(err);
                reader.onloadend = () => resolve(String(reader.result));
                reader.readAsDataURL(blob);
              });
              // Replace URL with embedded data URL
              webhookBody.payload.reference_image_url = dataUrl;
              console.debug('[CreateAdaptation] embedded image into payload (data URL)', {
                length: dataUrl?.length ?? 0,
                type: blob.type || null,
              });
            } else {
              console.debug('[CreateAdaptation] image fetch failed, sending URL', {
                status: r.status,
              });
            }
          } catch (e) {
            console.debug('[CreateAdaptation] failed to fetch/encode image; sending URL', e);
          }
        }
      } catch (err) {
        // swallow
      }

      // Debug logs for fields used to build reference_image_url (original and final)
      try {
        console.debug('[CreateAdaptation] debug', {
          signed: signed ?? null,
          imageUrlField: imageUrlField ?? null,
          videoPreviewField: videoPreviewField ?? null,
          ad_archive_id: adArchiveIdRaw ?? null,
          original_reference_image_url: reference_image_url ?? null,
          reference_image_url: final_reference_image_url ?? null,
        });
      } catch {}

      // Notify user about the reference image being used
      try {
        showToast({
          message: `Sending webhook with image: ${reference_image_url || 'none'}`,
          ttl: 2500,
        });
      } catch (e) {
        // fail silently if toast not available
      }

      try {
        const resp = await fetch(
          process.env.MAKE_GENERATE_URL ||
            'https://hook.us2.make.com/uydqqpt8utq04dsii5t5wut50ileu199',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookBody),
          }
        );
        if (!resp.ok) {
          console.error('Webhook error status', resp.status);
          try {
            showToast({ message: `Webhook failed (${resp.status})`, type: 'error' });
          } catch {}
        } else {
          try {
            const json = await resp.json();
            console.debug('Webhook response', json);
          } catch {
            // ignore non-JSON response bodies
          }
          try {
            showToast({ message: 'Webhook sent successfully', type: 'success' });
          } catch {}
        }
      } catch (err) {
        console.error('Failed to call webhook', err);
        try {
          showToast({ message: 'Failed to send webhook', type: 'error' });
        } catch {}
      }

      // keep small delay for UX parity
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          <Header
            actions={
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="border-slate-300"
                >
                  Back
                </Button>
                <Button variant="ghost" onClick={() => router.push('/')}>
                  Home
                </Button>
                <Button variant="outline" onClick={() => router.push('/adaptations')}>
                  Adaptations
                </Button>
              </div>
            }
          />
        </div>
      </div>

      <div className="container mx-auto px-6 py-10 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Create Adaptation</h1>
            <p className="text-sm text-slate-600">
              Prefilled from the creative you came from. Edit and submit.
            </p>
          </div>
          {/* Actions moved into site header to match global styling */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl mb-6">
              <CardHeader className="p-6 border-b">
                <h2 className="text-lg font-semibold">Short Prompt</h2>
                <p className="text-sm text-slate-500">
                  This is filled from Content&apos;s Image / Visual Description (Short Prompt JSON)
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <textarea
                  value={String(
                    prefill.shortPromptJson
                      ? JSON.stringify(prefill.shortPromptJson as Record<string, unknown>, null, 2)
                      : prefill.shortPromptText ??
                          prefill.imageVisualDescription ??
                          prefill.visualDescription ??
                          ''
                  )}
                  onChange={(e) => setField('shortPromptText', e.target.value)}
                  className="w-full rounded-lg border p-3 min-h-[160px] text-sm font-mono"
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="p-6 border-b">
                <h2 className="text-lg font-semibold">Adaptation Attributes</h2>
                <p className="text-sm text-slate-500">
                  Auto-filled from the creative; edit as needed
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  ['гендер персонажу', 'Gender'],
                  ['персонаж', 'Character'],
                  ['Concept', 'Concept'],
                  ['Format', 'Format'],
                  ['Realisation', 'Realisation'],
                  ['Hookk', 'Hookk'],
                  ['Character', 'Character (short)'],
                  ['тип фігури', 'Body type'],
                  ['тип', 'Format'],
                  ['особливості зовнішності', 'Appearance details'],
                  ['одяг', 'Clothing'],
                  ['колір волосся', 'Hair color'],
                  ['поза', 'Pose'],
                  ['розташування персонажа у кадрі', 'Position in frame'],
                  ['emotions', 'Emotions'],
                  ['кольорова палітра візуалу', 'Color palette'],
                  ['локація', 'Location'],
                  ['елементи заднього фону', 'Background elements'],
                  ['особливості елементів заднього фону', 'Background features'],
                  ['scene', 'Scene'],
                  ['style', 'Style'],
                  ['text_on_image', 'Text on Image'],
                ].map(([k, label]) => (
                  <div key={String(k)}>
                    <label className="block text-sm text-slate-600 mb-1">{String(label)}</label>
                    <input
                      value={String(prefill[String(k)] ?? '')}
                      onChange={(e) => setField(String(k), e.target.value)}
                      className="w-full rounded-lg border p-2 text-sm"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="border-slate-300"
                  >
                    Cancel
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => handleApplyAttributesJson()}>
                      Apply Attributes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPrefill((prev) => {
                          const next = { ...prev };
                          next.shortPromptText = '';
                          const clearKeys = [
                            'scene',
                            'style',
                            'emotions',
                            'text_on_image',
                            'персонаж',
                            'гендер персонажу',
                            'тип',
                          ];
                          for (const k of clearKeys) delete next[k];
                          return next;
                        });
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="bg-orange-500 text-white"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Create Adaptation'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside>
            <div className="space-y-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-2">Attributes Editor</h3>
                  <p className="text-sm text-slate-500 mb-3">
                    Open the structured attributes editor to edit additional properties. Changes are
                    merged into Short Prompt as English keys.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAttrEditor((s) => !s)}>
                      {showAttrEditor ? 'Close Editor' : 'Open Attributes Editor'}
                    </Button>
                    <Button variant="ghost" onClick={() => handleApplyAttributesJson()}>
                      Apply Short Prompt
                    </Button>
                  </div>
                  {showAttrEditor ? (
                    <div className="mt-4">
                      <DynamicStructuredAttributesModal
                        groupedSections={
                          ((prefill as Record<string, unknown>)?.groupedSections as unknown as {
                            title: string;
                            text: string;
                          }[]) || []
                        }
                        ad={prefill}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
