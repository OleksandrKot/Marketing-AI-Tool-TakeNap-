'use client';

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Trash2, Move } from 'lucide-react';

import {
  prettifyKey,
  stringifyValue,
  tryParseJson,
  flattenJsonToProps,
} from '@/lib/creative/structured-attributes';

type Block = { id: string; label: string; value: string; included: boolean };
type PropItem = { key: string; label: string; value: string };

type StructuredAttributesProps = {
  // Sections coming from buildGroupedSections (Title, Ad Text, Image / Visual Description, etc.)
  groupedSections: { title: string; text: string }[];
  // Optional callback that receives generated prompt JSON as string
  onGeneratedChange?: (val: string) => void;
  // Raw ad data – used as an additional property source
  ad?: Record<string, unknown>;
};

export type StructuredAttributesRef = {
  // Allows parent component to apply external JSON into the blocks
  applyJson?: (obj: Record<string, unknown>) => void;
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

// Strict mapping for known prompt-related fields.
const PROMPT_FIELDS: { jsonKey: string; label: string; outKey: string }[] = [
  // Core prompt fields (visual prompt)
  { jsonKey: 'subject', label: 'Subject', outKey: 'subject' },
  { jsonKey: 'scene', label: 'Scene', outKey: 'scene' },
  { jsonKey: 'style', label: 'Style', outKey: 'style' },
  { jsonKey: 'emotions', label: 'Emotions', outKey: 'emotions' },
  { jsonKey: 'text_on_image', label: 'Text on Image', outKey: 'text_on_image' },
  { jsonKey: 'textOnImage', label: 'Text on Image', outKey: 'text_on_image' },

  // Character (UA → unified EN-ish keys)
  { jsonKey: 'Character Gender', label: 'Character Gender', outKey: 'characterGender' },
  {
    jsonKey: 'Character Type',
    label: 'Character Type (realistic or fictional)',
    outKey: 'characterType',
  },
  { jsonKey: 'Body Type', label: 'Body Type', outKey: 'bodyType' },
  { jsonKey: 'Type', label: 'Type', outKey: 'type' },
  { jsonKey: 'Appearance Details', label: 'Appearance Details', outKey: 'appearanceDetails' },
  { jsonKey: 'Clothing', label: 'Clothing', outKey: 'clothing' },
  { jsonKey: 'Hair Color', label: 'Hair Color', outKey: 'hairColor' },
  { jsonKey: 'Pose', label: 'Pose', outKey: 'pose' },
  {
    jsonKey: 'Character Position in Frame',
    label: 'Character Position in Frame',
    outKey: 'characterPositionInFrame',
  },

  // Background / palette (UA → unified EN-ish keys)
  {
    jsonKey: 'Visual Color Palette',
    label: 'Visual Color Palette',
    outKey: 'visualColorPalette',
  },
  { jsonKey: 'Location', label: 'Location', outKey: 'location' },
  { jsonKey: 'Background Elements', label: 'Background Elements', outKey: 'backgroundElements' },
  {
    jsonKey: 'Background Element Details',
    label: 'Background Element Details',
    outKey: 'backgroundElementDetails',
  },
];

// Fallback section titles used when JSON / strict fields are not available
const INITIAL_KEYS = [
  'Topic',
  'Character',
  'Tone',
  'Scenario',
  'Hooks',
  'Camera Angles',
  'Color Palette',
  'Emotional State',
];

// Default blocks that must exist in the main list (UI + final prompt)
const DEFAULT_FIELDS: { label: string; value: string }[] = [
  { label: 'Character Gender', value: 'female/male' },
  { label: 'Character', value: 'realistic / fictional' },
  { label: 'Body Type', value: '' },
  { label: 'Type', value: '' },
  { label: 'Appearance Details', value: '' },
  { label: 'Clothing', value: '' },
  { label: 'Hair Color', value: '' },
  { label: 'Pose', value: '' },
  { label: 'Character Position in Frame', value: '' },
  { label: 'Emotions', value: 'Positive emotions such as warmth, happiness, comfort' },
  { label: 'Visual Color Palette', value: '' },
  { label: 'Location', value: '' },
  { label: 'Background Elements', value: '' },
  { label: 'Background Element Details', value: '' },
  { label: 'Scene', value: 'Warm indoor environment with soft ambient lighting' },
  { label: 'Style', value: 'Clean, modern, warm and inviting color palette' },
];

// Default props for Available Properties (derived from DEFAULT_FIELDS → no duplication)
const DEFAULT_PROP_ITEMS: PropItem[] = DEFAULT_FIELDS.map((f) => ({
  key: normalizeKey(f.label) || f.label,
  label: f.label,
  value: f.value,
}));

// Short label overrides for clarity in the Available Properties pills
const SHORT_LABELS: Record<string, string> = {
  Id: 'Id',
  'Created At': 'Created',
  'Ad Archive Id': 'Archive Id',
  'Page Name': 'Page',
  Text: 'Text',
  Caption: 'Caption',
  'Cta Text': 'CTA',
  'Cta Type': 'CTA Type',
  'Display Format': 'Format',
  'Link Url': 'Link',
  Title: 'Title',
  'Publisher Platform': 'Platform',
  'Meta Ad Url': 'Meta URL',
  'Image Url': 'Image',
  'Image Description': 'Image Desc',
  Concept: 'Concept',
  Realisation: 'Realisation',
  Topic: 'Topic',
  Hook: 'Hook',
  Character: 'Character',
  'New Scenario': 'New Scenario',
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
  { groupedSections, onGeneratedChange, ad }: StructuredAttributesProps,
  ref: React.Ref<StructuredAttributesRef>
) => {
  const format = 'json' as const;

  /**
   * Try to guess Topic from raw visual text.
   */
  const extractTopicFromVisual = (text: string) => {
    try {
      const m = text.match(/topic\s*[:\-]\s*(.+)/i);
      if (m && m[1]) return m[1].trim();
      const first = text.split(/\n/)[0];
      return first.trim().slice(0, 200);
    } catch {
      return '';
    }
  };

  /**
   * Build initial blocks from:
   *  - Image / Visual Description JSON
   *  - new_scenario / video_script
   *  - grouped sections (Topic, Character, etc.)
   *  - DEFAULT_FIELDS (ensures minimal prompt scaffold)
   */
  const mapFromSections = (): Block[] => {
    const out: Block[] = [];

    // 1) try to parse AiPrompt JSON from "Image / Visual Description" section
    const visual = groupedSections.find(
      (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
    );

    let visualJson: Record<string, unknown> | null = null;
    if (visual && visual.text) {
      const parsed = tryParseJson(visual.text || '') as unknown;
      if (parsed && typeof parsed === 'object') {
        visualJson = parsed as Record<string, unknown>;
      }
    }

    /**
     * Helper: take a value for a prompt field from:
     *  - visualJson[jsonKey] if present
     *  - fallback from ad (outKey or jsonKey)
     * and append it as a Block.
     */
    const addPromptField = (cfg: { jsonKey: string; label: string; outKey: string }) => {
      let raw: unknown;

      // Prefer value from visual prompt JSON
      if (visualJson && Object.prototype.hasOwnProperty.call(visualJson, cfg.jsonKey)) {
        raw = visualJson[cfg.jsonKey];
      }

      // If not found, try to read from ad itself
      if (raw === undefined && ad) {
        const rad = ad as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(rad, cfg.outKey)) {
          raw = rad[cfg.outKey];
        } else if (Object.prototype.hasOwnProperty.call(rad, cfg.jsonKey)) {
          raw = rad[cfg.jsonKey];
        }
      }

      if (raw === null || raw === undefined) return;
      const val = String(raw).trim();
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

    // 2) strictly collect AiPrompt fields (UA/EN → canonical labels)
    for (const cfg of PROMPT_FIELDS) {
      addPromptField(cfg);
    }

    // 3) new_scenario → Scenario
    try {
      const ns =
        ad &&
        ((ad as Record<string, unknown>)['new_scenario'] ??
          (ad as Record<string, unknown>)['newScenario']);
      if (ns) {
        if (typeof ns === 'string') {
          const parsed = tryParseJson(ns);
          if (parsed) {
            out.push({
              id: uid(),
              label: 'Scenario',
              value: JSON.stringify(parsed, null, 2),
              included: true,
            });
          } else {
            out.push({
              id: uid(),
              label: 'Scenario',
              value: String(ns),
              included: true,
            });
          }
        } else {
          out.push({
            id: uid(),
            label: 'Scenario',
            value: stringifyValue(ns),
            included: true,
          });
        }
      }
    } catch {
      // ignore
    }

    // 4) video_script → Video Script
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

    // 6) try to guess Topic from the visual description text, if not already set
    if (!out.find((b) => b.label === 'Topic') && visual && visual.text) {
      const topicGuess = extractTopicFromVisual(visual.text || '');
      if (topicGuess) {
        out.push({
          id: uid(),
          label: 'Topic',
          value: topicGuess,
          included: true,
        });
      }
    }

    // 7) ensure DEFAULT_FIELDS exist
    for (const def of DEFAULT_FIELDS) {
      const exists = out.some((b) => normalizeKey(b.label) === normalizeKey(def.label));
      if (!exists) {
        out.push({ id: uid(), label: def.label, value: def.value, included: true });
      }
    }

    return out;
  };

  /**
   * Blocks state:
   *  - loaded from localStorage if present (per pathname)
   *  - otherwise built from sections / ad data
   */
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const key = `structuredAttrs:${
        typeof window !== 'undefined' ? window.location.pathname : 'global'
      }`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Block[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return mapFromSections();
  });

  const dragIndex = useRef<number | null>(null);

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
   * Build a pool of available properties:
   *  - flat ad properties
   *  - nested JSON properties inside ad (flattened)
   *  - JSON from "Image / Visual Description" (flattened)
   *  - DEFAULT_PROP_ITEMS (for prompt-friendly fields)
   */
  const allProps = useMemo(() => {
    const result: PropItem[] = [];
    const seen = new Set<string>();

    if (ad) {
      // 1) top-level ad fields
      Object.entries(ad)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .forEach(([k, v]) => {
          const key = k;
          const label = prettifyKey(k);
          const value = stringifyValue(v);
          if (!value) return;
          if (seen.has(key)) return;
          seen.add(key);
          result.push({ key, label, value });
        });

      // 2) nested JSON inside string fields
      const nested: PropItem[] = [];
      for (const [k, v] of Object.entries(ad)) {
        if (typeof v !== 'string') continue;
        const parsed = tryParseJson(v);
        if (!parsed) continue;
        const buf: PropItem[] = [];
        flattenJsonToProps(buf, parsed, k);
        nested.push(...buf);
      }

      for (const item of nested) {
        const val = item.value?.trim();
        if (!val) continue;
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        result.push({ ...item, value: val });
      }
    }

    // 3) JSON from "Image / Visual Description" section
    const visual = groupedSections.find(
      (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
    );
    if (visual?.text) {
      const parsed = tryParseJson(visual.text) as unknown;
      if (parsed && typeof parsed === 'object') {
        const flat: PropItem[] = [];
        flattenJsonToProps(flat, parsed, '');
        for (const item of flat) {
          const val = item.value?.trim();
          if (!val) continue;
          if (seen.has(item.key)) continue;
          seen.add(item.key);
          result.push({ ...item, value: val });
        }
      }
    }

    // 4) default prompt-related props
    for (const def of DEFAULT_PROP_ITEMS) {
      if (seen.has(def.key)) continue;
      seen.add(def.key);
      result.push(def);
    }

    return result;
  }, [ad, groupedSections]);

  /**
   * Autosave blocks to localStorage (per pathname).
   */
  useEffect(() => {
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
  }, [blocks]);

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

  const onDragStart = (i: number) => {
    dragIndex.current = i;
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  /**
   * Drop handler:
   *  - if data starts with "prop:", we insert a new Block with that property
   *  - otherwise, we reorder existing blocks
   */
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const dt = e.dataTransfer.getData('text/plain') || '';

    if (dt.startsWith('prop:')) {
      const key = dt.slice('prop:'.length);
      const prop = allProps.find((p) => p.key === key);
      if (!prop) return;
      const newBlock: Block = {
        id: uid(),
        label: prop.label,
        value: prop.value,
        included: true,
      };
      setBlocks((b) => {
        const copy = [...b];
        copy.splice(i, 0, newBlock);
        return copy;
      });
      return;
    }

    const from = dragIndex.current;
    if (from === null || from === undefined) return;
    const to = i;
    if (from === to) return;
    setBlocks((b) => {
      const copy = [...b];
      const [m] = copy.splice(from, 1);
      copy.splice(to, 0, m);
      return copy;
    });
    dragIndex.current = null;
  };

  /**
   * Generate final prompt:
   *  - format "json": returns JSON with canonical keys
   */
  const generatePrompt = useCallback((): string => {
    const included = blocks.filter((bl) => bl.included && bl.value && bl.value.trim());

    if (format === 'json') {
      const obj: Record<string, string> = {};

      for (const bl of included) {
        // if label is known in PROMPT_FIELDS → use its outKey
        const cfg = PROMPT_FIELDS.find((f) => f.label === bl.label);
        let key: string;
        if (cfg) {
          key = cfg.outKey;
        } else {
          // fallback: camelCase from label
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
  useImperativeHandle(ref, () => ({
    applyJson: (obj: Record<string, unknown>) => {
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
          {/* Available properties (for drag & click) */}
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
                      draggable={!disabled}
                      onDragStart={(e) => {
                        if (disabled) return;
                        e.dataTransfer.setData('text/plain', `prop:${p.key}`);
                      }}
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

          {/* Blocks list */}
          <div className="space-y-1">
            {blocks.map((b, i) => (
              <div
                key={b.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, i)}
                className="border rounded-md p-2 bg-white flex items-start gap-2 mb-1"
              >
                <div className="text-slate-400 mt-1 cursor-grab">
                  <Move className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-800 text-sm">{b.label}</div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
