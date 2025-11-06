'use client';

import React, { useState, useEffect, memo } from 'react';

interface FilterOptions {
  pageName: string;
  publisherPlatform: string;
  ctaType: string;
  displayFormat: string;
  dateRange: string;
  searchQuery: string;
  conceptFormat: string;
  realizationFormat: string;
  topicFormat: string;
  hookFormat: string;
  characterFormat: string;
}

interface FilterPanelProps {
  onFiltersChange: (filters: FilterOptions) => void;
  availableOptions: {
    pageNames: string[];
    publisherPlatforms: string[];
    ctaTypes: string[];
    displayFormats: string[];
    conceptFormats: string[];
    realizationFormats: string[];
    topicFormats: string[];
    hookFormats: string[];
    characterFormats: string[];
  };
  initialPageName?: string;
}

function FilterPanelComponent({
  onFiltersChange,
  availableOptions,
  initialPageName = '',
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    pageName: '',
    publisherPlatform: '',
    ctaType: '',
    displayFormat: '',
    dateRange: '',
    searchQuery: '',
    conceptFormat: '',
    realizationFormat: '',
    topicFormat: '',
    hookFormat: '',
    characterFormat: '',
  });

  // Initialize pageName from prop when component mounts
  useEffect(() => {
    if (initialPageName) {
      const newFilters = { ...filters, pageName: initialPageName };
      setFilters(newFilters);
      // Inform parent about initial filter
      onFiltersChange(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPageName]);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      pageName: '',
      publisherPlatform: '',
      ctaType: '',
      displayFormat: '',
      dateRange: '',
      searchQuery: '',
      conceptFormat: '',
      realizationFormat: '',
      topicFormat: '',
      hookFormat: '',
      characterFormat: '',
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Filters</h2>
        <button
          onClick={clearFilters}
          className="text-sm text-slate-600 hover:text-slate-800 underline"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Search</div>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Search by title or text..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Page Name */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Page Name</div>
          <select
            value={filters.pageName}
            onChange={(e) => handleFilterChange('pageName', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All pages</option>
            {availableOptions.pageNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Publisher Platform */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Platform</div>
          <select
            value={filters.publisherPlatform}
            onChange={(e) => handleFilterChange('publisherPlatform', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All platforms</option>
            {availableOptions.publisherPlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {/* Display a human-friendly label: capitalize first letter */}
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* CTA Type */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">CTA Type</div>
          <select
            value={filters.ctaType}
            onChange={(e) => handleFilterChange('ctaType', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All types</option>
            {availableOptions.ctaTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Display Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Display Format</div>
          <select
            value={filters.displayFormat}
            onChange={(e) => handleFilterChange('displayFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All formats</option>
            {availableOptions.displayFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Creation Period</div>
          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All time</option>
            <option value="today">Today</option>
            <option value="week">Last week</option>
            <option value="month">Last month</option>
            <option value="quarter">Last quarter</option>
          </select>
        </div>
        {/* Concept Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Concept Format</div>
          <select
            value={filters.conceptFormat}
            onChange={(e) => handleFilterChange('conceptFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All concepts </option>
            {availableOptions.conceptFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>
        {/* Realization Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Realization Format</div>
          <select
            value={filters.realizationFormat}
            onChange={(e) => handleFilterChange('realizationFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All realizations </option>
            {availableOptions.realizationFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>
        {/* Topic Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Topic Format</div>
          <select
            value={filters.topicFormat}
            onChange={(e) => handleFilterChange('topicFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All topics </option>
            {availableOptions.topicFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>
        {/* Hook Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Hook Format</div>
          <select
            value={filters.hookFormat}
            onChange={(e) => handleFilterChange('hookFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All hooks </option>
            {availableOptions.hookFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>
        {/* Character Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Character Format</div>
          <select
            value={filters.characterFormat}
            onChange={(e) => handleFilterChange('characterFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All characters </option>
            {availableOptions.characterFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// `memo` returns a React exotic component — give it a proper type instead of using `any`.
const MemoFilterPanel = memo(FilterPanelComponent) as React.NamedExoticComponent<FilterPanelProps>;
MemoFilterPanel.displayName = 'FilterPanel';
export default MemoFilterPanel;
