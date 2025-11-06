'use client';

import React, { memo } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ViewMode } from '@/lib/types';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

function ViewToggleComponent({ currentView, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <Button
        variant={currentView === 'grid' ? 'default' : 'ghost'}
        size="icon"
        className={
          currentView === 'grid'
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'text-gray-500 hover:text-gray-800 hover:bg-white'
        }
        onClick={() => onViewChange('grid')}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">Grid view</span>
      </Button>
      <Button
        variant={currentView === 'list' ? 'default' : 'ghost'}
        size="icon"
        className={
          currentView === 'list'
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'text-gray-500 hover:text-gray-800 hover:bg-white'
        }
        onClick={() => onViewChange('list')}
      >
        <List className="h-4 w-4" />
        <span className="sr-only">List view</span>
      </Button>
    </div>
  );
}

export const ViewToggle = memo(ViewToggleComponent);
ViewToggle.displayName = 'ViewToggle';
