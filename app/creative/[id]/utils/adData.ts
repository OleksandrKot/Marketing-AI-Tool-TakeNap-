import cleanAndSplit from './cleanAndSplit';
import type { Ad, AdaptationScenario } from '@/lib/types';

// Headings used to detect extra visual paragraphs
const VISUAL_EXTRA_TITLES = [
  'colors and style',
  'visible emotions',
  'overall mood or feeling',
  'overall mood',
  'visible emotions:',
  'colors and style:',
  'overall mood or feeling:',
];

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
 * Try to parse JSON object from a mixed text string.
 * Returns:
 *  - parsed: JSON object if found, otherwise null
 *  - cleaned: text with JSON and trailing key:value; removed
 */
function tryParseJsonFromText(text?: string) {
  if (!text) return { parsed: null as Record<string, unknown> | null, cleaned: '' };
  let t = String(text);

  // Case 1: fenced ```json ... ``` block
  const fenced = t.match(/```(?:json\s*)?([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const j = fenced[1].trim();
    try {
      const o = JSON.parse(j) as Record<string, unknown>;
      t = t.replace(fenced[0], '').trim();
      t = stripTrailingKVs(t);
      return { parsed: o, cleaned: t };
    } catch {
      // ignore and continue
    }
  }

  // Case 2: first JSON object in plain text
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
        // ignore and continue
      }
    }
  }

  // Case 3: trailing "Key: Value;" pairs
  const kv = parseTrailingKVs(t);
  if (Object.keys(kv.obj).length) return { parsed: kv.obj, cleaned: kv.cleaned };
  return { parsed: null, cleaned: t };
}

/**
 * Remove trailing "Key: Value;" blocks from text.
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
 * Parse adaptation_scenarios JSON stored as string in Ad.new_scenario.
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
 * Cleanup adaptation scenarios:
 * - remove useless "visual elements" headings from lists.
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
 * Build a short visual summary from structured headings or fallback text.
 */
function mkShort(found: Record<string, string>, fallback: string) {
  const f = (k: string) =>
    String(found[k] || '')
      .replace(/\n+/g, ' ')
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
 * Remove extra markdown symbols like '*' and trim.
 */
export function cleanExtraSymbols(text: string) {
  return String(text || '')
    .replace(/\*/g, '')
    .trim();
}

/**
 * Split visual description into "main" and "extra" paragraphs.
 * For images: separate by headings.
 * For video: main is based on video_script.
 */
export const getVisualParagraphs = (ad: Ad) => {
  let visualMain: string[] = [];
  let visualExtra: string[] = [];

  if (ad.image_description) {
    const p = cleanAndSplit(ad.image_description).filter((x) => {
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
 * Build a meta object with normalized text:
 * - Hook, CTA
 * - Social proof
 * - Visual description
 * - Target audience
 * - Formats & Creative Concepts
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
 * Helper: build JSON payload for AI image/video prompt.
 * Short, dense, no fluff, only essential fields.
 */
function buildVisualPromptJson(
  found: Record<string, string>,
  fallback: string,
  ad: Ad,
  meta: Record<string, unknown>
) {
  // Extracted fields or fallback values
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

  // Construct text from ad titles, hooks, CTA, fallback
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
 * Build grouped sections (title + text) for UI / prompt.
 *
 * IMPORTANT:
 *   "Image / Visual Description" now ALWAYS contains JSON TEXT
 *   (stringified object) with the core prompt data for AI.
 */
export const buildGroupedSections = (
  ad: Ad,
  meta: Record<string, unknown>,
  adaptationScenarios: AdaptationScenario[]
) => {
  const out: { title: string; text: string }[] = [];
  const push = (t: string, v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s && s.trim() && !out.find((item) => item.title === t)) {
      out.push({ title: t, text: s.trim() });
    }
  };

  // 1. Basic ad meta
  push('Title', ad.title);

  // 2. Base ad text (fallback)
  const baseAdText =
    cleanAndSplit(ad.text).join('\n\n') ||
    cleanAndSplit(ad.caption).join('\n\n') ||
    cleanAndSplit(ad.duplicates_ad_text).join('\n\n');
  push('Ad Text', cleanExtraSymbols(baseAdText));

  // 3. Hook & CTA as separate core fields
  push('Hook', cleanExtraSymbols(String(ad.hook || meta['Hook'] || '')));
  push('Call to Action', cleanExtraSymbols(ad.cta_text || String(meta['CTA'] || '')));

  // 4. Visual description for image
  const imageHeadings = [
    'Main Objects and Characters',
    'Setting and Background',
    'Colors and Style',
    'Visible Emotions',
    'Overall Mood or Feeling',
  ];

  const imageRawOrig = String(ad.image_description || meta['Visual Description'] || '').trim();
  let imageRaw = imageRawOrig;

  let fccInline: Record<string, unknown> | undefined = meta['Formats & Creative Concepts'] as
    | Record<string, unknown>
    | undefined;

  // Try to extract JSON from image description (to enrich meta)
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

  // Build JSON prompt text for image visual
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
    const visualText = JSON.stringify(promptJson, null, 2);

    // If base ad text is very weak, we can reuse subject as summary
    if ((!baseAdText || baseAdText.length < 10) && promptJson.subject) {
      const adTextSection = out.find((s) => s.title === 'Ad Text');
      if (adTextSection) adTextSection.text = promptJson.subject;
    }

    // MAIN: Image / Visual Description now holds JSON string
    push('Image / Visual Description', visualText);
  } else if (meta['Visual Description']) {
    const fallback = String(meta['Visual Description'] || '');
    const promptJson = buildVisualPromptJson({}, fallback, ad, meta);
    const visualText = JSON.stringify(promptJson, null, 2);
    push('Image / Visual Description', visualText);
  }

  // 5. Video-based visual description (if any)
  let videoRaw = String(ad.video_script || '').trim();
  let audioStyle = '';

  if (videoRaw) videoRaw = stripLeading(videoRaw);

  // If no direct video_script, try to get visual elements from adaptation scenarios
  if (!videoRaw) {
    let sc: AdaptationScenario[] = [];
    if (Array.isArray(adaptationScenarios) && adaptationScenarios.length)
      sc = sanitizeScenarios(adaptationScenarios);
    else {
      try {
        const parsed = parseScenarios(ad);
        if (Array.isArray(parsed) && parsed.length) sc = sanitizeScenarios(parsed);
      } catch {
        // ignore
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

  // Extract JSON from video-based description if present
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

    // Build compact JSON for video visual
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

    const promptJsonV = buildVisualPromptJson(foundVideo, videoRaw, ad, meta);
    const visualTextV = JSON.stringify(promptJsonV, null, 2);

    // If we don't have image description, use video visual JSON as main one
    if (!out.find((s) => s.title === 'Image / Visual Description')) {
      push('Image / Visual Description', visualTextV);
    }
  }

  if (audioStyle) push('Audio Style', audioStyle);

  // 6. Audio-related core info
  push('Sound Transcription', meta['Sound Transcription']);
  push('Audio Description', meta['Audio Description']);

  // 7. Social proof & target audience
  push('Social Proof', meta['Social Proof']);
  push('Target Audience', meta['Target Audience']);

  // 8. Formats & Creative Concepts – flatten into readable text
  const finalFcc =
    fccInline || (meta['Formats & Creative Concepts'] as Record<string, unknown> | undefined);
  if (finalFcc) {
    const fcText = Object.entries(finalFcc)
      .map(([k, v]) => `${k}: ${cleanExtraSymbols(String(v === '' ? 'Nothing to find...' : v))}`)
      .join('\n');
    push('Formats & Creative Concepts', fcText);
  }

  return out;
};

/**
 * Build a compact JSON object with ONLY core information.
 * This is convenient to send as a prompt payload to an LLM.
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
    visualDescriptionJson: get('Image / Visual Description'), // JSON text
    hook: get('Hook'),
    cta: get('Call to Action'),
    soundTranscription: get('Sound Transcription'),
    audioDescription: get('Audio Description'),
    socialProof: get('Social Proof'),
    targetAudience: get('Target Audience'),
    formatsAndCreativeConcepts: get('Formats & Creative Concepts'),
  };
};

export default {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
  buildCorePromptJson,
};
