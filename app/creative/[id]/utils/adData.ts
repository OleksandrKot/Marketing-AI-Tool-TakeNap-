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

export const parseScenarios = (ad: Ad): AdaptationScenario[] => {
  if (!ad?.new_scenario) return [];
  try {
    const raw = String(ad.new_scenario)
      .replace(/```json|```/g, '')
      .trim();
    return JSON.parse(raw) as AdaptationScenario[];
  } catch (e) {
    console.error('parseScenarios error', e);
    return [];
  }
};

export const sanitizeScenarios = (scenarios: AdaptationScenario[]): AdaptationScenario[] => {
  return scenarios.map((scenario) => {
    try {
      const visual = Array.isArray(scenario.technical_task_json?.visual_elements)
        ? scenario.technical_task_json.visual_elements.filter((el: string) => {
            const v = String(el || '')
              .trim()
              .toLowerCase();
            if (
              v === 'visual elements' ||
              v === 'visual elements:' ||
              v === 'visual description' ||
              v === 'visual description:'
            )
              return false;
            return true;
          })
        : [];

      return {
        ...scenario,
        technical_task_json: {
          ...(scenario.technical_task_json || {}),
          visual_elements: visual,
        },
      } as AdaptationScenario;
    } catch (e) {
      return scenario;
    }
  });
};

export const getVisualParagraphs = (ad: Ad) => {
  let visualMainParagraphs: string[] = [];
  let visualExtraParagraphs: string[] = [];

  if (ad.image_description) {
    let _visualParagraphs = cleanAndSplit(ad.image_description);
    _visualParagraphs = _visualParagraphs.filter((p) => {
      const low = p.trim().toLowerCase();
      if (
        low === 'visual description' ||
        low === 'visual description:' ||
        low === 'visual description：'
      )
        return false;
      return true;
    });

    _visualParagraphs.forEach((p) => {
      const firstLine = (p.split(/\n+/)[0] || '').trim();
      const titleKey = firstLine.replace(/[:。\s]+$/, '').toLowerCase();
      if (VISUAL_EXTRA_TITLES.includes(titleKey)) {
        visualExtraParagraphs.push(p);
      } else {
        visualMainParagraphs.push(p);
      }
    });
  } else if (ad.video_script) {
    visualMainParagraphs = cleanAndSplit(ad.video_script).filter((p) => {
      const low = p.trim().toLowerCase();
      if (
        low === 'visual description' ||
        low === 'visual description:' ||
        low === 'visual description：'
      )
        return false;
      return true;
    });
    visualExtraParagraphs = [];
  }

  const visualDerivedFromVideo = !ad.image_description && !!ad.video_script;
  return { visualMainParagraphs, visualExtraParagraphs, visualDerivedFromVideo };
};

export const buildMetaAnalysis = (ad: Ad, visualMainParagraphs: string[]) => {
  const adExtra = ad as unknown as Record<string, unknown>;
  const formatsConcepts = {
    Concept: ad.concept || '',
    Format:
      (ad.display_format || '').toLowerCase() ||
      (ad.display_format === 'VIDEO' ? 'video' : 'image'),
    Realisation: (ad.realisation as string) || '',
    Topic: (ad.topic as string) || '',
    Hook: (ad.hook as string) || '',
    Character: (ad.character as string) || '',
  };

  const meta: Record<string, unknown> = {
    'Sound Transcription':
      (adExtra.sound_transcription as string) ||
      (adExtra.audio_transcription as string) ||
      'unknown',
    Subtitles: (adExtra.subtitles as string) || '',
    'Audio Description': cleanAndSplit(
      ad?.video_script || (adExtra.audio_description as string)
    ).join(' '),
    Hook: ad.hook || '',
    CTA: ad.cta_text || 'None',
    'Social Proof': (adExtra.social_proof as string) || ad.title || 'unknown',
    'User Pain Points': cleanAndSplit(ad.text).join(' '),
    'Formats & Creative Concepts': formatsConcepts,
    'Visual Description': visualMainParagraphs.join(' '),
    'Target Audience': (adExtra.target_audience as string) || '',
  };

  return meta;
};

export const buildGroupedSections = (
  ad: Ad,
  metaAnalysis: Record<string, unknown>,
  adaptationScenarios: AdaptationScenario[],
  visualDerivedFromVideo: boolean
) => {
  const groupedSections: { title: string; text: string }[] = [];
  const adExtra = ad as unknown as Record<string, unknown>;
  const pushIf = (title: string, value: unknown) => {
    console.log('buildGroupedSections value:', title, value);
    const v = value === null || value === undefined ? '' : String(value);
    if (v && v.trim()) groupedSections.push({ title, text: v });
  };

  pushIf('Title', ad.title);
  pushIf('Ad Text', cleanAndSplit(ad.text).join('\n\n'));
  pushIf('Duplicate Ad Text', cleanAndSplit(ad.duplicates_ad_text).join('\n\n'));
  pushIf('Caption', cleanAndSplit(ad.caption).join('\n\n'));
  pushIf('Call to Action', ad.cta_text);
  pushIf('Link', ad.link_url);
  pushIf('Page / Publisher', ad.page_name);
  pushIf('Archive ID', ad.ad_archive_id);
  pushIf('Format', ad.display_format);
  pushIf('Concept', ad.concept);
  pushIf('Realisation', (adExtra.realisation as string) || '');
  pushIf('Topic', (adExtra.topic as string) || '');
  pushIf('Hook', ad.hook || metaAnalysis['Hook']);
  pushIf('Character', (adExtra.character as string) || '');

  pushIf('Video Script', visualDerivedFromVideo ? '' : cleanAndSplit(ad.video_script).join('\n\n'));
  pushIf(
    'Audio Script',
    cleanAndSplit((ad as unknown as Record<string, unknown>).audio_script as string).join('\n\n')
  );
  pushIf(
    'Image / Visual Description',
    cleanAndSplit(ad.image_description).join('\n\n') || metaAnalysis['Visual Description']
  );

  pushIf('Sound Transcription', metaAnalysis['Sound Transcription']);
  pushIf('Subtitles', metaAnalysis['Subtitles']);
  pushIf('Audio Description', metaAnalysis['Audio Description']);

  pushIf('Social Proof', metaAnalysis['Social Proof']);
  pushIf('User Pain Points', metaAnalysis['User Pain Points']);
  pushIf('Target Audience', metaAnalysis['Target Audience']);

  const fcc = metaAnalysis['Formats & Creative Concepts'] as Record<string, unknown> | undefined;
  if (fcc) {
    const fcText = Object.entries(fcc)
      .map(([k, v]) => `${k}: ${String(v === '' ? 'Nothing to find...' : v + ';')}`)
      .filter(Boolean)
      .join('\n');

    pushIf('Formats & Creative Concepts', fcText);
  }

  if (Array.isArray(adaptationScenarios) && adaptationScenarios.length) {
    adaptationScenarios.forEach((s: AdaptationScenario, i: number) => {
      const parts: string[] = [];
      if (s.ad_script_title) parts.push(s.ad_script_title);
      if (s.ad_script_full_text) parts.push(s.ad_script_full_text);
      if (
        Array.isArray(s.technical_task_json?.visual_elements) &&
        s.technical_task_json.visual_elements.length
      )
        parts.push('Visual: ' + s.technical_task_json.visual_elements.join('; '));
      if (s.technical_task_json?.audio_style)
        parts.push('Audio: ' + s.technical_task_json.audio_style);
      pushIf(s.persona_adapted_for || `Scenario ${i + 1}`, parts.join('\n\n'));
    });
  }

  return groupedSections;
};

export default {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
};
