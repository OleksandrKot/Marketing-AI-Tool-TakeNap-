'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { ActiveDaysOption } from './types';

type ActiveDaysFilterProps = {
  options: ActiveDaysOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
};

export function ActiveDaysFilter({ options, selectedValue, onSelect }: ActiveDaysFilterProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          onClick={() => setOpen((prev) => !prev)}
          className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200 w-full"
        >
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="truncate">
              {selectedValue
                ? options.find((option) => option.value === selectedValue)?.label
                : 'Active days'}
            </span>
          </div>
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
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
        <DropdownMenuItem
          onClick={() => {
            onSelect(null);
            setOpen(false);
          }}
          className={`hover:bg-blue-100 ${!selectedValue ? 'bg-blue-100' : ''}`}
        >
          <DropdownItemLabel text="All periods" selected={!selectedValue} />
        </DropdownMenuItem>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              onSelect(option.value);
              setOpen(false);
            }}
            className={`hover:bg-blue-100 ${selectedValue === option.value ? 'bg-blue-100' : ''}`}
          >
            <DropdownItemLabel text={option.label} selected={selectedValue === option.value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownItemLabel({ text, selected }: { text: string; selected: boolean }) {
  return (
    <div className="flex items-center justify-between w-full">
      <span>{text}</span>
      {selected && (
        <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
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
  );
}
