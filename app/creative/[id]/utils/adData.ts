import cleanAndSplit from './cleanAndSplit';
import type { Ad, AdaptationScenario } from '@/lib/types';

const VISUAL_EXTRA_TITLES = [
  'colors and style',
  'visible emotions',
  'overall mood or feeling',
  'overall mood',
  'visible emotions:',
  'colors and style:',
  'overall mood or feeling:',
];

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

function tryParseJsonFromText(text?: string) {
  if (!text) return { parsed: null as Record<string, unknown> | null, cleaned: '' };
  let t = String(text);
  const fenced = t.match(/```(?:json\s*)?([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const j = fenced[1].trim();
    try {
      const o = JSON.parse(j) as Record<string, unknown>;
      t = t.replace(fenced[0], '').trim();
      t = stripTrailingKVs(t);
      return { parsed: o, cleaned: t };
    } catch {}
  }
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
      } catch {}
    }
  }
  const kv = parseTrailingKVs(t);
  if (Object.keys(kv.obj).length) return { parsed: kv.obj, cleaned: kv.cleaned };
  return { parsed: null, cleaned: t };
}

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
  let match;
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

export function cleanExtraSymbols(text: string) {
  return text.replace(/\*/g, '').trim();
}

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

export const buildGroupedSections = (
  ad: Ad,
  meta: Record<string, unknown>,
  adaptationScenarios: AdaptationScenario[],
  visualDerivedFromVideo: boolean
) => {
  const out: { title: string; text: string }[] = [];
  const ex = ad as unknown as Record<string, unknown>;
  const push = (t: string, v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s && s.trim() && !out.find((item) => item.title === t)) out.push({ title: t, text: s });
  };

  push('Title', ad.title);
  push('Duplicate Ad Text', cleanAndSplit(ad.duplicates_ad_text).join('\n\n'));
  push('Caption', cleanAndSplit(ad.caption).join('\n\n'));
  push('Call to Action', cleanExtraSymbols(ad.cta_text));
  push('Link', ad.link_url);
  push('Page / Publisher', ad.page_name);
  push('Archive ID', ad.ad_archive_id);
  push('Format', ad.display_format);
  push('Concept', ad.concept);
  push('Realisation', (ex.realisation as string) || '');
  push('Topic', (ex.topic as string) || '');
  push('Hook', cleanExtraSymbols(String(ad.hook || meta['Hook'] || '')));
  push('Character', (ex.character as string) || '');
  push('Video Script', visualDerivedFromVideo ? '' : cleanAndSplit(ad.video_script).join('\n\n'));
  push('Audio Script', cleanAndSplit((ex.audio_script as string) || '').join('\n\n'));

  let fccInline: Record<string, unknown> | undefined = meta['Formats & Creative Concepts'] as
    | Record<string, unknown>
    | undefined;

  const imageRawOrig = String(ad.image_description || meta['Visual Description'] || '').trim();
  let imageRaw = imageRawOrig;
  const imageHeadings = [
    'Main Objects and Characters',
    'Setting and Background',
    'Colors and Style',
    'Visible Emotions',
    'Overall Mood or Feeling',
  ];

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

  if (!imageRaw) push('Image / Visual Description', meta['Visual Description']);
  else {
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
    const shortPrompt = mkShort(found, imageRaw);
    const visualText = fccInline
      ? `${shortPrompt}\n\n${Object.entries(fccInline)
          .map(([k, v]) => `${k}: ${cleanExtraSymbols(String(v))}`)
          .join('\n')}`
      : shortPrompt;
    const adTextReplacement = visualText || cleanAndSplit(ad.text).join('\n\n');
    out.splice(1, 0, { title: 'Ad Text', text: adTextReplacement });
    push('Image / Visual Description', visualText);
    for (const h of imageHeadings) if (found[h]) push(h, found[h]);
  }

  let videoRaw = String(ad.video_script || '').trim();
  let audioStyle = '';
  if (videoRaw) videoRaw = stripLeading(videoRaw);

  if (!videoRaw) {
    let sc: AdaptationScenario[] = [];
    if (Array.isArray(adaptationScenarios) && adaptationScenarios.length)
      sc = sanitizeScenarios(adaptationScenarios);
    else {
      try {
        const parsed = parseScenarios(ad);
        if (Array.isArray(parsed) && parsed.length) sc = sanitizeScenarios(parsed);
      } catch {}
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
    const shortPromptV = mkShort(foundVideo, videoRaw);
    const visualTextV = fccInline
      ? `${shortPromptV}\n\n${Object.entries(fccInline)
          .map(([k, v]) => `${k}: ${cleanExtraSymbols(String(v))}`)
          .join('\n')}`
      : shortPromptV;

    push('Image / Visual Description', visualTextV || meta['Visual Description']);
    for (const h of imageHeadings) if (foundVideo[h]) push(h, foundVideo[h]);
  }
  if (audioStyle) push('Audio Style', audioStyle);

  push('Sound Transcription', meta['Sound Transcription']);
  push('Audio Description', meta['Audio Description']);
  push('Social Proof', meta['Social Proof']);
  push('Target Audience', meta['Target Audience']);

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

export default {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
};
