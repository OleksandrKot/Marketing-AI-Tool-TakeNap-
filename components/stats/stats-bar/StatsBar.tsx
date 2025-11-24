'use client';

import { memo } from 'react';
import { CompetitorSearchCard } from './CompetitorSearchCard';
import { FormatSelectorCard } from './FormatSelectorCard';
import { DateRangeCard } from './DateRangeCard';

export interface StatsBarProps {
  totalAds: number;
  videoAds: number;
  uniquePages: number;
  columnIndex: number;
  value?: string;
  onChange?: (value: string) => void;
  onEnterPress?: () => void;
  numberToScrape?: number;
  setNumberToScrape?: (n: number) => void;
}

function StatsBarComponent(props: StatsBarProps) {
  switch (props.columnIndex) {
    case 0:
      return <CompetitorSearchCard {...props} />;
    case 1:
      return <FormatSelectorCard />;
    case 2:
    default:
      return <DateRangeCard />;
  }
}

export const StatsBar = memo(StatsBarComponent);
StatsBar.displayName = 'StatsBar';
