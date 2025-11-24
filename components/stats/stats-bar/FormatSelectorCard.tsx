'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, Video, X } from 'lucide-react';

const formatOptions = ['All Formats', 'Video', 'Image'];

export function FormatSelectorCard() {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);

  const handleToggle = () => setIsFormatDropdownOpen((prev) => !prev);

  return (
    <Card className="border-slate-200 rounded-2xl hover:shadow-md transition-all duration-300 hover:border-slate-300">
      <CardContent className="p-6 pt-6 flex items-center space-x-4">
        <div className="p-3 bg-emerald-50 rounded-xl">
          <Video className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-2">Creative Format</p>
          <div className="relative">
            <div
              role="button"
              tabIndex={0}
              className={`w-full h-9 px-3 py-2 border-2 ${
                isFormatDropdownOpen ? 'border-blue-500' : 'border-slate-200'
              } rounded-lg bg-white flex items-center justify-between cursor-pointer text-sm text-slate-700`}
              onClick={handleToggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }}
            >
              <div className="flex items-center space-x-2">
                <Video className="h-4 w-4 text-slate-400" />
                <span>{selectedFormat || 'All Formats'}</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedFormat && (
                  <button
                    aria-label="Clear selected format"
                    title="Clear selected format"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFormat(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    isFormatDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {isFormatDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                {formatOptions.map((format) => {
                  const isSelected =
                    selectedFormat === format || (!selectedFormat && format === 'All Formats');
                  return (
                    <div
                      key={format}
                      role="button"
                      tabIndex={0}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-blue-100 cursor-pointer text-sm ${
                        isSelected ? 'bg-blue-100' : ''
                      }`}
                      onClick={() => {
                        setSelectedFormat(format === 'All Formats' ? null : format);
                        setIsFormatDropdownOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedFormat(format === 'All Formats' ? null : format);
                          setIsFormatDropdownOpen(false);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        {isSelected && (
                          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                        <span className="text-slate-700">{format}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
