'use client';

import { Button } from '@/components/ui/button';
import { FileText, Info, Zap } from 'lucide-react';

interface CreativeTabsProps {
  activeTab: 'content' | 'info' | 'adaptations';
  onTabChange: (tab: 'content' | 'info' | 'adaptations') => void;
}

export function CreativeTabs({ activeTab, onTabChange }: CreativeTabsProps) {
  return (
    <div className="flex bg-blue-50 border border-blue-200 rounded-xl overflow-hidden shadow-sm mb-8">
      <Button
        variant="ghost"
        className={`h-12 px-6 rounded-none font-medium transition-all duration-200 ${
          activeTab === 'content'
            ? 'bg-blue-600 text-white border-r border-blue-500'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-r border-blue-200'
        }`}
        onClick={() => onTabChange('content')}
      >
        <FileText className="h-4 w-4 mr-2" />
        Content
      </Button>
      <Button
        variant="ghost"
        className={`h-12 px-6 rounded-none font-medium transition-all duration-200 ${
          activeTab === 'info'
            ? 'bg-blue-600 text-white border-r border-blue-500'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-r border-blue-200'
        }`}
        onClick={() => onTabChange('info')}
      >
        <Info className="h-4 w-4 mr-2" />
        Info
      </Button>
      <Button
        variant="ghost"
        className={`h-12 px-6 rounded-none font-medium transition-all duration-200 ${
          activeTab === 'adaptations'
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
        }`}
        onClick={() => onTabChange('adaptations')}
      >
        <Zap className="h-4 w-4 mr-2" />
        Adaptations
      </Button>
    </div>
  );
}
