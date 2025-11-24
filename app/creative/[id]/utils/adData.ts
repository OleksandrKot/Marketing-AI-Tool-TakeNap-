import cleanAndSplit from './cleanAndSplit';
import type { Ad, AdaptationScenario } from '@/lib/core/types';

const VISUAL_EXTRA_TITLES = [
  'colors and style',
  'visible emotions',
  'overall mood or feeling',
  'overall mood',
  'visible emotions:',
  'colors and style:',
  'overall mood or feeling:',
];

// Cache for the last built visual prompt JSON
// (used as a fallback when building the bundle)
let lastVisualPromptJson: Record<string, unknown> | null = null;

/**
 * Remove any leading garbage before useful content,
 * e.g. text before ```json or before first '{'.
 */
function stripLeading(text?: string) {
  if (!text) return '';
  const s = String(text);
  const f = s.indexOf('```');
  const b = s.indexOf('{');
  let idx = -1;
  if (f >= 0) idx = f;
  if (b >= 0 && (idx === -1 || b < idx)) idx = b;
  if (idx >= 0) return s.slice(idx).trim();
  const nl = s.indexOf('\n');
  if (nl > 0 && nl < 200) {
    const first = s.slice(0, nl).trim();
    if (first.length < 200) return s.slice(nl + 1).trim();
  }
  return s;
}

/**
 * Try to extract a JSON object from arbitrary text.
 * Returns:
 *  - parsed: extracted object (or null)
 *  - cleaned: remaining text with trailing "Key: Value;" pairs removed
 */
function tryParseJsonFromText(text?: string) {
  if (!text) return { parsed: null as Record<string, unknown> | null, cleaned: '' };
  let t = String(text);

  // 1) fenced ```json ``` block
  const fenced = t.match(/```(?:json\s*)?([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const j = fenced[1].trim();
    try {
      const o = JSON.parse(j) as Record<string, unknown>;
      t = t.replace(fenced[0], '').trim();
      t = stripTrailingKVs(t);
      return { parsed: o, cleaned: t };
    } catch {
      /* ignore */
    }
  }

  // 2) first {...}-looking JSON in the text
  const first = t.indexOf('{');
  if (first >= 0) {
    let depth = 0;
    let end = -1;
    for (let i = first; i < t.length; i++) {
      if (t[i] === '{') depth++;
      if (t[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > first) {
      const j = t.slice(first, end + 1);
      try {
        const o = JSON.parse(j) as Record<string, unknown>;
        t = (t.slice(0, first) + t.slice(end + 1)).trim();
        t = stripTrailingKVs(t);
        return { parsed: o, cleaned: t };
      } catch {
        /* ignore */
      }
    }
  }

  // 3) Try to read trailing key:value; pairs
  const kv = parseTrailingKVs(t);
  if (Object.keys(kv.obj).length) return { parsed: kv.obj, cleaned: kv.cleaned };
  return { parsed: null, cleaned: t };
}

/**
 * Strip trailing "Key: Value;" lines from text.
 */
function stripTrailingKVs(text: string) {
  if (!text) return '';
  const m = text.match(/(?:\s*\n)?([A-Za-z0-9\s&\-]+:\s*[^;]+;(\s*|$))+$/m);
  if (m && m[0]) return text.slice(0, text.length - m[0].length).trim();
  return text;
}

/**
 * Parse trailing "Key: Value;" pairs into an object.
 */
function parseTrailingKVs(text: string) {
  const obj: Record<string, unknown> = {};
  if (!text) return { obj, cleaned: text };
  const tail = text.slice(-800);
  const re = /([A-Za-z0-9\s&\-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  let any = false;
  while ((match = re.exec(tail))) {
    const k = match[1].trim();
    const v = match[2].trim();
    if (k) {
      obj[k] = v;
      any = true;
    }
  }
  if (!any) return { obj, cleaned: text };
  const firstIdx = text.lastIndexOf(Object.keys(obj)[0] + ':');
  if (firstIdx >= 0) return { obj, cleaned: text.slice(0, firstIdx).trim() };
  return { obj, cleaned: text };
}

/**
 * Parse new_scenario JSON from ad.
 */
export const parseScenarios = (ad: Ad): AdaptationScenario[] => {
  if (!ad?.new_scenario) return [];
  try {
    return JSON.parse(
      String(ad.new_scenario)
        .replace(/```json|```/g, '')
        .trim()
    ) as AdaptationScenario[];
  } catch {
    return [];
  }
};

/**
 * Clean up visual_elements inside adaptation scenarios:
 * - remove useless headers like "Visual description:"
 */
export const sanitizeScenarios = (scenarios: AdaptationScenario[]): AdaptationScenario[] => {
  return scenarios.map((s) => {
    try {
      const vis = Array.isArray(s.technical_task_json?.visual_elements)
        ? s.technical_task_json.visual_elements.filter((el: string) => {
            const v = String(el || '')
              .trim()
              .toLowerCase();
            return !(
              v === 'visual elements' ||
              v === 'visual elements:' ||
              v === 'visual description' ||
              v === 'visual description:'
            );
          })
        : [];
      return {
        ...s,
        technical_task_json: { ...(s.technical_task_json || {}), visual_elements: vis },
      } as AdaptationScenario;
    } catch {
      return s;
    }
  });
};

/**
 * Build a short text summary from structured "image headings",
 * or fall back to the raw visual text.
 */
function mkShort(found: Record<string, string>, fallback: string) {
  const f = (k: string) =>
    String(found[k] || '')
      .replace(/\n+/g, ' ')
      .replace(/(^\s*[:\-–—\s]+|\s+$)/g, '')
      .trim();
  const parts = [
    f('Main Objects and Characters'),
    f('Setting and Background'),
    f('Colors and Style'),
    f('Visible Emotions'),
    f('Overall Mood or Feeling'),
  ];
  const joined = parts.filter(Boolean).join('. ');
  const sentences = joined.split('. ').filter(Boolean);
  if (sentences.length) return sentences.slice(0, 4).join('. ') + '.';
  const alt = cleanAndSplit(fallback).slice(0, 2).join('\n\n');
  return alt || '';
}

/**
 * Remove stars and trim text.
 */
export function cleanExtraSymbols(text: string) {
  return String(text || '')
    .replace(/\*/g, '')
    .trim();
}

/**
 * Get visual paragraphs from:
 *  - image_description (if it's real text)
 *  - otherwise video_script
 *
 * IMPORTANT: if image_description is pure JSON
 * (e.g. only "Formats & Creative Concepts" without "Visual Description"),
 * we do NOT treat it as text description.
 */
export const getVisualParagraphs = (ad: Ad) => {
  let visualMain: string[] = [];
  let visualExtra: string[] = [];

  if (ad.image_description) {
    const raw = String(ad.image_description);
    const { parsed } = tryParseJsonFromText(raw);

    const isPureJsonWithoutVisualDescription =
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      !Object.prototype.hasOwnProperty.call(parsed, 'Visual Description');

    if (isPureJsonWithoutVisualDescription) {
      // Example: your case where image_description only contains
      // "Formats & Creative Concepts" JSON. We ignore it as visual text.
      visualMain = [];
      visualExtra = [];
    } else {
      const p = cleanAndSplit(raw).filter((x) => {
        const l = x.trim().toLowerCase();
        return !(
          l === 'visual description' ||
          l === 'visual description:' ||
          l === 'visual description：'
        );
      });

      p.forEach((x) => {
        const first = (x.split(/\n+/)[0] || '').trim();
        const key = first.replace(/[:。\s]+$/, '').toLowerCase();
        if (VISUAL_EXTRA_TITLES.includes(key)) visualExtra.push(x);
        else visualMain.push(x);
      });
    }
  } else if (ad.video_script) {
    const vs = stripLeading(String(ad.video_script || ''));
    visualMain = cleanAndSplit(vs).filter((x) => {
      const l = x.trim().toLowerCase();
      return !(
        l === 'visual description' ||
        l === 'visual description:' ||
        l === 'visual description：'
      );
    });
    visualExtra = [];
  }

  return {
    visualMainParagraphs: visualMain,
    visualExtraParagraphs: visualExtra,
    visualDerivedFromVideo: !ad.image_description && !!ad.video_script,
  };
};

/**
 * Build meta-analysis fields that will be reused later.
 */
export const buildMetaAnalysis = (ad: Ad, visualMainParagraphs: string[]) => {
  const ex = ad as unknown as Record<string, unknown>;
  const fcc = {
    Concept: ad.concept || '',
    Format:
      String(ad.display_format || '').toLowerCase() ||
      (ad.display_format === 'VIDEO' ? 'video' : 'image'),
    Realisation: (ad.realisation as string) || '',
    Topic: (ad.topic as string) || '',
    Hook: cleanExtraSymbols(ad.hook || ''),
    Character: (ad.character as string) || '',
  };
  return {
    'Sound Transcription': cleanExtraSymbols(
      (ex.subtitles as string) || (ex.sound_transcription as string) || ''
    ),
    'Audio Description': cleanExtraSymbols(
      cleanAndSplit((ex.audio_description as string) || '').join(' ')
    ),
    Hook: cleanExtraSymbols(ad.hook || ''),
    CTA: cleanExtraSymbols(ad.cta_text || 'None'),
    'Social Proof': cleanExtraSymbols(
      (ex.social_proof as string) || cleanAndSplit(ad.text).join(' ') || ad.title || 'unknown'
    ),
    'Formats & Creative Concepts': fcc,
    'Visual Description': cleanExtraSymbols(visualMainParagraphs.join(' ')),
    'Target Audience': cleanExtraSymbols((ex.target_audience as string) || ''),
  } as Record<string, unknown>;
};

/**
 * Build a compact JSON fragment for AI image prompt.
 * This is used both for the "short prompt" JSON and
 * for the 'Image / Visual Description' section.
 */
function buildVisualPromptJson(
  found: Record<string, string>,
  fallback: string,
  ad: Ad,
  meta: Record<string, unknown>
) {
  const extractedSubject =
    found['Main Objects and Characters'] ||
    mkShort(found, fallback) ||
    cleanExtraSymbols(fallback) ||
    'Main character or object prominently displayed';

  const extractedScene =
    found['Setting and Background'] || 'Warm indoor environment with soft ambient lighting';

  const extractedStyle =
    found['Colors and Style'] ||
    found['Overall Mood or Feeling'] ||
    'Clean, modern, warm and inviting color palette';

  const extractedEmotions =
    found['Visible Emotions'] || 'Positive emotions such as warmth, happiness, comfort';

  // Compose on-image text from title + hook + CTA
  const textParts: string[] = [];
  if (ad.title) textParts.push(cleanExtraSymbols(ad.title));
  if (ad.hook) textParts.push(cleanExtraSymbols(ad.hook));
  if (ad.cta_text) textParts.push(cleanExtraSymbols(ad.cta_text));
  if (!textParts.length && meta['Hook']) textParts.push(String(meta['Hook']));

  const text_on_image = textParts.join(' | ') || 'Learn more';

  return {
    subject: extractedSubject,
    scene: extractedScene,
    style: extractedStyle,
    emotions: extractedEmotions,
    text_on_image,
  };
}

/**
 * Build grouped text sections:
 * - Title
 * - Ad Text
 * - Hook / CTA
 * - Image / Visual Description (as JSON)
 * - Video / Audio / Social proof
 * - Formats & Creative Concepts (flattened)
 */
export const buildGroupedSections = (
  ad: Ad,
  meta: Record<string, unknown>,
  adaptationScenarios: AdaptationScenario[]
) => {
  const out: { title: string; text: string }[] = [];

  // Helper to push a unique non-empty section
  const push = (t: string, v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s && s.trim() && !out.find((item) => item.title === t)) {
      out.push({ title: t, text: s.trim() });
    }
  };

  // Basic sections
  push('Title', ad.title);

  const baseAdText =
    cleanAndSplit(ad.text).join('\n\n') ||
    cleanAndSplit(ad.caption).join('\n\n') ||
    cleanAndSplit(ad.duplicates_ad_text).join('\n\n');
  push('Ad Text', cleanExtraSymbols(baseAdText));

  push('Hook', cleanExtraSymbols(String(ad.hook || meta['Hook'] || '')));
  push('Call to Action', cleanExtraSymbols(ad.cta_text || String(meta['CTA'] || '')));

  const imageHeadings = [
    'Main Objects and Characters',
    'Setting and Background',
    'Colors and Style',
    'Visible Emotions',
    'Overall Mood or Feeling',
  ];

  // Raw "image description" source: either from ad or from meta
  const imageRawOrig = String(ad.image_description || meta['Visual Description'] || '').trim();
  let imageRaw = imageRawOrig;

  let fccInline: Record<string, unknown> | undefined = meta['Formats & Creative Concepts'] as
    | Record<string, unknown>
    | undefined;

  // Try to extract JSON from imageRaw (can carry Visual Description + extra meta)
  const extractedImage = tryParseJsonFromText(imageRaw);
  if (extractedImage.parsed) {
    const p = extractedImage.parsed;
    imageRaw = p['Visual Description']
      ? cleanExtraSymbols(String(p['Visual Description']))
      : extractedImage.cleaned || '';

    if (p['Subtitles']) meta['Sound Transcription'] = cleanExtraSymbols(String(p['Subtitles']));
    if (p['Audio Description'])
      meta['Audio Description'] = cleanExtraSymbols(String(p['Audio Description']));
    if (p['User Pain Points'])
      meta['Social Proof'] = cleanExtraSymbols(String(p['User Pain Points']));
    if (p['Formats & Creative Concepts'])
      fccInline = {
        ...(fccInline || {}),
        ...(p['Formats & Creative Concepts'] as Record<string, unknown>),
      };
  }

  // JSON for the image prompt (short visual description)
  let visualPromptJson: Record<string, unknown> | null = null;

  // 1) Try to build from explicit image description
  if (imageRaw) {
    let rem = imageRaw;
    const found: Record<string, string> = {};
    const headingsPattern = imageHeadings
      .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    for (const heading of imageHeadings) {
      const re = new RegExp(
        `${heading}[:：]?\\s*([\\s\\S]*?)(?=(?:${headingsPattern})[:：]?\\s|$)`,
        'i'
      );
      const m = rem.match(re);
      if (m && m[1]) {
        found[heading] = cleanExtraSymbols(m[1].trim());
        rem = rem.replace(m[0], '').trim();
      }
    }

    const promptJson = buildVisualPromptJson(found, imageRaw, ad, meta);
    visualPromptJson = promptJson;

    // If there is no real ad text, we can reuse subject as ad text fallback
    if ((!baseAdText || baseAdText.length < 10) && promptJson.subject) {
      const adTextSection = out.find((s) => s.title === 'Ad Text');
      if (adTextSection) adTextSection.text = String(promptJson.subject);
    }

    // Store as main "Image / Visual Description" section (JSON)
    push('Image / Visual Description', JSON.stringify(promptJson, null, 2));
  }

  // 2) Extract visual info from video / scenarios (e.g. new_scenario.visual_elements)
  let videoRaw = String(ad.video_script || '').trim();
  let audioStyle = '';

  if (videoRaw) videoRaw = stripLeading(videoRaw);

  // If there is no explicit video_script, try adaptationScenarios / new_scenario
  if (!videoRaw) {
    let sc: AdaptationScenario[] = [];
    if (Array.isArray(adaptationScenarios) && adaptationScenarios.length)
      sc = sanitizeScenarios(adaptationScenarios);
    else {
      try {
        const parsed = parseScenarios(ad);
        if (Array.isArray(parsed) && parsed.length) sc = sanitizeScenarios(parsed);
      } catch {
        /* ignore */
      }
    }

    for (const s of sc) {
      const vis = s?.technical_task_json?.visual_elements;
      if (Array.isArray(vis) && vis.length) videoRaw = vis.join('\n\n');

      if (!audioStyle && s?.technical_task_json) {
        const candidate = (s.technical_task_json as Record<string, unknown>)['audio_style'];
        if (typeof candidate === 'string' && candidate.trim()) {
          audioStyle = cleanExtraSymbols(candidate);
        }
      }

      if (videoRaw) break;
    }
  }

  if (videoRaw) {
    const extracted = tryParseJsonFromText(videoRaw);
    if (extracted.parsed) {
      const p = extracted.parsed;
      videoRaw = p['Visual Description']
        ? cleanExtraSymbols(String(p['Visual Description']))
        : extracted.cleaned || videoRaw;

      if (p['Subtitles']) meta['Sound Transcription'] = cleanExtraSymbols(String(p['Subtitles']));
      if (p['Audio Description'])
        meta['Audio Description'] = cleanExtraSymbols(String(p['Audio Description']));
      if (p['User Pain Points'])
        meta['Social Proof'] = cleanExtraSymbols(String(p['User Pain Points']));
      if (p['Formats & Creative Concepts'])
        fccInline = {
          ...(fccInline || {}),
          ...(p['Formats & Creative Concepts'] as Record<string, unknown>),
        };
    }

    // Try to parse headings in the video description as well
    const foundVideo: Record<string, string> = {};
    const headingsPatternV = imageHeadings
      .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    let remV = videoRaw;
    for (const heading of imageHeadings) {
      const re = new RegExp(
        `${heading}[:：]?\\s*([\\s\\S]*?)(?=(?:${headingsPatternV})[:：]?\\s|$)`,
        'i'
      );
      const m = remV.match(re);
      if (m && m[1]) {
        foundVideo[heading] = cleanExtraSymbols(m[1].trim());
        remV = remV.replace(m[0], '').trim();
      }
    }

    // If there is no image-based description, build it from video/scenario
    if (!out.find((s) => s.title === 'Image / Visual Description')) {
      const promptJsonV = buildVisualPromptJson(foundVideo, videoRaw, ad, meta);
      visualPromptJson = visualPromptJson || promptJsonV;
      push('Image / Visual Description', JSON.stringify(promptJsonV, null, 2));
    }
  }

  // Additional audio data
  if (audioStyle) push('Audio Style', audioStyle);

  // Sound & audio meta
  push('Sound Transcription', meta['Sound Transcription']);
  push('Audio Description', meta['Audio Description']);

  // Social proof, target audience
  push('Social Proof', meta['Social Proof']);
  push('Target Audience', meta['Target Audience']);

  // Flatten formats & creative concepts if we have any
  const finalFcc =
    fccInline || (meta['Formats & Creative Concepts'] as Record<string, unknown> | undefined);
  if (finalFcc) {
    const fcText = Object.entries(finalFcc)
      .map(([k, v]) => `${k}: ${cleanExtraSymbols(String(v === '' ? 'Nothing to find...' : v))}`)
      .join('\n');
    push('Formats & Creative Concepts', fcText);
  }

  // Store the last visual prompt JSON globally, so we can reuse it in buildPromptBundle
  lastVisualPromptJson = visualPromptJson;

  return out;
};

/**
 * Core prompt JSON: high-level, human-readable structure built from sections.
 */
export const buildCorePromptJson = (
  ad: Ad,
  meta: Record<string, unknown>,
  adaptationScenarios: AdaptationScenario[]
) => {
  const sections = buildGroupedSections(ad, meta, adaptationScenarios);
  const get = (title: string) => sections.find((s) => s.title === title)?.text?.trim() || '';

  return {
    title: get('Title'),
    adText: get('Ad Text'),
    visualDescription: get('Image / Visual Description'),
    hook: get('Hook'),
    cta: get('Call to Action'),
    soundTranscription: get('Sound Transcription'),
    audioDescription: get('Audio Description'),
    socialProof: get('Social Proof'),
    targetAudience: get('Target Audience'),
    formatsAndCreativeConcepts: get('Formats & Creative Concepts'),
  };
};

/**
 * High-level helper that prepares everything needed by the edit page:
 *  - meta           – structured meta analysis
 *  - groupedSections – list of sections to show
 *  - corePromptJson – human-readable JSON
 *  - shortPromptJson – compact JSON for image prompt
 *
 * This is what you should encode into ?data=... when you navigate to the edit page.
 */
export const buildPromptBundle = (ad: Ad, adaptationScenarios: AdaptationScenario[] = []) => {
  const visual = getVisualParagraphs(ad);
  const meta = buildMetaAnalysis(ad, visual.visualMainParagraphs);
  const groupedSections = buildGroupedSections(ad, meta, adaptationScenarios);
  const corePromptJson = buildCorePromptJson(ad, meta, adaptationScenarios);

  let shortPromptJson: Record<string, unknown> | null = null;

  // 1) Try to parse JSON from "Image / Visual Description" section
  const visualSection = groupedSections.find(
    (s) => s.title === 'Image / Visual Description' || s.title === 'Visual Description'
  );
  if (visualSection?.text) {
    const { parsed } = tryParseJsonFromText(visualSection.text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      shortPromptJson = parsed;
    }
  }

  // 2) Fallback to the cached lastVisualPromptJson, if any
  if (!shortPromptJson && lastVisualPromptJson) {
    shortPromptJson = lastVisualPromptJson;
  }

  return {
    meta,
    groupedSections,
    corePromptJson,
    shortPromptJson,
  };
};

export default {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
  buildCorePromptJson,
  buildPromptBundle,
};
