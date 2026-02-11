'use client';

import React, {
  useEffect,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

import { prettifyKey, stringifyValue, tryParseJson } from '@/lib/creative/structured-attributes';

type Block = { id: string; label: string; value: string; included: boolean };
type PropItem = { key: string; label: string; value: string };

type StructuredAttributesProps = {
  // Sections coming from buildGroupedSections (Title, Ad Text, Image / Visual Description, etc.)
  groupedSections: { title: string; text: string }[];
  // Optional callback that receives generated prompt JSON as string
  onGeneratedChange?: (val: string) => void;
  // Raw ad data – used as an additional property source
  ad?: Record<string, unknown>;
  // When true, do not initialize from or persist to localStorage — useful
  // when the component is embedded in a modal where original state must
  // be preserved per-opening.
  ignoreLocalStorage?: boolean;
};

export type StructuredAttributesRef = {
  // Allows parent component to apply external JSON into the blocks
  applyJson?: (obj: Record<string, unknown>) => void;
  // Reset blocks to initial state built from sections/ad and optionally apply JSON
  resetToInitial?: (obj?: Record<string, unknown>) => void;
} | null;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Normalize keys/labels to compare them safely (supports EN + UA characters).
 */
function normalizeKey(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0400-\u04FF]+/g, '');
}

// Strict mapping for known prompt-related fields from raw_json structure
const PROMPT_FIELDS: { jsonKey: string; label: string; outKey: string }[] = [
  // creative_concepts fields
  { jsonKey: 'Hook', label: 'Hook', outKey: 'Hook' },
  { jsonKey: 'Topic', label: 'Topic', outKey: 'Topic' },
  { jsonKey: 'Concept', label: 'Concept', outKey: 'Concept' },
  { jsonKey: 'Realisation', label: 'Realisation', outKey: 'Realisation' },
  { jsonKey: 'Persona', label: 'Persona', outKey: 'Persona' },
  // Description and metadata
  { jsonKey: 'ai_description', label: 'AI Description', outKey: 'ai_description' },
  { jsonKey: 'audio_script', label: 'Audio Script', outKey: 'audio_script' },
  { jsonKey: 'video_script', label: 'Video Script', outKey: 'video_script' },
  // visual_details.style fields
  { jsonKey: 'aesthetics', label: 'Aesthetics', outKey: 'aesthetics' },
  { jsonKey: 'dominant_color', label: 'Dominant Color', outKey: 'dominant_color' },
  // visual_details.overlays fields
  { jsonKey: 'has_text', label: 'Has Text', outKey: 'has_text' },
  { jsonKey: 'cta_button', label: 'CTA Button', outKey: 'cta_button' },
  { jsonKey: 'text_content', label: 'Text Content', outKey: 'text_content' },
  // visual_details.subjects fields
  { jsonKey: 'subject_count', label: 'Subject Count', outKey: 'subject_count' },
  { jsonKey: 'gender', label: 'Gender', outKey: 'gender' },
  { jsonKey: 'emotion', label: 'Emotion', outKey: 'emotion' },
  { jsonKey: 'age_group', label: 'Age Group', outKey: 'age_group' },
  { jsonKey: 'appearance', label: 'Appearance', outKey: 'appearance' },
  // visual_details.environment fields
  { jsonKey: 'setting_type', label: 'Setting Type', outKey: 'setting_type' },
  { jsonKey: 'lighting', label: 'Lighting', outKey: 'lighting' },
];

// Fallback section titles used when JSON / strict fields are not available
// Aligned with raw_json creative_concepts structure
const INITIAL_KEYS = ['Hook', 'Topic', 'Concept', 'Realisation', 'Persona'];

// Default blocks that must exist in the main list (UI + final prompt)
// Aligned with raw_json structure (creative_concepts + visual_details)
const DEFAULT_FIELDS: { label: string; value: string }[] = [
  // Creative concepts
  { label: 'Hook', value: '' },
  { label: 'Topic', value: '' },
  { label: 'Concept', value: '' },
  { label: 'Realisation', value: '' },
  { label: 'Persona', value: '' },
  // Descriptions
  { label: 'AI Description', value: '' },
  { label: 'Audio Script', value: '' },
  { label: 'Video Script', value: '' },
  // Visual details - style
  { label: 'Aesthetics', value: '' },
  { label: 'Dominant Color', value: '' },
  // Visual details - overlays
  { label: 'Has Text', value: '' },
  { label: 'CTA Button', value: '' },
  { label: 'Text Content', value: '' },
  // Visual details - subjects
  { label: 'Subject Count', value: '' },
  { label: 'Gender', value: '' },
  { label: 'Emotion', value: '' },
  { label: 'Age Group', value: '' },
  { label: 'Appearance', value: '' },
  // Visual details - environment
  { label: 'Setting Type', value: '' },
  { label: 'Lighting', value: '' },
];

// Default props for Available Properties (derived from DEFAULT_FIELDS → no duplication)
// const DEFAULT_PROP_ITEMS: PropItem[] = DEFAULT_FIELDS.map((f) => ({
//   key: normalizeKey(f.label) || f.label,
//   label: f.label,
//   value: f.value,
// }));

// Short label overrides for clarity in the Available Properties pills
const SHORT_LABELS: Record<string, string> = {
  Id: 'Id',
  'Created At': 'Created',
  'Ad Archive Id': 'Archive Id',
  'Page Name': 'Page',
  'Cta Text': 'CTA',
  'Display Format': 'Format',
  'Link Url': 'Link',
  'Publisher Platform': 'Platform',
  'Meta Ad Url': 'Meta URL',
  // creative_concepts fields
  Hook: 'Hook',
  Topic: 'Topic',
  Concept: 'Concept',
  Realisation: 'Realisation',
  Persona: 'Persona',
  // Descriptions
  'AI Description': 'AI Desc',
  'Audio Script': 'Audio',
  'Video Script': 'Video',
  // Visual details
  Aesthetics: 'Aesthetics',
  'Dominant Color': 'Main Color',
  'Has Text': 'Has Text',
  'CTA Button': 'CTA Button',
  'Text Content': 'Text',
  'Subject Count': 'Subjects',
  Gender: 'Gender',
  Emotion: 'Emotion',
  'Age Group': 'Age',
  Appearance: 'Appearance',
  'Setting Type': 'Setting',
  Lighting: 'Lighting',
};

const MAX_PILL_LABEL_LEN = 26;

/**
 * Convert raw label into a more human readable form:
 *  - replace underscores / dots with spaces
 *  - collapse multiple spaces
 *  - Title Case each word (keep acronyms as-is)
 */
function humanizeLabel(label: string): string {
  const cleaned = label
    .replace(/[_\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ');
  return words
    .map((w) => {
      if (!w) return '';
      // Keep pure acronyms like CTA / AI etc.
      if (w.toUpperCase() === w) return w;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Truncate label at word boundary where possible.
 */
function truncateLabel(label: string, max = MAX_PILL_LABEL_LEN): string {
  if (label.length <= max) return label;
  const cut = label.lastIndexOf(' ', max - 1);
  const slicePoint = cut > 10 ? cut : max;
  const sliced = label.slice(0, slicePoint);
  return `${sliced.trim()}…`;
}

/**
 * Final formatter for pill labels:
 *  - apply SHORT_LABELS override if exists
 *  - otherwise humanize and then truncate
 */
function formatPillLabel(label: string): string {
  const override = SHORT_LABELS[label];
  if (override) return override;
  const human = humanizeLabel(label);
  return truncateLabel(human || label);
}

const StructuredAttributes = (
  { groupedSections, onGeneratedChange, ad, ignoreLocalStorage = false }: StructuredAttributesProps,
  ref: React.Ref<StructuredAttributesRef>
) => {
  const format = 'json' as const;

  /**
   * Build initial blocks from:
   *  - grouped sections (Topic, Character, etc.)
   *  - DEFAULT_FIELDS (ensures minimal prompt scaffold)
   */
  const mapFromSections = (): Block[] => {
    const out: Block[] = [];

    const addPromptField = (cfg: { jsonKey: string; label: string; outKey: string }) => {
      let raw: unknown;

      // First, try to read from raw_json (supporting nested paths)
      if (ad && ad.raw_json) {
        try {
          let rawJson: Record<string, unknown> | null = null;
          if (typeof ad.raw_json === 'string') {
            rawJson = JSON.parse(ad.raw_json as string);
          } else if (typeof ad.raw_json === 'object') {
            rawJson = ad.raw_json as Record<string, unknown>;
          }

          if (rawJson) {
            // Try creative_concepts first
            if (rawJson.creative_concepts) {
              const creativeConcepts = rawJson.creative_concepts as Record<string, unknown>;
              if (Object.prototype.hasOwnProperty.call(creativeConcepts, cfg.jsonKey)) {
                raw = creativeConcepts[cfg.jsonKey];
              }
            }

            // Try top-level (ai_description, audio_script, video_script)
            if (raw === undefined && Object.prototype.hasOwnProperty.call(rawJson, cfg.jsonKey)) {
              raw = rawJson[cfg.jsonKey];
            }

            // Try visual_details nested paths
            if (raw === undefined && rawJson.visual_details) {
              const visualDetails = rawJson.visual_details as Record<string, unknown>;

              // Check nested paths: visual_details.style, visual_details.overlays, etc.
              const nestedPaths: Record<string, string> = {
                aesthetics: 'style.aesthetics',
                dominant_color: 'style.dominant_color',
                has_text: 'overlays.has_text',
                cta_button: 'overlays.cta_button',
                text_content: 'overlays.text_content',
                subject_count: 'subjects.count',
                gender: 'subjects.gender',
                emotion: 'subjects.emotion',
                age_group: 'subjects.age_group',
                appearance: 'subjects.appearance',
                setting_type: 'environment.setting_type',
              };

              const path = nestedPaths[cfg.jsonKey];
              if (path) {
                const parts = path.split('.');
                let current: unknown = visualDetails;
                for (const part of parts) {
                  if (current && typeof current === 'object' && part in current) {
                    current = (current as Record<string, unknown>)[part];
                  } else {
                    current = undefined;
                    break;
                  }
                }
                raw = current;
              } else {
                // Direct property in visual_details
                raw = visualDetails[cfg.jsonKey];
              }
            }
          }
        } catch (e) {
          console.error('Error parsing raw_json:', e);
        }
      }

      // Fallback: try to read from ad itself
      if (raw === undefined && ad) {
        const rad = ad as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(rad, cfg.outKey)) {
          raw = rad[cfg.outKey];
        } else if (Object.prototype.hasOwnProperty.call(rad, cfg.jsonKey)) {
          raw = rad[cfg.jsonKey];
        }
      }

      if (raw === null || raw === undefined) return;

      const val = stringifyValue(raw);

      if (!val) return;

      // Avoid duplicates (same label + same value)
      if (out.some((b) => b.label === cfg.label && b.value === val)) return;

      out.push({
        id: uid(),
        label: cfg.label,
        value: val,
        included: true,
      });
    };

    // 2) strictly collect fields from creative_concepts
    for (const cfg of PROMPT_FIELDS) {
      addPromptField(cfg);
    }

    // video_script → Video Script (kept for video creatives)
    try {
      const vs =
        ad &&
        ((ad as Record<string, unknown>)['video_script'] ??
          (ad as Record<string, unknown>)['videoScript']);
      if (vs && typeof vs === 'string' && String(vs).trim()) {
        const parsed = tryParseJson(vs);
        if (parsed) {
          out.push({
            id: uid(),
            label: 'Video Script',
            value: JSON.stringify(parsed, null, 2),
            included: true,
          });
        } else {
          out.push({
            id: uid(),
            label: 'Video Script',
            value: String(vs).trim(),
            included: true,
          });
        }
      }
    } catch {
      // ignore
    }

    // 5) fallback: add grouped sections by title (Topic, Character, etc.)
    for (const key of INITIAL_KEYS) {
      if (out.find((b) => b.label === key)) continue;
      const s = groupedSections.find((g) => g.title.toLowerCase().includes(key.toLowerCase()));
      if (s && s.text && s.text.trim()) {
        out.push({ id: uid(), label: key, value: s.text.trim(), included: true });
      }
    }

    // Note: do not infer Topic from visual description; use grouped sections only

    // 7) ensure DEFAULT_FIELDS exist
    for (const def of DEFAULT_FIELDS) {
      const exists = out.some((b) => normalizeKey(b.label) === normalizeKey(def.label));
      if (!exists) {
        // Only add if it has a value, skip empty fields
        if (def.value && String(def.value).trim().length > 0) {
          out.push({ id: uid(), label: def.label, value: def.value, included: true });
        }
      }
    }

    return out;
  };

  const allProps = useMemo(() => {
    const result: PropItem[] = [];
    const seen = new Set<string>();

    if (ad && ad.raw_json) {
      try {
        let rawJson: Record<string, unknown> | null = null;
        if (typeof ad.raw_json === 'string') {
          rawJson = JSON.parse(ad.raw_json as string);
        } else if (typeof ad.raw_json === 'object' && ad.raw_json !== null) {
          rawJson = ad.raw_json as Record<string, unknown>;
        }

        if (rawJson) {
          // Helper to extract value from raw_json with nested path support
          const extractValue = (cfg: { jsonKey: string; label: string }) => {
            let raw: unknown;

            // Try creative_concepts first
            if (rawJson!.creative_concepts) {
              const creativeConcepts = rawJson!.creative_concepts as Record<string, unknown>;
              if (Object.prototype.hasOwnProperty.call(creativeConcepts, cfg.jsonKey)) {
                raw = creativeConcepts[cfg.jsonKey];
              }
            }

            // Try top-level (ai_description, audio_script, video_script)
            if (raw === undefined && Object.prototype.hasOwnProperty.call(rawJson!, cfg.jsonKey)) {
              raw = rawJson![cfg.jsonKey];
            }

            // Try visual_details nested paths
            if (raw === undefined && rawJson!.visual_details) {
              const visualDetails = rawJson!.visual_details as Record<string, unknown>;

              const nestedPaths: Record<string, string> = {
                aesthetics: 'style.aesthetics',
                dominant_color: 'style.dominant_color',
                has_text: 'overlays.has_text',
                cta_button: 'overlays.cta_button',
                text_content: 'overlays.text_content',
                subject_count: 'subjects.count',
                gender: 'subjects.gender',
                emotion: 'subjects.emotion',
                age_group: 'subjects.age_group',
                appearance: 'subjects.appearance',
                setting_type: 'environment.setting_type',
                lighting: 'environment.lighting',
              };

              const path = nestedPaths[cfg.jsonKey];
              if (path) {
                const parts = path.split('.');
                let current: unknown = visualDetails;
                for (const part of parts) {
                  if (current && typeof current === 'object' && part in current) {
                    current = (current as Record<string, unknown>)[part];
                  } else {
                    current = undefined;
                    break;
                  }
                }
                raw = current;
              }
            }

            // Convert to string, handle arrays
            let val: string;
            if (raw === null || raw === undefined || raw === '') {
              val = 'N/A';
            } else if (Array.isArray(raw)) {
              val = raw.length > 0 ? raw.map((item) => String(item)).join(', ') : 'N/A';
            } else {
              val = String(raw).trim() || 'N/A';
            }

            return val;
          };

          // Extract all PROMPT_FIELDS from raw_json
          for (const cfg of PROMPT_FIELDS) {
            const normalizedKey = normalizeKey(cfg.label);
            if (!seen.has(normalizedKey)) {
              const value = extractValue(cfg);
              result.push({
                key: normalizedKey,
                label: cfg.label,
                value: value,
              });
              seen.add(normalizedKey);
            }
          }
        }
      } catch (e) {
        console.error('[StructuredAttributes] Error parsing raw_json:', e);
      }
    }

    // If no raw_json, add all PROMPT_FIELDS with N/A
    if (result.length === 0) {
      for (const cfg of PROMPT_FIELDS) {
        const normalizedKey = normalizeKey(cfg.label);
        if (!seen.has(normalizedKey)) {
          result.push({
            key: normalizedKey,
            label: cfg.label,
            value: 'N/A',
          });
          seen.add(normalizedKey);
        }
      }
    }

    return result.filter((p) => p.value !== 'N/A');
  }, [ad]);

  /**
   * Blocks state:
   *  - loaded from localStorage if present (per pathname)
   *  - otherwise initialized from allProps
   */
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && allProps.length > 0) {
      const initialBlocks = allProps.map((p) => ({
        id: uid(),
        label: p.label,
        value: p.value,
        included: true,
      }));
      setBlocks(initialBlocks);
      setInitialized(true);
    }
  }, [allProps, initialized]);

  // Set of normalized labels used in blocks, to avoid duplicate properties
  const usedPropKeys = useMemo(() => {
    const s = new Set<string>();
    for (const b of blocks) {
      const k = normalizeKey(b.label);
      if (k) s.add(k);
    }
    return s;
  }, [blocks]);

  /**
   * Autosave blocks to localStorage (per pathname).
   */
  useEffect(() => {
    if (ignoreLocalStorage) return;
    if (typeof window === 'undefined') return;
    const key = `structuredAttrs:${window.location.pathname || 'global'}`;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(blocks));
      } catch {
        // ignore
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [blocks, ignoreLocalStorage]);

  /**
   * When groupedSections change and there are no blocks yet,
   * rebuild from sections.
   */
  useEffect(() => {
    setBlocks((prev) => {
      if (prev && prev.length > 0) return prev;
      return mapFromSections();
    });
  }, [groupedSections]);

  const removeBlock = (id: string) => {
    setBlocks((b) => b.filter((x) => x.id !== id));
  };

  /**
   * Generate final prompt:
   *  - format "json": returns JSON with canonical keys
   *  - Automatically includes ALL available properties from allProps
   */
  const generatePrompt = useCallback((): string => {
    const included = blocks.filter((bl) => bl.included && bl.value && bl.value.trim());

    if (format === 'json') {
      const obj: Record<string, string> = {};

      // 1. First, add values from editor blocks (user-edited values)
      for (const bl of included) {
        const cfg = PROMPT_FIELDS.find((f) => f.label === bl.label);
        let key: string;
        if (cfg) {
          key = cfg.outKey;
        } else {
          key = bl.label
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim()
            .toLowerCase()
            .split(' ')
            .map((w, idx) => (idx === 0 ? w : w[0].toUpperCase() + w.slice(1)))
            .join('');
        }
        obj[key] = bl.value.trim();
      }

      return JSON.stringify(obj, null, 2);
    }

    // Currently not used; kept for possible future extension.
    return '';
  }, [blocks, format]);

  /**
   * Notify parent when generated JSON changes.
   */
  useEffect(() => {
    if (onGeneratedChange) onGeneratedChange(generatePrompt());
  }, [blocks, generatePrompt, onGeneratedChange]);

  /**
   * Allow parent component to "apply JSON into blocks":
   *  - match by normalized label
   *  - update existing blocks
   *  - append unknown keys as new blocks
   */
  // helper to apply JSON into blocks (re-usable by resetToInitial)
  const applyJsonInternal = (obj: Record<string, unknown>) => {
    if (!obj || typeof obj !== 'object') return;
    setBlocks((prev) => {
      const copy = [...prev];
      const usedKeys = new Set<string>();

      // normalized key map for lookup
      const normObj: Record<string, string> = {};
      for (const k of Object.keys(obj)) {
        const nk = normalizeKey(k);
        normObj[nk] = k;
      }

      // update existing blocks where label matches
      for (let i = 0; i < copy.length; i++) {
        const blk = copy[i];
        const blkKey = normalizeKey(blk.label);
        const matchedObjKey = normObj[blkKey];
        if (matchedObjKey && Object.prototype.hasOwnProperty.call(obj, matchedObjKey)) {
          copy[i] = {
            ...blk,
            value: stringifyValue((obj as Record<string, unknown>)[matchedObjKey]),
            included: true,
          };
          usedKeys.add(matchedObjKey);
        }
      }

      // append leftover keys as new blocks
      for (const k of Object.keys(obj)) {
        if (usedKeys.has(k)) continue;
        copy.push({
          id: uid(),
          label: prettifyKey(k),
          value: stringifyValue((obj as Record<string, unknown>)[k]),
          included: true,
        });
      }
      return copy;
    });
  };

  useImperativeHandle(ref, () => ({
    applyJson: applyJsonInternal,
    resetToInitial: (obj?: Record<string, unknown>) => {
      try {
        // rebuild base blocks from sections/ad to restore original order
        setBlocks(mapFromSections());
        setGenerated(null);

        // If a JSON object is provided, apply it after the base blocks are set
        if (obj && typeof obj === 'object') {
          // schedule to ensure mapFromSections changes have applied
          setTimeout(() => {
            try {
              applyJsonInternal(obj);
            } catch (e) {
              // ignore
            }
          }, 0);
        }
      } catch (e) {
        // noop
      }
    },
  }));

  const [generated, setGenerated] = useState<string | null>(null);

  const copyGenerated = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
  };

  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-indigo-50 p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Structured Attributes</h2>
            <div className="text-sm text-slate-500">Concise, structured, ready-to-use</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Available properties (click to add to form) */}
          {allProps && allProps.length > 0 && (
            <div className="mb-2">
              <div className="text-sm font-medium mb-2">Available Properties</div>
              <div className="flex flex-wrap gap-2">
                {allProps.map((p) => {
                  const normalizedKey = normalizeKey(p.label);
                  const disabled = usedPropKeys.has(normalizedKey);
                  const pillLabel = formatPillLabel(p.label);

                  return (
                    <button
                      key={p.key}
                      onClick={() => {
                        if (disabled) return;
                        setBlocks((b) => [
                          ...b,
                          { id: uid(), label: p.label, value: p.value, included: true },
                        ]);
                      }}
                      className={`text-xs w-40 truncate text-wrap rounded-full px-6 py-1 text-left ${
                        disabled
                          ? 'bg-slate-50 text-slate-400 line-through'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                      title={disabled ? `${p.label} (used)` : `Add ${p.label}`}
                      aria-disabled={disabled}
                    >
                      {pillLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inline attributes form: compact grid */}
          <div className="grid grid-cols-2 gap-4">
            {blocks
              .filter((b) => b.value && b.value.trim())
              .map((b) => {
                const isTextarea = b.value && b.value.length > 50;
                return (
                  <div key={b.id} className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-black">{b.label}</label>
                    {isTextarea ? (
                      <Textarea
                        value={b.value}
                        onChange={(e) =>
                          setBlocks((prev) =>
                            prev.map((blk) =>
                              blk.id === b.id ? { ...blk, value: e.target.value } : blk
                            )
                          )
                        }
                        className="text-sm h-20 p-2"
                      />
                    ) : (
                      <Input
                        value={b.value}
                        onChange={(e) =>
                          setBlocks((prev) =>
                            prev.map((blk) =>
                              blk.id === b.id ? { ...blk, value: e.target.value } : blk
                            )
                          )
                        }
                        className="text-sm h-9"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBlock(b.id)}
                      className="h-7 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                );
              })}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const prompt = generatePrompt();
                setGenerated(prompt);
              }}
            >
              Generate Prompt
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBlocks(mapFromSections());
                setGenerated(null);
              }}
            >
              Reset
            </Button>
            {generated && (
              <Button variant="outline" onClick={copyGenerated}>
                <Copy className="h-4 w-4 mr-2" /> Copy
              </Button>
            )}
          </div>

          {/* Generated JSON preview */}
          {generated && (
            <div>
              <h3 className="text-sm font-medium mb-2">Generated Prompt (JSON)</h3>
              <Textarea value={generated} readOnly className="min-h-[120px] font-mono" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default forwardRef(StructuredAttributes);
