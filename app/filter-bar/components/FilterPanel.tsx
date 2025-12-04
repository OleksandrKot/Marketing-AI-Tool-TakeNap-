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
  variationCount?: string;
  funnels?: string[];
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
    variationBuckets: string[];
    funnels: string[];
  };
  initialPageName?: string;
  counts?: {
    pageNames: Record<string, number>;
    publisherPlatforms: Record<string, number>;
    ctaTypes: Record<string, number>;
    displayFormats: Record<string, number>;
    conceptFormats: Record<string, number>;
    realizationFormats: Record<string, number>;
    topicFormats: Record<string, number>;
    hookFormats: Record<string, number>;
    characterFormats: Record<string, number>;
    variationCounts?: Record<string, number>;
    funnels?: Record<string, number>;
  };
}

function FilterPanelComponent({
  onFiltersChange,
  availableOptions,
  initialPageName = '',
  counts,
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
    variationCount: '',
    funnels: [],
  });
  const [funnelInput, setFunnelInput] = useState('');
  // counts is provided from props

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

  const handleAddFunnel = (value?: string) => {
    const raw = ((value ?? funnelInput) || '').trim();
    if (!raw) return;
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const next = Array.isArray(filters.funnels) ? [...filters.funnels] : [];
    for (const p of parts) {
      if (!next.includes(p)) next.unshift(p);
    }
    const newFilters = { ...filters, funnels: next };
    setFilters(newFilters);
    setFunnelInput('');
    onFiltersChange(newFilters);
  };

  const handleRemoveFunnel = (value: string) => {
    const next = (filters.funnels || []).filter((f) => f !== value);
    const newFilters = { ...filters, funnels: next };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const toggleFunnelFromList = (value: string) => {
    const next = Array.isArray(filters.funnels) ? [...filters.funnels] : [];
    const idx = next.indexOf(value);
    if (idx >= 0) next.splice(idx, 1);
    else next.unshift(value);
    const newFilters = { ...filters, funnels: next };
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
      variationCount: '',
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
          aria-label="Clear all filters"
          title="Clear all filters"
          className="text-sm text-slate-600 hover:text-slate-800 underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
            aria-label="Search by title or text"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Search by title or text..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Page Name */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Page Name
            {filters.pageName &&
            counts?.pageNames &&
            typeof counts.pageNames[filters.pageName] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">({counts.pageNames[filters.pageName]})</span>
            ) : null}
          </div>
          <select
            aria-label="Filter by page name"
            value={filters.pageName}
            onChange={(e) => handleFilterChange('pageName', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All pages</option>
            {availableOptions.pageNames.map((name) => (
              <option key={name} value={name}>
                {name}
                {counts?.pageNames && typeof counts.pageNames[name] !== 'undefined'
                  ? ` (${counts.pageNames[name]})`
                  : null}
              </option>
            ))}
          </select>
        </div>

        {/* Publisher Platform */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Platform
            {filters.publisherPlatform &&
            counts?.publisherPlatforms &&
            typeof counts.publisherPlatforms[filters.publisherPlatform] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.publisherPlatforms[filters.publisherPlatform]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by platform"
            value={filters.publisherPlatform}
            onChange={(e) => handleFilterChange('publisherPlatform', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All platforms</option>
            {availableOptions.publisherPlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
                {counts?.publisherPlatforms &&
                typeof counts.publisherPlatforms[platform] !== 'undefined'
                  ? ` (${counts.publisherPlatforms[platform]})`
                  : null}
              </option>
            ))}
          </select>
        </div>

        {/* CTA Type */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            CTA Type
            {filters.ctaType &&
            counts?.ctaTypes &&
            typeof counts.ctaTypes[filters.ctaType] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">({counts.ctaTypes[filters.ctaType]})</span>
            ) : null}
          </div>
          <select
            aria-label="Filter by CTA type"
            value={filters.ctaType}
            onChange={(e) => handleFilterChange('ctaType', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All types</option>
            {availableOptions.ctaTypes.map((type) => (
              <option key={type} value={type}>
                {type}
                {counts?.ctaTypes && typeof counts.ctaTypes[type] !== 'undefined'
                  ? ` (${counts.ctaTypes[type]})`
                  : null}
              </option>
            ))}
          </select>
        </div>

        {/* Display Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Display Format
            {filters.displayFormat &&
            counts?.displayFormats &&
            typeof counts.displayFormats[filters.displayFormat] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.displayFormats[filters.displayFormat]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by display format"
            value={filters.displayFormat}
            onChange={(e) => handleFilterChange('displayFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All formats</option>
            {availableOptions.displayFormats.map((k) => (
              <option key={k} value={k}>
                {k}
                {counts?.displayFormats && typeof counts.displayFormats[k] !== 'undefined'
                  ? ` (${counts.displayFormats[k]})`
                  : null}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Creation Period</div>
          <select
            aria-label="Filter by creation period"
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
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Concept Format
            {filters.conceptFormat &&
            counts?.conceptFormats &&
            typeof counts.conceptFormats[filters.conceptFormat] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.conceptFormats[filters.conceptFormat]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by concept format"
            value={filters.conceptFormat}
            onChange={(e) => handleFilterChange('conceptFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All concepts </option>
            {availableOptions.conceptFormats.map((format) => (
              <option key={format} value={format}>
                {format}
                {counts?.conceptFormats && typeof counts.conceptFormats[format] !== 'undefined'
                  ? ` (${counts.conceptFormats[format]})`
                  : null}
              </option>
            ))}
          </select>
        </div>
        {/* Realization Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Realization Format
            {filters.realizationFormat &&
            counts?.realizationFormats &&
            typeof counts.realizationFormats[filters.realizationFormat] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.realizationFormats[filters.realizationFormat]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by realization format"
            value={filters.realizationFormat}
            onChange={(e) => handleFilterChange('realizationFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All realizations </option>
            {availableOptions.realizationFormats.map((format) => (
              <option key={format} value={format}>
                {format}
                {counts?.realizationFormats &&
                typeof counts.realizationFormats[format] !== 'undefined'
                  ? ` (${counts.realizationFormats[format]})`
                  : null}
              </option>
            ))}
          </select>
        </div>
        {/* Topic Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Topic Format
            {filters.topicFormat &&
            counts?.topicFormats &&
            typeof counts.topicFormats[filters.topicFormat] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.topicFormats[filters.topicFormat]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by topic"
            value={filters.topicFormat}
            onChange={(e) => handleFilterChange('topicFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All topics </option>
            {availableOptions.topicFormats.map((format) => (
              <option key={format} value={format}>
                {format}
                {counts?.topicFormats && typeof counts.topicFormats[format] !== 'undefined'
                  ? ` (${counts.topicFormats[format]})`
                  : null}
              </option>
            ))}
          </select>
        </div>
        {/* Hook Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Hook Format
            {filters.hookFormat &&
            counts?.hookFormats &&
            typeof counts.hookFormats[filters.hookFormat] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">({counts.hookFormats[filters.hookFormat]})</span>
            ) : null}
          </div>
          <select
            aria-label="Filter by hook"
            value={filters.hookFormat}
            onChange={(e) => handleFilterChange('hookFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All hooks </option>
            {availableOptions.hookFormats.map((format) => (
              <option key={format} value={format}>
                {format}
                {counts?.hookFormats && typeof counts.hookFormats[format] !== 'undefined'
                  ? ` (${counts.hookFormats[format]})`
                  : null}
              </option>
            ))}
          </select>
        </div>
        {/* Character Format */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Character Format
            {filters.characterFormat &&
            counts?.characterFormats &&
            typeof counts.characterFormats[filters.characterFormat] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.characterFormats[filters.characterFormat]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by character"
            value={filters.characterFormat}
            onChange={(e) => handleFilterChange('characterFormat', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All characters </option>
            {availableOptions.characterFormats.map((format) => (
              <option key={format} value={format}>
                {format}
                {counts?.characterFormats && typeof counts.characterFormats[format] !== 'undefined'
                  ? ` (${counts.characterFormats[format]})`
                  : null}
              </option>
            ))}
          </select>
        </div>
        {/* Variation Count Bucket */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">
            Variations
            {filters.variationCount &&
            counts?.variationCounts &&
            typeof counts.variationCounts[filters.variationCount] !== 'undefined' ? (
              <span className="ml-2 text-gray-500">
                ({counts.variationCounts[filters.variationCount]})
              </span>
            ) : null}
          </div>
          <select
            aria-label="Filter by variation count"
            value={filters.variationCount}
            onChange={(e) => handleFilterChange('variationCount', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">All variations</option>
            {availableOptions.variationBuckets.map((b) => {
              const labelMap: Record<string, string> = {
                more_than_10: 'More than 10',
                '5_10': '5–10',
                '3_5': '3–5',
                less_than_3: 'Less than 3',
              };
              const label = labelMap[b] ?? b;
              return (
                <option key={b} value={b}>
                  {label}
                  {counts?.variationCounts && typeof counts.variationCounts[b] !== 'undefined'
                    ? ` (${counts.variationCounts[b]})`
                    : null}
                </option>
              );
            })}
          </select>
        </div>

        {/* Funnels Filter */}
        <div>
          <div className="block text-sm font-medium text-slate-700 mb-2">Funnel</div>
          <div className="mb-2">
            <input
              id="funnelInput"
              type="text"
              aria-label="Paste funnel URL or value"
              value={funnelInput}
              onChange={(e) => setFunnelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFunnel();
                }
              }}
              placeholder="Paste funnel URL or value"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {(filters.funnels || []).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-label={`Remove funnel ${f}`}
                  title={`Remove funnel ${f}`}
                  onClick={() => handleRemoveFunnel(f)}
                  className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {f} ×
                </button>
              ))}
            </div>
          </div>

          <div
            className="max-h-40 overflow-auto border border-slate-100 rounded-md p-2"
            role="region"
            aria-label="Available funnels"
          >
            {availableOptions.funnels.length === 0 ? (
              <div className="text-sm text-slate-500">No funnels detected</div>
            ) : (
              availableOptions.funnels
                .filter(
                  (opt) => funnelInput.trim() === '' || opt.includes(funnelInput.toLowerCase())
                )
                .slice(0, 200)
                .map((opt) => (
                  <div
                    key={opt}
                    className="flex items-center justify-between py-1 px-2"
                    role="listitem"
                  >
                    <div className="text-sm text-slate-700 truncate">{opt}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-500" aria-hidden>
                        {counts?.funnels && typeof counts.funnels[opt] !== 'undefined'
                          ? `(${counts.funnels[opt]})`
                          : ''}
                      </div>
                      <button
                        type="button"
                        aria-pressed={(filters.funnels || []).includes(opt)}
                        aria-label={`Toggle funnel ${opt}. ${
                          counts?.funnels && typeof counts.funnels[opt] !== 'undefined'
                            ? `${counts.funnels[opt]} matches`
                            : ''
                        }`}
                        onClick={() => toggleFunnelFromList(opt)}
                        className={`text-xs px-2 py-1 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                          (filters.funnels || []).includes(opt)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {(filters.funnels || []).includes(opt) ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// `memo` returns a React exotic component — give it a proper type instead of using `any`.
const MemoFilterPanel = memo(FilterPanelComponent) as React.NamedExoticComponent<FilterPanelProps>;
MemoFilterPanel.displayName = 'FilterPanel';
export default MemoFilterPanel;
