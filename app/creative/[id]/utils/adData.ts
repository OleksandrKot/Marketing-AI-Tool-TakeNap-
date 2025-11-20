import cleanAndSplit from './cleanAndSplit';

export const prettifyKey = (k: string) => {
  if (!k) return '';
  const parts = k
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1));
  return parts.join(' ');
};

export const toKeyString = (label: string) =>
  label
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w, idx) => (idx === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('');

export const stringifyValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);

  if (Array.isArray(v)) {
    return (v as unknown[])
      .map((x) => stringifyValue(x))
      .filter(Boolean)
      .join(', ');
  }

  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export const tryParseJson = (text?: string): unknown | null => {
  if (!text) return null;
  let candidate = String(text).trim();
  if (!candidate) return null;

  // Вырезаем fenced-блок
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    candidate = fence[1].trim();
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {}
    }

    const arrMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {}
    }
  }

  return null;
};

export type FlatJsonProp = {
  key: string;
  label: string;
  value: string;
};

export const STRUCTURED_ATTRS_CONFIG: Record<
  string,
  {
    label?: string;
    hidden?: boolean;
  }
> = {
  // AiPromptJson
  'creative_meta.type': { label: 'Creative Type' },
  'creative_meta.format': { label: 'Format' },
  'creative_meta.orientation': { label: 'Orientation' },
  'creative_meta.size': { label: 'Size' },
  'scene.subject': { label: 'Topic' },
  'scene.environment': { label: 'Scenario / Environment' },
  'scene.camera_shot': { label: 'Camera Shot' },
  'scene.camera_angle': { label: 'Camera Angle' },
  'visual_style.colors': { label: 'Color Palette' },
  'visual_style.mood': { label: 'Overall Mood' },
  'visual_style.lighting': { label: 'Lighting' },
  'visual_style.details': { label: 'Visual Details' },
  'character.role': { label: 'Character Role' },
  'character.appearance': { label: 'Character Appearance' },
  'character.personality': { label: 'Character Personality' },
  'text_elements.headline': { label: 'Headline' },
  'text_elements.body': { label: 'Body / Social Proof' },
  'text_elements.cta': { label: 'CTA Text' },

  // videoScript JSON
  'videoScript.Hook': { label: 'Video Hook' },
  'videoScript.CTA': { label: 'Video CTA' },
  'videoScript.Visual Description': { label: 'Video Visual Description' },
  'videoScript.Target Audience': { label: 'Video Target Audience' },
  'videoScript.Sound Transcription': { label: 'Video Sound' },
  'videoScript.Subtitles': { label: 'Video Subtitles', hidden: true },

  'newScenario[0].technical_task_json.visual_elements': {
    label: 'Scenario[0] Visual Elements',
  },
};

function pushFlatProp(target: FlatJsonProp[], logicalKey: string, rawValue: unknown) {
  const value = stringifyValue(rawValue);
  if (!value) return;

  const cfg = STRUCTURED_ATTRS_CONFIG[logicalKey];
  if (cfg?.hidden) return;

  const label = cfg?.label ?? prettifyKey(logicalKey);

  target.push({
    key: logicalKey,
    label,
    value,
  });
}

export const flattenJsonToProps = (target: FlatJsonProp[], value: unknown, prefix = ''): void => {
  if (value === null || value === undefined) return;

  const isPrimitive =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

  if (isPrimitive) {
    if (!prefix) return; // без имени не пушим
    pushFlatProp(target, prefix, value);
    return;
  }

  if (Array.isArray(value)) {
    const arr = value as unknown[];

    const allPrimitive = arr.every(
      (x) =>
        x === null ||
        x === undefined ||
        typeof x === 'string' ||
        typeof x === 'number' ||
        typeof x === 'boolean'
    );

    if (allPrimitive) {
      if (!prefix) return;
      pushFlatProp(target, prefix, arr);
      return;
    }

    arr.forEach((item, idx) => {
      const childPrefix = `${prefix}${prefix ? '' : ''}[${idx}]`;
      flattenJsonToProps(target, item, childPrefix);
    });
    return;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      const childPrefix = prefix ? `${prefix}.${k}` : k;
      flattenJsonToProps(target, v, childPrefix);
    }
  }
};

export function extractVisualElementsFromText(text: string): string[] {
  if (!text) return [];

  const lines = cleanAndSplit(text)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];

  for (const line of lines) {
    // 00:00 - 00:02: Close-up...
    const timeLike = /^\d{1,2}:\d{2}/.test(line);
    if (timeLike) {
      const idx = line.indexOf(':');
      if (idx >= 0 && idx < line.length - 1) {
        out.push(line.slice(idx + 1).trim());
      } else {
        out.push(line);
      }
    } else {
      out.push(line);
    }
  }

  return out;
}

function cleanExtraSymbols(text?: string) {
  return String(text || '')
    .replace(/\*/g, '')
    .trim();
}

/**
 * Try to parse adaptation scenarios from ad fields.
 * Common sources: `new_scenario` (string/JSON), or `realisation`/`concept` blocks.
 */
export function parseScenarios(ad: Record<string, unknown>): unknown[] {
  // Prefer explicit `new_scenario` field
  const raw = ad?.new_scenario ?? ad?.new_scenarios ?? null;
  if (!raw) return [];

  const parsed = tryParseJson(typeof raw === 'string' ? raw : JSON.stringify(raw));
  if (Array.isArray(parsed)) return parsed as unknown[];
  if (parsed) return [parsed];

  // If it's not JSON, try to split into paragraphs that look like scenarios
  if (typeof raw === 'string') {
    return cleanAndSplit(raw)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

export function sanitizeScenarios(scenarios: unknown): unknown[] {
  if (!scenarios) return [];
  if (!Array.isArray(scenarios)) return [scenarios];

  return scenarios.map((s) => {
    if (!s || typeof s !== 'object') return s;
    // Ensure technical_task_json is parsed if present as string
    const copy = { ...(s as Record<string, unknown>) } as Record<string, unknown>;
    const ttj = (copy as Record<string, unknown>)['technical_task_json'];
    if (typeof ttj === 'string') {
      const p = tryParseJson(ttj as string);
      if (p !== null) copy.technical_task_json = p as unknown;
    }
    return copy;
  });
}

/**
 * Split visual description into "main" and "extra" paragraphs.
 * For images: separate by headings. For video: main is derived from `video_script`.
 */
export function getVisualParagraphs(ad: Record<string, unknown>) {
  let visualMain: string[] = [];
  let visualExtra: string[] = [];

  if (ad?.image_description) {
    const p = cleanAndSplit(ad.image_description).filter((x) => {
      const l = x.trim().toLowerCase();
      return !(
        l === 'visual description' ||
        l === 'visual description:' ||
        l === 'visual description：'
      );
    });

    visualExtra = [];
    p.forEach((x) => {
      const first = (x.split(/\n+/)[0] || '').trim();
      if (first && /^(visual description|visual elements|scene|scenes)/i.test(first)) {
        visualExtra.push(x.trim());
      } else {
        visualMain.push(x.trim());
      }
    });
  }

  // If no image description, try deriving from video_script
  if ((!visualMain || !visualMain.length) && ad?.video_script) {
    const fromVideo = extractVisualElementsFromText(String(ad.video_script || ''));
    visualMain = fromVideo;
  }

  return {
    visualMainParagraphs: visualMain,
    visualExtraParagraphs: visualExtra,
    visualDerivedFromVideo: !ad?.image_description && !!ad?.video_script,
  };
}

/**
 * Build a meta object with normalized text for Structured Attributes and prompts.
 */
export function buildMetaAnalysis(
  ad: Record<string, unknown>,
  visualMainParagraphs: string[] = []
) {
  const ex = ad || {};
  const fcc = {
    Concept: ex.concept || '',
    Format:
      String(ex.display_format || '').toLowerCase() ||
      (ex.display_format === 'VIDEO' ? 'video' : 'image'),
    Realisation: ex.realisation || '',
    Topic: ex.topic || '',
    Hook: cleanExtraSymbols(ex.hook || ''),
    Character: ex.character || '',
  };

  const get = (k: string) => String((fcc as Record<string, unknown>)[k] || '');

  return {
    'Sound Transcription': cleanExtraSymbols(ex.subtitles || ex.audio_script || ''),
    'Audio Description': cleanExtraSymbols(ex.audio_description || ''),
    'Visual Description': Array.isArray(visualMainParagraphs)
      ? visualMainParagraphs.join('\n')
      : String(visualMainParagraphs || ''),
    Hook: get('Hook'),
    Topic: get('Topic'),
    Character: get('Character'),
    'Formats & Creative Concepts': `${get('Concept')} / ${get('Format')} / ${get(
      'Realisation'
    )}`.trim(),
  } as Record<string, string>;
}

/**
 * Build grouped sections (title + text) for UI / prompt.
 */
export function buildGroupedSections(
  ad: Record<string, unknown>,
  metaInput: Record<string, unknown>
) {
  const out: { title: string; text: string }[] = [];
  const meta = { ...(metaInput || {}) };

  const push = (t: string, v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s && s.trim() && !out.find((item) => item.title === t)) {
      out.push({ title: t, text: s.trim() });
    }
  };

  // Basic ad meta
  push('Title', ad?.title);
  push('Ad Text', ad?.text || ad?.caption || ad?.description);
  push('Call to Action', ad?.cta_text || ad?.cta);
  push('Image / Visual Description', meta['Visual Description'] || ad?.image_description || '');

  // Additional meta fields
  for (const key of Object.keys(meta)) {
    if (['Visual Description'].includes(key)) continue;
    push(key, meta[key]);
  }

  // Visual Elements / Scenes
  if (meta['Visual Elements']) {
    push('Visual Elements', String(meta['Visual Elements']));
  }

  return out;
}
