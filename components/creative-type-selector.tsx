'use client';

import React, { memo } from 'react';
import { Video, ImageIcon, LayoutGrid } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PillTypeSelector from '@/components/pill-type-selector';

interface CreativeTypeSelectorProps {
  selectedType: 'all' | 'video' | 'image';
  onTypeChange: (type: 'all' | 'video' | 'image') => void;
  className?: string;
}

function CreativeTypeSelectorComponent({
  selectedType,
  onTypeChange,
  className,
}: CreativeTypeSelectorProps) {
  return (
    <Card
      className={`border-slate-200 rounded-2xl hover:shadow-md transition-all duration-300 hover:border-slate-300 ${
        className || ''
      }`}
    >
      <CardContent className="p-6 pt-4 flex items-center space-x-4">
        <div className="p-3 bg-purple-50 rounded-xl">
          <LayoutGrid className="h-6 w-6 text-purple-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-2">
            Creative Type <span className="text-orange-500">*</span>
          </p>
          <p className="text-xs text-slate-400 mb-2">
            Select type before searching Meta Ad Library
          </p>
          <PillTypeSelector
            options={[
              { value: 'all', label: 'All Types', icon: <LayoutGrid className="h-4 w-3 mr-2" /> },
              { value: 'video', label: 'Video Only', icon: <Video className="h-4 w-3 mr-2" /> },
              {
                value: 'image',
                label: 'Static Only',
                icon: <ImageIcon className="h-4 w-3 mr-2" />,
              },
            ]}
            selected={selectedType}
            onChange={(v) => onTypeChange(v as 'all' | 'video' | 'image')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export const CreativeTypeSelector = memo(CreativeTypeSelectorComponent);
CreativeTypeSelector.displayName = 'CreativeTypeSelector';
