import type { FilterOptions } from '@/lib/core/types';

export interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void | Promise<void>;
  pages?: string[];
  className?: string;
  availableTags?: string[];
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  onFiltersCleared?: () => void | Promise<void>;
  enableTagsFilter?: boolean;
}

export type PlacementOption = {
  label: string;
  value: string;
};

export type ActiveDaysOption = {
  label: string;
  value: string;
};
