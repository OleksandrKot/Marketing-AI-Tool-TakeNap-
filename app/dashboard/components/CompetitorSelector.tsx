'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface CompetitorSelectorProps {
  competitors: string[];
  selectedCompetitors: string[];
  onChange: (selected: string[]) => void;
}

export function CompetitorSelector({
  competitors,
  selectedCompetitors,
  onChange,
}: CompetitorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCompetitor = (competitor: string) => {
    if (selectedCompetitors.includes(competitor)) {
      onChange(selectedCompetitors.filter((c) => c !== competitor));
    } else {
      onChange([...selectedCompetitors, competitor]);
    }
  };

  const selectAll = () => {
    onChange(competitors);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label
        htmlFor="competitor-selector-toggle"
        className="block text-sm font-medium text-slate-700 mb-2"
      >
        Select Competitors
      </label>
      <button
        id="competitor-selector-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-96 px-4 py-3 bg-white border border-slate-300 rounded-lg flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      >
        <span className="text-slate-700">
          {selectedCompetitors.length === 0
            ? 'Select competitors...'
            : `${selectedCompetitors.length} selected`}
        </span>
        <ChevronDown
          className={`h-5 w-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full md:w-96 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-sm text-slate-600 hover:text-slate-700 font-medium"
            >
              Clear All
            </button>
          </div>

          {/* Competitors List */}
          <div className="py-2">
            {competitors.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">No competitors found</div>
            ) : (
              competitors.map((competitor) => (
                <button
                  key={competitor}
                  onClick={() => toggleCompetitor(competitor)}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <span className="text-slate-700 text-left">{competitor}</span>
                  {selectedCompetitors.includes(competitor) && (
                    <Check className="h-5 w-5 text-blue-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
