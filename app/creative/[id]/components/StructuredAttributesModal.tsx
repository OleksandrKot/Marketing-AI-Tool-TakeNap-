'use client';

import React, { useState, useRef } from 'react';
import ModalWrapper from '@/components/modals/modalwrapper';
import StructuredAttributes from './StructuredAttributes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy } from 'lucide-react';

export default function StructuredAttributesModal({
  groupedSections,
  ad,
}: {
  groupedSections: { title: string; text: string }[];
  ad?: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<string>('');
  const editorRef = useRef<{ applyJson?: (obj: Record<string, unknown>) => void } | null>(null);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
        Open Attributes Editor
      </Button>
      {open && (
        <ModalWrapper
          isOpen={open}
          onClose={() => setOpen(false)}
          panelClassName="max-w-4xl w-full"
        >
          <div className="bg-white rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Attributes Editor</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(generated)}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <StructuredAttributes
                  ref={editorRef}
                  groupedSections={groupedSections}
                  onGeneratedChange={setGenerated}
                  ad={ad}
                />
              </div>

              <div>
                <Card className="h-full">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium mb-2">Live JSON Preview</h4>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(generated)}
                        >
                          <Copy className="h-4 w-4 mr-2" /> Copy JSON
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(generated || '{}');
                              if (editorRef.current?.applyJson) editorRef.current.applyJson(parsed);
                            } catch (e) {
                              // noop - parsing failed
                            }
                          }}
                        >
                          Apply to Editor
                        </Button>
                      </div>
                    </div>

                    <textarea
                      value={generated}
                      onChange={(e) => setGenerated(e.target.value)}
                      className="w-full min-h-0 h-full font-mono text-sm bg-slate-50 p-3 rounded overflow-auto resize-none"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}
    </>
  );
}
