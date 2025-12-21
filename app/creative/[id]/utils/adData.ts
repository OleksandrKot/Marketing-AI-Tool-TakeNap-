// adData.ts
import cleanAndSplit from './cleanAndSplit';
import type { Ad, AdaptationScenario } from '@/lib/core/types';

/**
 * Notes:
 * - This module owns ALL logic related to parsing/normalizing Ad data.
 * - UI layer (content-tab) should only render `ad.derived`, `ad.groupedSections`, etc.
 */

/** Titles that should be treated as "extra" visual paragraphs */
const VISUAL_EXTRA_TITLES = [
  'colors and style',
  'visible emotions',
  'overall mood or feeling',
  'overall mood',
  'visible emotions:',
  'colors and style:',
  'overall mood or feeling:',
];

/** Cached fallback: last visual prompt JSON extracted/built */
let lastVisualPromptJson: Record<string, unknown> | null = null;

/** ---------------------------
 *  Generic helpers
 * --------------------------*/

/** Remove leading garbage before JSON fences or the first `{` */
function stripLeading(text?: string) {
  if (!text) return '';
  const s = String(text);

  const fenceIdx = s.indexOf('```');
  const braceIdx = s.indexOf('{');

  let idx = -1;
  if (fenceIdx >= 0) idx = fenceIdx;
  if (braceIdx >= 0 && (idx === -1 || braceIdx < idx)) idx = braceIdx;

  if (idx >= 0) return s.slice(idx).trim();

  const nl = s.indexOf('\n');
  if (nl > 0 && nl < 200) {
    const first = s.slice(0, nl).trim();
    if (first.length < 200) return s.slice(nl + 1).trim();
  }
  return s;
}

/** Remove stars and trim text */
export function cleanExtraSymbols(text: string) {
  return String(text || '')
    .replace(/\*/g, '')
    .trim();
}

/** Safe JSON.parse */
function safeJsonParse<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;

  const t = value.trim();
  if (!t) return null;

  // quick heuristic
  const looksLikeJson =
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']')) ||
    /^```(?:json)?/i.test(t);

  if (!looksLikeJson) return null;

  try {
    const cleaned = t.replace(/```json|```/gi, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Recursively parses JSON-ish strings inside an object/array.
 * This is critical for cases where DB stores nested JSON as strings.
 */
function deepParseJsonStrings(value: unknown, depth = 0): unknown {
  if (depth > 6) return value; // prevent pathological recursion

  if (typeof value === 'string') {
    const parsed = safeJsonParse(value);
    if (parsed !== null) return deepParseJsonStrings(parsed, depth + 1);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => deepParseJsonStrings(v, depth + 1));
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deepParseJsonStrings(v, depth + 1);
    }
    return out;
  }

  return value;
}

/**
 * Tries to extract JSON object from arbitrary text:
 * - fenced ```json ... ```
 * - first {...} block
 * - trailing key:value; pairs
 */
function stripTrailingKVs(text: string) {
  if (!text) return '';
  const m = text.match(/(?:\s*\n)?([A-Za-z0-9\s&\-]+:\s*[^;]+;(\s*|$))+$/m);
  if (m && m[0]) return text.slice(0, text.length - m[0].length).trim();
  return text;
}

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

  const firstKey = Object.keys(obj)[0];
  const firstIdx = text.lastIndexOf(firstKey + ':');
  if (firstIdx >= 0) return { obj, cleaned: text.slice(0, firstIdx).trim() };

  return { obj, cleaned: text };
}

function tryParseJsonFromText(text?: string) {
  if (!text) return { parsed: null as Record<string, unknown> | null, cleaned: '' };
  let t = String(text);

  // 1) fenced block
  const fenced = t.match(/```(?:json\s*)?([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const j = fenced[1].trim();
    try {
      const o = JSON.parse(j) as Record<string, unknown>;
      t = t.replace(fenced[0], '').trim();
      t = stripTrailingKVs(t);
      return { parsed: o, cleaned: t };
    } catch {
      // ignore
    }
  }

  // 2) first {...}
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
        // ignore
      }
    }
  }

  // 3) trailing kv
  const kv = parseTrailingKVs(t);
  if (Object.keys(kv.obj).length) return { parsed: kv.obj, cleaned: kv.cleaned };

  return { parsed: null, cleaned: t };
}

/** ---------------------------
 *  Scenarios normalization
 * --------------------------*/

/** Parse new_scenario JSON from ad (string/object/array) */
export const parseScenarios = (ad: Ad): AdaptationScenario[] => {
  const raw = (ad as unknown as { new_scenario?: unknown })?.new_scenario;
  if (!raw) return [];

  // already an array
  if (Array.isArray(raw)) return raw as AdaptationScenario[];

  // object -> array
  if (typeof raw === 'object') return [raw as AdaptationScenario];

  // string JSON
  if (typeof raw === 'string') {
    const parsed = safeJsonParse<unknown>(raw);
    if (Array.isArray(parsed)) return parsed as AdaptationScenario[];
    if (parsed && typeof parsed === 'object') return [parsed as AdaptationScenario];
  }

  return [];
};

/**
 * Clean up visual_elements inside adaptation scenarios:
 * - remove useless headers like "Visual description:"
 */
export const sanitizeScenarios = (scenarios: AdaptationScenario[]): AdaptationScenario[] => {
  return scenarios.map((s) => {
    try {
      const vis = Array.isArray(s.technical_task_json?.visual_elements)
        ? (s.technical_task_json.visual_elements as unknown as string[]).filter((el: string) => {
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

/** Extract "Text on Image" candidates from scenario visual_elements */
function extractTextOnImageFromVisualElements(items: string[]) {
  const out: string[] = [];
  const quoteRe1 = /"([^"]{2,120})"/g;
  const quoteRe2 = /'([^']{2,120})'/g;
  const overlayRe = /text\s*(overlay|on\s*image)\s*[:：]\s*([\s\S]{2,200})/i;

  for (const it of items) {
    let m: RegExpExecArray | null;
    while ((m = quoteRe1.exec(it))) out.push(m[1].trim());
    while ((m = quoteRe2.exec(it))) out.push(m[1].trim());
    const ov = String(it).match(overlayRe);
    if (ov) out.push((ov[2] || '').trim());
  }

  return Array.from(new Set(out)).filter((s) => s && s.length >= 2);
}

/** ---------------------------
 *  Visual paragraphs extraction
 * --------------------------*/

/**
 * Get visual paragraphs from:
 *  - image_description (if it's real text)
 *  - otherwise video_script
 *
 * IMPORTANT: if image_description is pure JSON without "Visual Description",
 * we do NOT treat it as a text description.
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

/** ---------------------------
 *  Social Proof extraction
 * --------------------------*/

/**
 * Extract Social Proof elements from visual description and text.
 * Looks for:
 * - Star ratings (⭐, ⭐⭐⭐, etc, or numeric ratings like 4.8★)
 * - User count (2M+ users, 10K+ customers, etc)
 * - Testimonials/reviews (quotes from users)
 * - Trust badges (verified, certified, award-winning)
 * - Download counts
 * - Success metrics (X% improvement, saved $X, etc)
 */
function extractSocialProof(ad: Ad, visualParagraphs: string[]): string {
  const allText = [
    ...visualParagraphs,
    String(ad.text || ''),
    String(ad.caption || ''),
    String(ad.image_description || ''),
  ]
    .join('\n')
    .toLowerCase();

  const socialProofPatterns = [
    // Star ratings: ⭐⭐⭐⭐⭐, 4.8★, 5 stars, etc
    /(?:⭐+|★+|\d+\.?\d*\s*(?:star|★|out of 5|\/5))/gi,
    // User/download counts: 2M+ users, 10K+ downloads, 500K+ customers
    /(\d+(?:\.\d+)?[KMB]?\+?\s*(?:users|customers|downloads|installs|people|members|players|subscribers))/gi,
    // Verified/certified badges
    /(?:verified|certified|award.?winning|trusted|bestseller|top.?rated|recommended|award|badge)/gi,
    // Testimonials indicators
    /(?:[""].*?[""]|'.*?'|customer\s+(?:say|review|feedback)|user\s+(?:say|review|feedback))/gi,
    // Savings/improvement metrics: 50% faster, saves $100, increases productivity
    /(\d+%?\s*(?:faster|cheaper|better|easier|more efficient|improvement|increase|save|reduce|lower))/gi,
    // Trust/social proof phrases
    /(?:loved\s+by|trusted\s+by|used\s+by|loved\s+worldwide|join\s+\d+M|over\s+\d+M|more\s+than\s+\d+)/gi,
  ];

  const foundProofs = new Set<string>();

  for (const pattern of socialProofPatterns) {
    let match;
    while ((match = pattern.exec(allText))) {
      const proof = match[0].trim();
      if (proof.length > 2) foundProofs.add(proof);
    }
  }

  // If found specific social proof elements, return them
  if (foundProofs.size > 0) {
    return Array.from(foundProofs).slice(0, 15).join(' | ');
  }

  // Fallback: extract first meaningful sentence that mentions users/people/success
  const sentences = String(ad.text || '')
    .split(/[.!?]\s+/)
    .filter((s) =>
      /(?:user|customer|people|download|success|improve|love|rate|star|review|recommend)/i.test(s)
    );

  if (sentences.length > 0) {
    return cleanExtraSymbols(sentences[0].trim());
  }

  // Last resort: if nothing found, return empty (not fallback to full ad.text)
  return '';
}

/** ---------------------------
 *  Meta analysis build
 * --------------------------*/

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

  // Extract social proof from visual and text elements
  const socialProof = extractSocialProof(ad, visualMainParagraphs);

  return {
    'Sound Transcription': cleanExtraSymbols(
      (ex.subtitles as string) || (ex.sound_transcription as string) || ''
    ),
    'Audio Description': cleanExtraSymbols(
      cleanAndSplit((ex.audio_description as string) || '').join(' ')
    ),
    Hook: cleanExtraSymbols(ad.hook || ''),
    CTA: cleanExtraSymbols(ad.cta_text || 'None'),
    'Social Proof': cleanExtraSymbols((ex.social_proof as string) || socialProof || ''),
    'Formats & Creative Concepts': fcc,
    'Visual Description': cleanExtraSymbols(visualMainParagraphs.join(' ')),
    'Target Audience': cleanExtraSymbols((ex.target_audience as string) || ''),
  } as Record<string, unknown>;
};

/** ---------------------------
 *  Visual prompt JSON build
 * --------------------------*/

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

/** ---------------------------
 *  Sections build
 * --------------------------*/

type Section = { title: string; text: string };

function pushUnique(out: Section[], title: string, value: unknown) {
  const s = value === null || value === undefined ? '' : String(value);
  if (!s.trim()) return;
  if (out.some((x) => x.title === title)) return;
  out.push({ title, text: s.trim() });
}

/**
 * Build sections from Ad + meta.
 * This function is the single source of truth for what the UI can render later.
 */
export const buildGroupedSections = (
  ad: Ad,
  meta: Record<string, unknown>,
  scenarios: AdaptationScenario[]
) => {
  const out: Section[] = [];

  pushUnique(out, 'Title', ad.title);

  const baseAdText =
    cleanAndSplit(ad.text).join('\n\n') ||
    cleanAndSplit(ad.caption).join('\n\n') ||
    cleanAndSplit(ad.duplicates_ad_text).join('\n\n');

  pushUnique(out, 'Ad Text', cleanExtraSymbols(baseAdText));
  pushUnique(out, 'Hook', cleanExtraSymbols(String(ad.hook || meta['Hook'] || '')));
  pushUnique(out, 'Call to Action', cleanExtraSymbols(ad.cta_text || String(meta['CTA'] || '')));

  // Prefer image_description if it contains "Visual Description" content.
  // Otherwise fallback to video_script or scenario visual elements.
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

  // Extract JSON carried inside imageRaw if present
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

  // Visual prompt JSON (the structured "Image / Visual Description")
  let visualPromptJson: Record<string, unknown> | null = null;

  if (imageRaw) {
    const found: Record<string, string> = {};
    const headingsPattern = imageHeadings
      .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    let rem = imageRaw;

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

    // If no real ad text, reuse subject as fallback
    if ((!baseAdText || baseAdText.length < 10) && promptJson.subject) {
      const adTextSection = out.find((s) => s.title === 'Ad Text');
      if (adTextSection) adTextSection.text = String(promptJson.subject);
    }

    pushUnique(out, 'Image / Visual Description', JSON.stringify(promptJson, null, 2));
  }

  // Video/scenario fallback for visual description
  let videoRaw = String(ad.video_script || '').trim();
  if (videoRaw) videoRaw = stripLeading(videoRaw);

  let scenarioTextOnImage = '';
  let audioStyle = '';

  // If no video_script, try scenarios visual elements
  if (!videoRaw) {
    for (const s of scenarios) {
      const vis = s?.technical_task_json?.visual_elements;
      if (Array.isArray(vis) && vis.length) {
        const visStrings = (vis as unknown as string[]).map((x) => String(x));
        videoRaw = visStrings.join('\n\n');

        // derive text on image from scenario
        const candidates = extractTextOnImageFromVisualElements(visStrings);
        const cta = String(s?.technical_task_json?.call_to_action || '').trim();
        scenarioTextOnImage = candidates.length ? candidates.join(', ') : cta;

        // expose as raw section too
        pushUnique(out, 'Visual Elements', visStrings.join('\n'));
      }

      if (!audioStyle && s?.technical_task_json) {
        const candidate = (s.technical_task_json as Record<string, unknown>)['audio_style'];
        if (typeof candidate === 'string' && candidate.trim())
          audioStyle = cleanExtraSymbols(candidate);
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

    // If no image-based prompt JSON section exists, build it from video/scenario
    if (!out.find((s) => s.title === 'Image / Visual Description')) {
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
      visualPromptJson = visualPromptJson || promptJsonV;
      pushUnique(out, 'Image / Visual Description', JSON.stringify(promptJsonV, null, 2));
    }

    pushUnique(out, 'Video Description', videoRaw);
  }

  if (audioStyle) pushUnique(out, 'Audio Style', audioStyle);

  // Meta fields
  pushUnique(out, 'Sound Transcription', meta['Sound Transcription']);

  // Text on Image: scenario-preferred, fallback to prompt JSON
  const toi =
    scenarioTextOnImage ||
    (visualPromptJson ? String(visualPromptJson['text_on_image'] || '') : '');
  if (toi.trim()) pushUnique(out, 'Text on Image', toi.trim());

  pushUnique(out, 'Audio Description', meta['Audio Description']);
  pushUnique(out, 'Social Proof', meta['Social Proof']);
  pushUnique(out, 'Target Audience', meta['Target Audience']);

  // Formats & Creative Concepts
  const finalFcc =
    fccInline || (meta['Formats & Creative Concepts'] as Record<string, unknown> | undefined);

  if (finalFcc) {
    const fcText = Object.entries(finalFcc)
      .map(([k, v]) => `${k}: ${cleanExtraSymbols(String(v === '' ? 'Nothing to find...' : v))}`)
      .join('\n');
    pushUnique(out, 'Formats & Creative Concepts', fcText);
  }

  lastVisualPromptJson = visualPromptJson;

  return out;
};

/** ---------------------------
 *  Core Prompt JSON bundle
 * --------------------------*/

export const buildCorePromptJson = (
  ad: Ad,
  meta: Record<string, unknown>,
  scenarios: AdaptationScenario[]
) => {
  const sections = buildGroupedSections(ad, meta, scenarios);
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

export const buildPromptBundle = (ad: Ad, scenarios: AdaptationScenario[] = []) => {
  const visual = getVisualParagraphs(ad);
  const meta = buildMetaAnalysis(ad, visual.visualMainParagraphs);
  const groupedSections = buildGroupedSections(ad, meta, scenarios);
  const corePromptJson = buildCorePromptJson(ad, meta, scenarios);

  let shortPromptJson: Record<string, unknown> | null = null;

  // Try parse from Image / Visual Description section
  const visualSection = groupedSections.find(
    (s) => s.title === 'Image / Visual Description' || s.title === 'Visual Description'
  );

  if (visualSection?.text) {
    const { parsed } = tryParseJsonFromText(visualSection.text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) shortPromptJson = parsed;
  }

  // Fallback to cached
  if (!shortPromptJson && lastVisualPromptJson) shortPromptJson = lastVisualPromptJson;

  return {
    meta,
    groupedSections,
    corePromptJson,
    shortPromptJson,
  };
};

/** ---------------------------
 *  Unified Ad builder (MAIN)
 * --------------------------*/

export type UnifiedAd = Ad & {
  groupedSections: Section[];
  metaAnalysis: Record<string, unknown>;
  derived: Record<string, unknown>;
  /**
   * Fully parsed copy of the original ad where nested JSON strings
   * were converted to objects/arrays when possible.
   */
  parsed: Record<string, unknown>;
};

/**
 * Build a single, UI-friendly object:
 * - parses nested JSON everywhere (deep)
 * - normalizes scenarios
 * - produces derived fields that UI can render directly
 */
export const buildUnifiedAd = (ad: Ad): UnifiedAd => {
  try {
    // Deep parse every JSON-like string inside the ad (including nested objects)
    const parsedAd = deepParseJsonStrings(ad) as Record<string, unknown>;

    // Keep original ad shape for UI that expects typed fields,
    // but use parsedAd for additional extracted info.
    const typedAd = ad;

    const { visualMainParagraphs } = getVisualParagraphs(typedAd);

    const rawScenarios = parseScenarios(typedAd);
    const scenarios = sanitizeScenarios(Array.isArray(rawScenarios) ? rawScenarios : []);

    const meta = buildMetaAnalysis(typedAd, visualMainParagraphs);
    const groupedSections = buildGroupedSections(typedAd, meta, scenarios);

    const getSection = (title: string) =>
      groupedSections.find((s) => s.title === title)?.text?.trim() || '';

    // Visual prompt JSON
    let shortPromptJson: Record<string, unknown> | null = null;
    const visSection = groupedSections.find(
      (s) => s.title === 'Image / Visual Description' || s.title === 'Visual Description'
    );
    if (visSection?.text) {
      const { parsed } = tryParseJsonFromText(visSection.text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) shortPromptJson = parsed;
    }
    if (!shortPromptJson && lastVisualPromptJson) shortPromptJson = lastVisualPromptJson;

    // Scenario-derived (first useful scenario)
    let scenarioVisualElements: string[] = [];
    let scenarioTextOnImage = '';
    let audioStyle = '';

    for (const s of scenarios) {
      const vis = s?.technical_task_json?.visual_elements;
      if (Array.isArray(vis) && vis.length && scenarioVisualElements.length === 0) {
        scenarioVisualElements = (vis as unknown as string[]).map((x) => String(x));
        const candidates = extractTextOnImageFromVisualElements(scenarioVisualElements);
        const cta = String(s?.technical_task_json?.call_to_action || '').trim();
        scenarioTextOnImage = candidates.length ? candidates.join(', ') : cta;
      }

      if (!audioStyle && s?.technical_task_json) {
        const candidate = (s.technical_task_json as Record<string, unknown>)['audio_style'];
        if (typeof candidate === 'string' && candidate.trim())
          audioStyle = cleanExtraSymbols(candidate);
      }
    }

    const derived = {
      // Raw scenario derived
      visual_elements: scenarioVisualElements,
      visual_elements_text: scenarioVisualElements.length ? scenarioVisualElements.join('\n') : '',

      // Prefer scenario "Text on Image", fallback to prompt JSON
      text_on_image:
        scenarioTextOnImage || String((shortPromptJson || {})['text_on_image'] || '').trim(),

      // Expose sections as direct strings
      video_description: getSection('Video Description'),
      audio_style: audioStyle || getSection('Audio Style'),
      sound_transcription: getSection('Sound Transcription'),
      audio_description: getSection('Audio Description'),
      social_proof: getSection('Social Proof'),
      target_audience: getSection('Target Audience'),
      formats_and_creative_concepts_text: getSection('Formats & Creative Concepts'),

      // JSONs
      core_prompt_json: buildCorePromptJson(typedAd, meta, scenarios),
      short_prompt_json: shortPromptJson,

      // Full parsed ad snapshot (deep JSON parsed)
      // Useful for debugging / advanced UI without re-parsing.
      parsed_ad: parsedAd,
    };

    return {
      ...(typedAd as Ad),
      groupedSections,
      metaAnalysis: meta,
      derived,
      parsed: parsedAd,
    };
  } catch (e) {
    return {
      ...(ad as Ad),
      groupedSections: [],
      metaAnalysis: {},
      derived: { parsed_ad: ad },
      parsed: ad as unknown as Record<string, unknown>,
    };
  }
};

/** Backward compatible default export */
export default {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
  buildCorePromptJson,
  buildPromptBundle,
  buildUnifiedAd,
};
