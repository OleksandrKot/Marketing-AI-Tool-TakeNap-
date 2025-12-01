'use client';

import React, { useState, useRef, useEffect } from 'react';
import ModalWrapper from '@/components/modals/ModalWrapper';
import StructuredAttributes from './StructuredAttributes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function StructuredAttributesModal({
  groupedSections,
  ad,
  onApply,
}: {
  groupedSections: { title: string; text: string }[];
  ad?: Record<string, unknown>;
  onApply?: (obj: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<string>('');
  const editorRef = useRef<{ applyJson?: (obj: Record<string, unknown>) => void } | null>(null);
  const { showToast } = useToast();

  // When opening the modal, if the provided `ad` contains a `shortPromptJson`,
  // initialize the Live JSON Preview with it (only if preview is empty).
  useEffect(() => {
    if (open && (!generated || generated.trim() === '') && ad) {
      try {
        const sp = (ad as Record<string, unknown>)['shortPromptJson'];
        if (sp && typeof sp === 'object') {
          setGenerated(JSON.stringify(sp as Record<string, unknown>, null, 2));
        } else if (sp && typeof sp === 'string') {
          // if stored as string, try to pretty-print
          try {
            const parsed = JSON.parse(String(sp));
            setGenerated(JSON.stringify(parsed as Record<string, unknown>, null, 2));
          } catch {
            setGenerated(String(sp));
          }
        }
      } catch (e) {
        // ignore failures
      }
    }
  }, [open, ad]);

  const tryApplyToParent = () => {
    if (!onApply) return;
    try {
      const parsed = JSON.parse(generated || '{}');
      if (parsed && typeof parsed === 'object') {
        onApply(parsed as Record<string, unknown>);
        setOpen(false);
        showToast({ message: 'Applied prompt to Visual Description', type: 'success' });
      }
    } catch (e) {
      showToast({ message: 'Failed to apply JSON: invalid JSON', type: 'error' });
    }
  };

  const copyJson = async (closeAfter = false) => {
    try {
      const payload = generated || '{}';
      await navigator.clipboard.writeText(payload);
      showToast({ message: 'Copied prompt JSON', type: 'success' });
      if (closeAfter) setOpen(false);
    } catch (e) {
      showToast({ message: 'Failed to copy JSON', type: 'error' });
    }
  };

  const resetToOriginal = () => {
    // reset generated preview and instruct editor to rebuild
    setGenerated('');
    if (editorRef.current && editorRef.current.applyJson) {
      try {
        const sp = ad ? (ad as Record<string, unknown>)['shortPromptJson'] : null;
        if (sp && typeof sp === 'object') {
          editorRef.current.applyJson(sp as Record<string, unknown>);
        } else if (sp && typeof sp === 'string') {
          try {
            const parsed = JSON.parse(String(sp));
            editorRef.current.applyJson(parsed);
          } catch {
            // no-op
          }
        } else {
          // fallback: ask editor to rebuild from sections by applying empty object
          editorRef.current.applyJson({});
        }
        showToast({ message: 'Reset to original prompt', type: 'success' });
      } catch {
        showToast({ message: 'Reset failed', type: 'error' });
      }
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
        Edit prompt
      </Button>
      {open && (
        <ModalWrapper
          isOpen={open}
          onClose={() => setOpen(false)}
          panelClassName="max-w-7xl w-[95vw]"
        >
          <div className="bg-white rounded-lg overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Attributes Editor</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => copyJson(false)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copyJson(true)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy and Close
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={tryApplyToParent}
                  disabled={!generated}
                >
                  Apply to Visual Description
                </Button>
                <Button variant="destructive" size="sm" onClick={resetToOriginal}>
                  Reset to Original
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="min-h-0 overflow-auto">
                <StructuredAttributes
                  ref={editorRef}
                  groupedSections={groupedSections}
                  onGeneratedChange={setGenerated}
                  ad={ad}
                  ignoreLocalStorage
                />
              </div>

              <div className="min-h-0 flex flex-col">
                <Card className="h-full flex-1">
                  <CardContent className="p-4 flex flex-col h-full min-h-0">
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
                      style={{ minHeight: 300 }}
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
