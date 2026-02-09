'use client';

import React, { useState, useRef, useEffect } from 'react';
import ModalWrapper from '@/components/modals/ModalWrapper';
import StructuredAttributes, { type StructuredAttributesRef } from './StructuredAttributes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function StructuredAttributesModal({
  groupedSections,
  ad,
  onApply,
  isOpen,
  onClose,
}: {
  groupedSections: { title: string; text: string }[];
  ad?: Record<string, unknown>;
  onApply?: (obj: Record<string, unknown>) => void;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<string>('');
  const editorRef = useRef<StructuredAttributesRef>(null);
  const { showToast } = useToast();

  // If isOpen is provided externally, use it; otherwise use internal state
  const modalOpen = isOpen !== undefined ? isOpen : open;
  const setModalOpen = (val: boolean) => {
    if (isOpen === undefined) setOpen(val);
    if (!val && onClose) onClose();
  };

  // When opening the modal, if the provided `ad` contains a `shortPromptJson`,
  // initialize the Live JSON Preview with it (only if preview is empty).
  useEffect(() => {
    if (modalOpen && (!generated || generated.trim() === '') && ad) {
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
        setModalOpen(false);
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
      if (closeAfter) setModalOpen(false);
    } catch (e) {
      showToast({ message: 'Failed to copy JSON', type: 'error' });
    }
  };

  const resetToOriginal = () => {
    try {
      const sp = ad ? (ad as Record<string, unknown>)['shortPromptJson'] : null;
      if (editorRef.current && editorRef.current.resetToInitial) {
        if (sp && typeof sp === 'object') {
          setGenerated(JSON.stringify(sp as Record<string, unknown>, null, 2));
          editorRef.current.resetToInitial(sp as Record<string, unknown>);
        } else if (sp && typeof sp === 'string') {
          try {
            const parsed = JSON.parse(String(sp));
            setGenerated(JSON.stringify(parsed as Record<string, unknown>, null, 2));
            editorRef.current.resetToInitial(parsed as Record<string, unknown>);
          } catch {
            setGenerated('');
            editorRef.current.resetToInitial();
          }
        } else {
          setGenerated('');
          editorRef.current.resetToInitial();
        }
        showToast({ message: 'Reset to original prompt', type: 'success' });
      }
    } catch (e) {
      showToast({ message: 'Reset failed', type: 'error' });
    }
  };

  return (
    <>
      {!modalOpen && (
        <Button variant="outline" onClick={() => setModalOpen(true)} className="w-full">
          Edit Attributes
        </Button>
      )}
      {modalOpen && (
        <ModalWrapper
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
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
                <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
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
