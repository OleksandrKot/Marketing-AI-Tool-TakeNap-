'use client';

import React, { useState, useEffect, useRef, memo } from 'react';

type CountsMap = Record<string, number> | undefined;

function DropdownMulti({
  label,
  options,
  selected,
  counts,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  selected: string[];
  counts?: CountsMap;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        open &&
        wrapRef.current &&
        !wrapRef.current.contains(t) &&
        btnRef.current &&
        !btnRef.current.contains(t)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const summary = (() => {
    if (!selected || selected.length === 0) return `All ${label.toLowerCase()}`;
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;
  })();

  const filtered = options
    .filter((o) => {
      // Filter by search query
      if (query.trim() !== '' && !o.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      // Hide options with zero count (unless selected)
      if (
        counts &&
        typeof counts[o] === 'number' &&
        counts[o] === 0 &&
        !(selected || []).includes(o)
      ) {
        return false;
      }
      return true;
    })
    .slice(0, 300);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="block text-sm font-medium text-slate-700 mb-2">{label}</div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-slate-900 truncate">{summary}</span>
        <svg
          className={`ml-2 h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3">
          <input
            type="text"
            aria-label={`Search ${label}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full mb-3 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />

          {selected && selected.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selected.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onToggle(n)}
                  className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                >
                  {n} ×
                </button>
              ))}
            </div>
          )}

          <div className="max-h-56 overflow-auto rounded-md" role="listbox" aria-label={label}>
            {filtered.map((opt) => {
              const sel = (selected || []).includes(opt);
              const cnt = counts && typeof counts[opt] !== 'undefined' ? counts[opt] : undefined;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => onToggle(opt)}
                  className={`w-full flex items-center justify-between py-1.5 px-2 text-left hover:bg-slate-50 rounded ${
                    sel ? 'bg-violet-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={sel} readOnly className="h-4 w-4" />
                    <span className="text-sm text-slate-700 truncate">{opt}</span>
                  </div>
                  <div className="text-xs text-slate-500 ml-2 whitespace-nowrap">
                    {typeof cnt !== 'undefined' ? `(${cnt})` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onClear()}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessDropdown({
  label,
  businesses,
  selectedId,
  onChange,
}: {
  label: string;
  businesses: Array<{ id: string; name: string; slug: string }>;
  selectedId?: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        open &&
        wrapRef.current &&
        !wrapRef.current.contains(t) &&
        btnRef.current &&
        !btnRef.current.contains(t)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedName = (() => {
    if (!selectedId) return '';
    const b = businesses.find((x) => String(x.id) === String(selectedId));
    return b?.name || '';
  })();

  const summary = selectedName ? selectedName : 'Select business';

  const filtered = businesses
    .filter((b) => (query.trim() ? b.name.toLowerCase().includes(query.toLowerCase()) : true))
    .slice(0, 500);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="block text-sm font-medium text-slate-700 mb-2">{label}</div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-slate-900 truncate">{summary}</span>
        <svg
          className={`ml-2 h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3">
          <input
            type="text"
            aria-label={`Search ${label}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full mb-3 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />

          <div className="max-h-56 overflow-auto rounded-md" role="listbox" aria-label={label}>
            {filtered.map((b) => {
              const sel = String(b.id) === String(selectedId || '');
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => {
                    onChange(String(b.id));
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between py-1.5 px-2 text-left hover:bg-slate-50 rounded ${
                    sel ? 'bg-violet-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="radio" checked={sel} readOnly className="h-4 w-4" />
                    <span className="text-sm text-slate-700 truncate">{b.name}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterOptions {
  pageName?: string;
  pageNames?: string[]; // multi-select
  publisherPlatform: string;
  publisherPlatforms?: string[];
  ctaType: string;
  ctaTypes?: string[];
  displayFormat: string;
  displayFormats?: string[];
  dateRange: string;
  searchQuery: string;
  conceptFormat: string;
  conceptFormats?: string[];
  realizationFormat: string;
  realizationFormats?: string[];
  topicFormat: string;
  topicFormats?: string[];
  hookFormat: string;
  hookFormats?: string[];
  characterFormat: string;
  characterFormats?: string[];
  variationCount?: string;
  variationCounts?: string[];
  dateRanges?: string[];
  funnels?: string[];
  businessId?: string;
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
    dateRangeOptions: string[];
    funnels: string[];
    businesses: Array<{ id: string; name: string; slug: string }>;
  };
  initialPageName?: string;
  initialPageNames?: string[];
  initialTopic?: string;
  initialTopics?: string[];
  initialHook?: string;
  initialHooks?: string[];
  initialFunnels?: string[];
  initialDateRanges?: string[];
  initialBusinessId?: string;
  initialDisplayFormats?: string[];
  initialCtaTypes?: string[];
  initialConcepts?: string[];
  initialRealizations?: string[];
  initialCharacters?: string[];
  initialPlatforms?: string[];
  initialSearchQuery?: string;
  initialVariationCounts?: string[];
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
    dateRanges?: Record<string, number>;
    funnels?: Record<string, number>;
  };
}

function FilterPanelComponent({
  onFiltersChange,
  availableOptions,
  initialPageName = '',
  initialPageNames = [],
  initialTopic = '',
  initialTopics = [],
  initialHook = '',
  initialHooks = [],
  initialFunnels = [],
  initialDateRanges = [],
  initialBusinessId = '',
  initialDisplayFormats = [],
  initialCtaTypes = [],
  initialConcepts = [],
  initialRealizations = [],
  initialCharacters = [],
  initialPlatforms = [],
  initialSearchQuery = '',
  initialVariationCounts = [],
  counts,
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    pageName: '',
    pageNames: initialPageNames,
    publisherPlatform: '',
    publisherPlatforms: initialPlatforms,
    ctaType: '',
    ctaTypes: initialCtaTypes,
    displayFormat: '',
    displayFormats: initialDisplayFormats,
    searchQuery: initialSearchQuery,
    conceptFormat: '',
    conceptFormats: initialConcepts,
    realizationFormat: '',
    realizationFormats: initialRealizations,
    topicFormat: '',
    topicFormats: initialTopics,
    hookFormat: '',
    hookFormats: initialHooks,
    characterFormat: '',
    characterFormats: initialCharacters,
    variationCount: '',
    variationCounts: initialVariationCounts,
    dateRange: '',
    dateRanges: initialDateRanges,
    funnels: initialFunnels,
    businessId: initialBusinessId,
  });

  // Note: Do not auto-prune selections during facets refresh to avoid accidental resets.
  // Default-select the first available business when none is chosen
  useEffect(() => {
    if (
      !filters.businessId &&
      Array.isArray(availableOptions.businesses) &&
      availableOptions.businesses.length > 0
    ) {
      const firstId = availableOptions.businesses[0].id;
      const nf = { ...filters, businessId: String(firstId) };
      setFilters(nf);
      onFiltersChange(nf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableOptions.businesses]);
  // counts is provided from props

  // Initialize pageName from prop when component mounts
  useEffect(() => {
    if (initialPageNames && initialPageNames.length > 0) {
      const newFilters = { ...filters, pageName: '', pageNames: initialPageNames };
      setFilters(newFilters);
      onFiltersChange(newFilters);
    } else if (initialPageName) {
      const newFilters = { ...filters, pageName: '', pageNames: [initialPageName] };
      setFilters(newFilters);
      // Inform parent about initial filter
      onFiltersChange(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPageName, initialPageNames]);

  // Initialize topicFormat(s) from prop when component mounts
  useEffect(() => {
    if (initialTopic) {
      const newFilters = { ...filters, topicFormat: '', topicFormats: [initialTopic] };
      setFilters(newFilters);
      // Inform parent about initial filter
      onFiltersChange(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic]);

  // Initialize hookFormat(s) from prop when component mounts
  useEffect(() => {
    if (initialHook) {
      const newFilters = { ...filters, hookFormat: '', hookFormats: [initialHook] };
      setFilters(newFilters);
      // Inform parent about initial filter
      onFiltersChange(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHook]);

  // Initialize funnels/dateRanges from props on mount
  useEffect(() => {
    const nf: FilterOptions = { ...filters };
    let changed = false;
    if (Array.isArray(initialFunnels) && initialFunnels.length > 0) {
      nf.funnels = initialFunnels;
      changed = true;
    }
    if (Array.isArray(initialDateRanges) && initialDateRanges.length > 0) {
      nf.dateRanges = initialDateRanges;
      nf.dateRange = '';
      changed = true;
    }
    if (changed) {
      setFilters(nf);
      onFiltersChange(nf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleFilterChange = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value } as FilterOptions;
      // Propagate changes to parent immediately (e.g., search, business)
      onFiltersChange(next);
      return next;
    });
  };

  const togglePageName = (name: string) => {
    const current = Array.isArray(filters.pageNames) ? [...filters.pageNames] : [];
    const idx = current.indexOf(name);
    if (idx >= 0) current.splice(idx, 1);
    else current.unshift(name);
    const newFilters = { ...filters, pageNames: current, pageName: '' };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Generic togglers for multi-select filters
  const makeToggle =
    (key: keyof FilterOptions, clearKey?: keyof FilterOptions) => (value: string) => {
      const arr = Array.isArray(filters[key] as unknown[])
        ? ([...(filters[key] as unknown[])] as string[])
        : [];
      const i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1);
      else arr.unshift(value);
      const newFilters: FilterOptions = { ...filters, [key]: arr } as FilterOptions;
      if (clearKey) {
        newFilters[clearKey] = '' as never;
      }
      setFilters(newFilters);
      onFiltersChange(newFilters);
    };

  const makeClear = (key: keyof FilterOptions, clearKey?: keyof FilterOptions) => () => {
    const newFilters: FilterOptions = { ...filters, [key]: [] } as FilterOptions;
    if (clearKey) {
      newFilters[clearKey] = '' as never;
    }
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterOptions = {
      pageName: '',
      pageNames: [],
      publisherPlatform: '',
      publisherPlatforms: [],
      ctaType: '',
      ctaTypes: [],
      displayFormat: '',
      displayFormats: [],
      dateRange: '',
      dateRanges: [],
      searchQuery: '',
      conceptFormat: '',
      conceptFormats: [],
      realizationFormat: '',
      realizationFormats: [],
      topicFormat: '',
      topicFormats: [],
      hookFormat: '',
      hookFormats: [],
      characterFormat: '',
      characterFormats: [],
      variationCount: '',
      variationCounts: [],
      funnels: [],
      businessId:
        Array.isArray(availableOptions.businesses) && availableOptions.businesses.length > 0
          ? String(availableOptions.businesses[0].id)
          : '',
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Filters</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              try {
                const href = window.location.href;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(href).catch(() => {});
                }
                // Fallback: open in new tab if copy fails
                else {
                  window.open(href, '_blank');
                }
              } catch (e) {
                // noop
              }
            }}
            aria-label="Copy link to current filters"
            title="Copy link to current filters"
            className="text-sm px-3 py-1.5 rounded-md bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200"
          >
            Export via link
          </button>
          <button
            disabled
            aria-disabled
            title="WIP: JSON export will be available soon"
            className="text-sm px-3 py-1.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
          >
            Export JSON (WIP)
          </button>
          <button
            onClick={clearFilters}
            aria-label="Clear all filters"
            title="Clear all filters"
            className="text-sm text-slate-600 hover:text-slate-800 underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear all
          </button>
        </div>
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

        {/* Page Names */}
        <DropdownMulti
          label="Page Names"
          options={availableOptions.pageNames}
          selected={filters.pageNames || []}
          counts={counts?.pageNames}
          onToggle={togglePageName}
          onClear={() => {
            const nf = { ...filters, pageNames: [], pageName: '' };
            setFilters(nf);
            onFiltersChange(nf);
          }}
        />

        {/* Publisher Platforms */}
        <DropdownMulti
          label="Platforms"
          options={availableOptions.publisherPlatforms}
          selected={filters.publisherPlatforms || []}
          counts={counts?.publisherPlatforms}
          onToggle={makeToggle('publisherPlatforms', 'publisherPlatform')}
          onClear={makeClear('publisherPlatforms', 'publisherPlatform')}
        />

        {/* CTA Types */}
        <DropdownMulti
          label="CTA Types"
          options={availableOptions.ctaTypes}
          selected={filters.ctaTypes || []}
          counts={counts?.ctaTypes}
          onToggle={makeToggle('ctaTypes', 'ctaType')}
          onClear={makeClear('ctaTypes', 'ctaType')}
        />

        {/* Display Formats */}
        <DropdownMulti
          label="Display Formats"
          options={availableOptions.displayFormats}
          selected={filters.displayFormats || []}
          counts={counts?.displayFormats}
          onToggle={makeToggle('displayFormats', 'displayFormat')}
          onClear={makeClear('displayFormats', 'displayFormat')}
        />

        {/* Concept Formats */}
        <DropdownMulti
          label="Concept Formats"
          options={availableOptions.conceptFormats}
          selected={filters.conceptFormats || []}
          counts={counts?.conceptFormats}
          onToggle={makeToggle('conceptFormats', 'conceptFormat')}
          onClear={makeClear('conceptFormats', 'conceptFormat')}
        />
        {/* Realization Formats */}
        <DropdownMulti
          label="Realization Formats"
          options={availableOptions.realizationFormats}
          selected={filters.realizationFormats || []}
          counts={counts?.realizationFormats}
          onToggle={makeToggle('realizationFormats', 'realizationFormat')}
          onClear={makeClear('realizationFormats', 'realizationFormat')}
        />
        {/* Topic Formats */}
        <DropdownMulti
          label="Topic Formats"
          options={availableOptions.topicFormats}
          selected={filters.topicFormats || []}
          counts={counts?.topicFormats}
          onToggle={makeToggle('topicFormats', 'topicFormat')}
          onClear={makeClear('topicFormats', 'topicFormat')}
        />
        {/* Hook Formats */}
        <DropdownMulti
          label="Hook Formats"
          options={availableOptions.hookFormats}
          selected={filters.hookFormats || []}
          counts={counts?.hookFormats}
          onToggle={makeToggle('hookFormats', 'hookFormat')}
          onClear={makeClear('hookFormats', 'hookFormat')}
        />
        {/* Character Formats */}
        <DropdownMulti
          label="Character Formats"
          options={availableOptions.characterFormats}
          selected={filters.characterFormats || []}
          counts={counts?.characterFormats}
          onToggle={makeToggle('characterFormats', 'characterFormat')}
          onClear={makeClear('characterFormats', 'characterFormat')}
        />

        {/* Variations */}
        <DropdownMulti
          label="Variations"
          options={(availableOptions?.variationBuckets || []).map((b) => {
            const labelMap: Record<string, string> = {
              more_than_10: 'More than 10',
              '5_10': '5–10',
              '3_5': '3–5',
              less_than_3: 'Less than 3',
            };
            return labelMap[b] ?? b;
          })}
          selected={(filters.variationCounts || []).map((v) => {
            const labelMap: Record<string, string> = {
              more_than_10: 'More than 10',
              '5_10': '5–10',
              '3_5': '3–5',
              less_than_3: 'Less than 3',
            };
            return labelMap[v] ?? v;
          })}
          counts={counts?.variationCounts}
          onToggle={(label) => {
            const reverseMap: Record<string, string> = {
              'More than 10': 'more_than_10',
              '5–10': '5_10',
              '3–5': '3_5',
              'Less than 3': 'less_than_3',
            };
            const bucket = reverseMap[label] ?? label;
            makeToggle('variationCounts', 'variationCount')(bucket);
          }}
          onClear={makeClear('variationCounts', 'variationCount')}
        />

        {/* Date Ranges */}
        <DropdownMulti
          label="Creation Period"
          options={(availableOptions?.dateRangeOptions || []).map((d) => {
            const labelMap: Record<string, string> = {
              today: 'Today',
              week: 'Last week',
              month: 'Last month',
              quarter: 'Last quarter',
            };
            return labelMap[d] ?? d;
          })}
          selected={(filters.dateRanges || []).map((d) => {
            const labelMap: Record<string, string> = {
              today: 'Today',
              week: 'Last week',
              month: 'Last month',
              quarter: 'Last quarter',
            };
            return labelMap[d] ?? d;
          })}
          counts={counts?.dateRanges}
          onToggle={(label) => {
            const reverseMap: Record<string, string> = {
              Today: 'today',
              'Last week': 'week',
              'Last month': 'month',
              'Last quarter': 'quarter',
            };
            const key = reverseMap[label] ?? label;
            makeToggle('dateRanges', 'dateRange')(key);
          }}
          onClear={makeClear('dateRanges', 'dateRange')}
        />

        {/* Funnels */}
        <DropdownMulti
          label="Funnels"
          options={availableOptions.funnels}
          selected={filters.funnels || []}
          counts={counts?.funnels}
          onToggle={makeToggle('funnels')}
          onClear={makeClear('funnels')}
        />

        {/* Business */}
        <BusinessDropdown
          label="Business"
          businesses={availableOptions.businesses}
          selectedId={filters.businessId}
          onChange={(id) => handleFilterChange('businessId', id)}
        />
      </div>
    </div>
  );
}

// `memo` returns a React exotic component — give it a proper type instead of using `any`.
const MemoFilterPanel = memo(FilterPanelComponent) as React.NamedExoticComponent<FilterPanelProps>;
MemoFilterPanel.displayName = 'FilterPanel';
export default MemoFilterPanel;
