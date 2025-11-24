'use client';

import { memo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { FilterOptions } from '@/lib/core/types';
import { PlacementFilter } from './PlacementFilter';
import { ActiveDaysFilter } from './ActiveDaysFilter';
import { TagsFilter } from './TagsFilter';
import type { FilterBarProps, PlacementOption, ActiveDaysOption } from './types';

const placementOptions: PlacementOption[] = [
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Messenger', value: 'messenger' },
];

const activeDaysOptions: ActiveDaysOption[] = [
  { label: '1 day', value: '1_day' },
  { label: 'Less than week', value: 'less_week' },
  { label: '1-2 weeks', value: '1_2_weeks' },
  { label: '2-4 weeks', value: '2_4_weeks' },
  { label: '1-3 months', value: '1_3_months' },
  { label: '3+ months', value: '3_months_plus' },
];

export const FilterBar = memo(function FilterBar({
  onFilterChange,
  className,
  availableTags = [],
  selectedTags = [],
  onTagsChange,
  onFiltersCleared,
  enableTagsFilter = false,
  pages,
}: FilterBarProps) {
  void pages;
  const router = useRouter();
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    page: null,
    publisherPlatform: null,
    date: null,
    tags: null,
  });

  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null);
  const [selectedActiveDays, setSelectedActiveDays] = useState<string | null>(null);

  const handlePlacementFilter = useCallback(
    (placement: string | null) => {
      setSelectedPlacement(placement);
      const newFilters = { ...filters, publisherPlatform: placement, page: null };
      setFilters(newFilters);
      onFilterChange(newFilters);
    },
    [filters, onFilterChange]
  );

  const handleActiveDaysFilter = useCallback(
    (days: string | null) => {
      setSelectedActiveDays(days);
      // No API support yet; we simply trigger the filter change to keep UI responsive.
      onFilterChange(filters);
    },
    [filters, onFilterChange]
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      if (!onTagsChange) return;
      if (selectedTags.includes(tag)) onTagsChange(selectedTags.filter((t) => t !== tag));
      else onTagsChange([...selectedTags, tag]);
    },
    [onTagsChange, selectedTags]
  );

  const clearAllTags = useCallback(() => {
    onTagsChange?.([]);
  }, [onTagsChange]);

  const clearFilters = useCallback(() => {
    const newFilters: FilterOptions = {
      search: '',
      page: null,
      publisherPlatform: null,
      date: null,
      tags: null,
    };
    setFilters(newFilters);
    setSelectedPlacement(null);
    setSelectedActiveDays(null);
    onTagsChange?.([]);
    onFiltersCleared?.();
    onFilterChange(newFilters);
  }, [onFilterChange, onFiltersCleared, onTagsChange]);

  const shouldShowTags = enableTagsFilter && typeof onTagsChange === 'function';

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-3 shadow-sm ${className || ''}`}
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full space-y-2 md:space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
          <PlacementFilter
            options={placementOptions}
            selectedValue={selectedPlacement}
            onSelect={handlePlacementFilter}
          />
          <ActiveDaysFilter
            options={activeDaysOptions}
            selectedValue={selectedActiveDays}
            onSelect={handleActiveDaysFilter}
          />
          {shouldShowTags && (
            <TagsFilter
              availableTags={availableTags}
              selectedTags={selectedTags}
              onToggleTag={handleTagToggle}
              onClearAll={clearAllTags}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 md:mt-0">
          <Button
            variant="ghost"
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium h-9 px-3 rounded-xl transition-all duration-200"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            onClick={() => router.push('/advance-filter')}
            className="bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md font-medium rounded-xl h-9 px-6 transition-all duration-200"
          >
            Advanced Filter
          </Button>
        </div>
      </div>
    </div>
  );
});

FilterBar.displayName = 'FilterBar';
