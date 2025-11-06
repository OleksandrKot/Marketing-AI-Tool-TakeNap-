'use client';
import { LayoutGrid, Layers, Globe, Crop } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PillTypeSelector from '@/components/pill-type-selector';

interface AdaptationTypeSelectorProps {
  selected: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string; icon?: React.ReactNode }[];
  title?: string;
  description?: string;
  className?: string;
}

export function AdaptationTypeSelector({
  selected,
  onChange,
  options,
  title = 'Adaptation Type',
  description = 'Select adaptation type before creating an adaptation',
  className,
}: AdaptationTypeSelectorProps) {
  const defaultOptions = [
    { value: 'all', label: 'All Adaptations', icon: <LayoutGrid className="h-4 w-4 mr-2" /> },
    { value: 'resize', label: 'Resize / Reformat', icon: <Crop className="h-4 w-4 mr-2" /> },
    { value: 'translate', label: 'Translate / Localize', icon: <Globe className="h-4 w-4 mr-2" /> },
  ];

  const opts = options && options.length ? options : defaultOptions;

  return (
    <Card
      className={`border-slate-200 rounded-2xl hover:shadow-md transition-all duration-300 hover:border-slate-300 ${
        className || ''
      }`}
    >
      <CardContent className="p-6 pt-4 flex items-center space-x-4">
        <div className="p-3 bg-sky-50 rounded-xl">
          <Layers className="h-6 w-6 text-sky-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-2">
            {title} <span className="text-orange-500">*</span>
          </p>
          <p className="text-xs text-slate-400 mb-2">{description}</p>
          <PillTypeSelector options={opts} selected={selected} onChange={onChange} />
        </div>
      </CardContent>
    </Card>
  );
}

export default AdaptationTypeSelector;
