'use client';

import type {
  FormatDistribution,
  DurationDistribution,
  CharacterDistribution,
  DistributionItem,
} from '@/lib/core/types';

interface ParametersSummaryProps {
  formatDistribution: FormatDistribution;
  durationDistribution: DurationDistribution;
  characterDistribution: CharacterDistribution;
  themeDistribution: DistributionItem[];
  mechanicDistribution: DistributionItem[];
}

export function ParametersSummary({
  formatDistribution,
  durationDistribution,
  characterDistribution,
  themeDistribution,
  mechanicDistribution,
}: ParametersSummaryProps) {
  const total =
    formatDistribution.video +
    formatDistribution.static +
    formatDistribution.carousel +
    formatDistribution.other;

  const formatSummary =
    total > 0
      ? [
          formatDistribution.video > 0 &&
            `Videos — ${((formatDistribution.video / total) * 100).toFixed(0)}%`,
          formatDistribution.static > 0 &&
            `Static — ${((formatDistribution.static / total) * 100).toFixed(0)}%`,
          formatDistribution.carousel > 0 &&
            `Carousel — ${((formatDistribution.carousel / total) * 100).toFixed(0)}%`,
          formatDistribution.other > 0 &&
            `Other — ${((formatDistribution.other / total) * 100).toFixed(0)}%`,
        ]
          .filter(Boolean)
          .join(', ')
      : 'No format data available';

  const topThemes = themeDistribution
    .slice(0, 3)
    .map((t) => t.name)
    .join(', ');

  const topMechanics = mechanicDistribution
    .slice(0, 3)
    .map((m) => m.name)
    .join(', ');

  const sections = [
    {
      title: 'Format Used',
      content: formatSummary,
    },
    {
      title: 'Duration Distribution',
      content:
        durationDistribution.mostCommon.length > 0
          ? `Most common lengths: ${durationDistribution.mostCommon.join(', ')}`
          : 'No duration data available',
    },
    {
      title: 'Theme Distribution',
      content: topThemes || 'No theme data available',
    },
    {
      title: 'Mechanic Distribution',
      content: topMechanics ? `Main mechanics: ${topMechanics}` : 'No mechanic data available',
    },
    {
      title: 'Character Types',
      content: characterDistribution.mostCommon
        ? `Most common character type: ${characterDistribution.mostCommon}`
        : 'No character data available',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((section) => (
        <div key={section.title} className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">
            {section.title}
          </h3>
          <p className="text-slate-700 leading-relaxed">{section.content}</p>
        </div>
      ))}
    </div>
  );
}
