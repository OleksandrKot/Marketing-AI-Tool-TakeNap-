'use client';

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Trash2, Move } from 'lucide-react';

type Block = { id: string; label: string; value: string; included: boolean };
type PropItem = { key: string; label: string; value: string };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

import {
  prettifyKey,
  stringifyValue,
  tryParseJson,
  flattenJsonToProps,
} from '@/lib/structuredAttrsUtils';

type StructuredAttributesProps = {
  groupedSections: { title: string; text: string }[];
  onGeneratedChange?: (val: string) => void;
  ad?: Record<string, unknown>;
};

type StructuredAttributesRef = { applyJson?: (obj: Record<string, unknown>) => void } | null;

const StructuredAttributes = (
  { groupedSections, onGeneratedChange, ad }: StructuredAttributesProps,
  ref: React.Ref<StructuredAttributesRef>
) => {
  const initialKeys = [
    'Topic',
    'Character',
    'Tone',
    'Scenario',
    'Hooks',
    'Camera Angles',
    'Color Palette',
    'Emotional State',
  ];

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

  const mapFromSections = (): Block[] => {
    const out: Block[] = [];

    // 1) Пытаемся достать structured JSON из "Image / Visual Description"
    const visual = groupedSections.find(
      (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
    );

    if (visual && visual.text) {
      const parsed = tryParseJson(visual.text || '') as unknown;
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>;
        // это, скорее всего, AiPromptJson
        // берём оттуда несколько ключевых штук как стартовые блоки
        try {
          const topic =
            (p['scene'] &&
              typeof p['scene'] === 'object' &&
              (p['scene'] as Record<string, unknown>)['subject']) ||
            (p['text_elements'] &&
              typeof p['text_elements'] === 'object' &&
              (p['text_elements'] as Record<string, unknown>)['headline']) ||
            (p['targeting'] &&
              typeof p['targeting'] === 'object' &&
              (p['targeting'] as Record<string, unknown>)['audience']) ||
            '';
          if (topic) {
            out.push({
              id: uid(),
              label: 'Topic',
              value: String(topic),
              included: true,
            });
          }

          const character =
            (p['character'] &&
              typeof p['character'] === 'object' &&
              (p['character'] as Record<string, unknown>)['appearance']) ||
            (p['character'] &&
              typeof p['character'] === 'object' &&
              (p['character'] as Record<string, unknown>)['role']) ||
            (p['character'] &&
              typeof p['character'] === 'object' &&
              (p['character'] as Record<string, unknown>)['personality']) ||
            '';
          if (character) {
            out.push({
              id: uid(),
              label: 'Character',
              value: String(character),
              included: true,
            });
          }

          const tone =
            (p['visual_style'] &&
              typeof p['visual_style'] === 'object' &&
              (p['visual_style'] as Record<string, unknown>)['mood']) ||
            '';
          if (tone) {
            out.push({
              id: uid(),
              label: 'Tone',
              value: String(tone),
              included: true,
            });
          }

          const colors =
            (p['visual_style'] &&
              typeof p['visual_style'] === 'object' &&
              (p['visual_style'] as Record<string, unknown>)['colors']) ||
            '';
          if (colors) {
            out.push({
              id: uid(),
              label: 'Color Palette',
              value: String(colors),
              included: true,
            });
          }

          const cameraAngle =
            (p['scene'] &&
              typeof p['scene'] === 'object' &&
              (p['scene'] as Record<string, unknown>)['camera_angle']) ||
            '';
          if (cameraAngle) {
            out.push({
              id: uid(),
              label: 'Camera Angles',
              value: String(cameraAngle),
              included: true,
            });
          }

          const emotion =
            (p['visual_style'] &&
              typeof p['visual_style'] === 'object' &&
              (p['visual_style'] as Record<string, unknown>)['mood']) ||
            (p['targeting'] &&
              typeof p['targeting'] === 'object' &&
              (p['targeting'] as Record<string, unknown>)['pain_points']) ||
            (p['character'] &&
              typeof p['character'] === 'object' &&
              (p['character'] as Record<string, unknown>)['personality']) ||
            '';
          if (emotion) {
            out.push({
              id: uid(),
              label: 'Emotional State',
              value: String(emotion),
              included: true,
            });
          }
        } catch {
          // если что-то пошло не так — просто игнорим, ниже всё равно будут fallback'и
        }
      }
    }

    // 2) new_scenario / newScenario — как отдельный редактируемый блок
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
              label: 'New Scenario',
              value: JSON.stringify(parsed, null, 2),
              included: true,
            });
          } else {
            out.push({
              id: uid(),
              label: 'New Scenario',
              value: String(ns),
              included: true,
            });
          }
        } else {
          out.push({
            id: uid(),
            label: 'New Scenario',
            value: stringifyValue(ns),
            included: true,
          });
        }
      }
    } catch {
      /* ignore */
    }

    // 3) video_script / videoScript — тоже блок
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
      /* ignore */
    }

    // 4) Fallback по заголовкам секций (старое поведение)
    for (const key of initialKeys) {
      if (out.find((b) => b.label === key)) continue;
      const s = groupedSections.find((g) => g.title.toLowerCase().includes(key.toLowerCase()));
      if (s && s.text && s.text.trim()) {
        out.push({ id: uid(), label: key, value: s.text.trim(), included: true });
      }
    }

    // 5) Если всё ещё нет Topic — достаём из текста визуалки
    if (!out.find((b) => b.label === 'Topic') && visual && visual.text) {
      out.push({
        id: uid(),
        label: 'Topic',
        value: extractTopicFromVisual(visual.text || ''),
        included: true,
      });
    }

    return out;
  };

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
      /* ignore */
    }
    return mapFromSections();
  });

  const dragIndex = useRef<number | null>(null);
  const [format] = useState<'json' | 'llm'>('json');

  /**
   * Собираем все доступные свойства:
   *  - плоские поля ad
   *  - все вложенные JSON из строковых полей ad (videoScript/newScenario и т.д.)
   *  - AiPromptJson из секции "Image / Visual Description"
   */
  const usedPropKeys = useMemo(() => {
    const s = new Set<string>();
    for (const b of blocks) {
      const k = b.label.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
      if (k) s.add(k);
    }
    return s;
  }, [blocks]);

  const allProps = useMemo(() => {
    const result: PropItem[] = [];
    const seen = new Set<string>();

    // 1) плоские поля ad
    if (ad) {
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

      // 2) вложенные JSON из строковых полей ad
      const nested: PropItem[] = [];
      for (const [k, v] of Object.entries(ad)) {
        if (typeof v !== 'string') continue;
        const parsed = tryParseJson(v);
        if (!parsed) continue;
        const buf: { key: string; label: string; value: string }[] = [];
        // prefix = k, чтобы получились ключи вроде "videoScript.Hook"
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

    // 3) AiPromptJson из секции "Image / Visual Description"
    const visual = groupedSections.find(
      (g) => g.title === 'Image / Visual Description' || g.title === 'Visual Description'
    );
    if (visual?.text) {
      const parsed = tryParseJson(visual.text) as unknown;
      if (parsed && typeof parsed === 'object') {
        const flat: { key: string; label: string; value: string }[] = [];
        // prefix = '' → ключи вида "scene.subject", "visual_style.mood"
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

    return result;
  }, [ad, groupedSections, usedPropKeys]);

  // autosave
  useEffect(() => {
    const key = `structuredAttrs:${
      typeof window !== 'undefined' ? window.location.pathname : 'global'
    }`;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(blocks));
      } catch {
        /* ignore */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [blocks]);

  useEffect(() => {
    setBlocks((prev) => {
      if (prev && prev.length > 0) return prev;
      return mapFromSections();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const dt = e.dataTransfer.getData('text/plain') || '';

    // drag из Available Properties: "prop:<key>"
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

  const generatePrompt = useCallback((): string => {
    const included = blocks.filter((bl) => bl.included && bl.value && bl.value.trim());
    if (format === 'json') {
      const obj: Record<string, string> = {};
      for (const bl of included) {
        const key = bl.label
          .replace(/[^a-zA-Z0-9]+/g, ' ')
          .trim()
          .toLowerCase()
          .split(' ')
          .map((w, idx) => (idx === 0 ? w : w[0].toUpperCase() + w.slice(1)))
          .join('');
        obj[key] = bl.value.trim();
      }
      return JSON.stringify(obj, null, 2);
    }

    const lines: string[] = [];
    lines.push('Generate a concise, ready-to-use creative prompt using the following attributes:');
    for (const bl of included) {
      lines.push(`- ${bl.label}: ${bl.value.trim()}`);
    }
    return lines.join('\n');
  }, [blocks, format]);

  useEffect(() => {
    if (onGeneratedChange) onGeneratedChange(generatePrompt());
  }, [blocks, format, generatePrompt, onGeneratedChange]);

  useImperativeHandle(ref, () => ({
    applyJson: (obj: Record<string, unknown>) => {
      if (!obj || typeof obj !== 'object') return;
      setBlocks((prev) => {
        const copy = [...prev];
        const usedKeys = new Set<string>();

        const normObj: Record<string, string> = {};
        for (const k of Object.keys(obj)) {
          const nk = k.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
          normObj[nk] = k;
        }

        for (let i = 0; i < copy.length; i++) {
          const blk = copy[i];
          const blkKey = blk.label.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
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
        <div className="bg-indigo-50 p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Structured Attributes</h2>
            <div className="text-sm text-slate-500">Concise, structured, ready-to-use</div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {allProps && allProps.length > 0 && (
            <div className="mb-2">
              <div className="text-sm font-medium mb-2">Available Properties</div>
              <div className="flex flex-wrap gap-2">
                {allProps.map((p) => {
                  const normalizedKey = p.key.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
                  const disabled = usedPropKeys.has(normalizedKey);

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
                      className={`text-xs rounded-full px-3 py-1 ${
                        disabled
                          ? 'bg-slate-50 text-slate-400 line-through'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                      title={disabled ? `${p.label} (used)` : `Add ${p.label}`}
                      aria-disabled={disabled}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          <div className="flex items-center gap-2">
            <Button onClick={() => setGenerated(generatePrompt())}>Generate Prompt</Button>
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
