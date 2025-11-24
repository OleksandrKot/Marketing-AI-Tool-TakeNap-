'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import ConfirmModal from '@/components/modals/confirm-modal';
// StructuredAttributes removed: all attribute work will be done via Short Prompt

const PageNavigation = dynamic(
  () => import('@/components/navigation/PageNavigation').then((m) => m.PageNavigation),
  { ssr: false, loading: () => null }
);
const ProfileDropdown = dynamic(
  () => import('@/app/login-auth/components/profile-dropdown').then((m) => m.ProfileDropdown),
  { ssr: false, loading: () => null }
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
  const [isOpenConfirm, setIsOpenConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // generatedFromAttrs and structuredRef removed; Short Prompt is the single source
  const [autoFilled, setAutoFilled] = useState(false);
  const [showAttrEditor, setShowAttrEditor] = useState(false);
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      console.debug('[CreateAdaptation] payload', prefill);
      await new Promise((r) => setTimeout(r, 800));
      setIsOpenConfirm(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between max-w-7xl">
          <PageNavigation currentPage="adaptations" />
          <ProfileDropdown />
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
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.back()} className="border-slate-300">
              Back
            </Button>
            <Button variant="ghost" onClick={() => router.push('/')}>
              Home
            </Button>
            <Button variant="outline" onClick={() => router.push('/adaptations')}>
              Adaptations
            </Button>
          </div>
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
                    <div className="mt-4 rounded border border-dashed p-4 bg-slate-50 text-sm text-slate-600">
                      The structured Attributes editor is disabled during prerender/build to avoid
                      server-side errors. It will be available at runtime in the browser.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmModal
        isOpen={isOpenConfirm}
        title="Adaptation Created"
        message={JSON.stringify(prefill, null, 2)}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => {
          setIsOpenConfirm(false);
          router.push('/adaptations');
        }}
        onCancel={() => setIsOpenConfirm(false)}
      />
    </div>
  );
}
