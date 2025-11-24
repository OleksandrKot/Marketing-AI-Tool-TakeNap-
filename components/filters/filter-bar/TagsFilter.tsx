'use client';

import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type TagsFilterProps = {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
};

export function TagsFilter({
  availableTags,
  selectedTags,
  onToggleTag,
  onClearAll,
}: TagsFilterProps) {
  const [open, setOpen] = useState(false);

  if (availableTags.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200 w-full"
          onClick={() => setOpen((prev) => !prev)}
        >
          <div className="flex items-center space-x-2">
            <Tag className="h-4 w-4 text-slate-400" />
            <span className="truncate">
              {selectedTags.length > 0 ? `${selectedTags.length} tags` : 'Filter by tags'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {selectedTags.length > 0 && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onClearAll();
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Clear selected tags"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <svg className="h-4 w-4 ml-2 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg w-64 max-h-64 overflow-auto">
        <div className="p-2">
          <div className="text-xs text-slate-500 font-medium mb-2 px-2">Available Tags:</div>
          {availableTags.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <DropdownMenuItem
                key={tag}
                onClick={() => onToggleTag(tag)}
                className={`hover:bg-purple-100 cursor-pointer rounded-lg ${
                  selected ? 'bg-purple-100' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <Tag className="h-3 w-3 mr-2 text-slate-400" />
                    <span className="text-sm">{tag}</span>
                  </div>
                  {selected && (
                    <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
          {availableTags.length === 0 && (
            <div className="text-xs text-slate-400 px-2 py-1">No tags available</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
