import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export const GroupedSections = ({
  sections,
  onCopy,
  copiedField,
}: {
  sections: { title: string; text: string }[];
  onCopy?: (text: string, field: string) => void;
  copiedField?: string | null;
}) => {
  return (
    <div className="space-y-4">
      {sections.map((s, idx) => (
        <div key={idx} className="border-none shadow-none p-0 m-0">
          <div className="p-0 m-0 border-none shadow-none">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">{s.title}</h3>
              {onCopy && (
                <Button variant="ghost" size="sm" onClick={() => onCopy?.(s.text, s.title)}>
                  {copiedField === s.title ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            <div className="text-slate-700 whitespace-pre-line leading-relaxed max-h-52 overflow-auto break-words">
              {s.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupedSections;
