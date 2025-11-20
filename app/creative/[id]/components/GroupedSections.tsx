import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, RotateCw, Edit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import ModalWrapper from '@/components/modals/modalwrapper';

type Section = { title: string; text: string };

const SectionItem = ({
  section,
  onCopy,
  copiedField,
}: {
  section: Section;
  onCopy?: (text: string, field: string) => void;
  copiedField?: string | null;
}) => {
  const { title, text } = section;

  // Only allow local editing for Image / Visual Description
  const isEditable = title === 'Image / Visual Description' || title === 'Visual Description';
  const [edited, setEdited] = useState<string>(text || '');
  const [showModal, setShowModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // autosave edited content to localStorage (debounced)
  React.useEffect(() => {
    let t: number | null = null;
    try {
      setSaveStatus(null);
      t = window.setTimeout(() => {
        try {
          const key = `visdesc:${window.location.pathname}:${title}`;
          window.localStorage.setItem(key, edited);
          setSaveStatus('Saved locally');
          setTimeout(() => setSaveStatus(null), 1500);
        } catch (e) {
          console.debug('localStorage save failed', e);
        }
      }, 600);
    } catch (e) {
      /* ignore */
    }
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [edited, title]);

  // Validate JSON if content looks like JSON
  React.useEffect(() => {
    try {
      setJsonError(null);
      const s = edited?.trim();
      if (s && (s.startsWith('{') || s.startsWith('['))) {
        try {
          JSON.parse(s);
          setJsonError(null);
        } catch (err: unknown) {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: unknown }).message ?? 'Invalid JSON')
              : 'Invalid JSON';
          setJsonError(msg);
        }
      } else {
        setJsonError(null);
      }
    } catch (e) {
      setJsonError(null);
    }
  }, [edited]);

  const handleCopy = async () => {
    if (!onCopy) return true;
    // if JSON and invalid, prevent copy
    if (jsonError) return false;
    try {
      const res = onCopy(isEditable ? edited : text, title);
      if (res && typeof (res as Promise<unknown>).then === 'function') {
        // onCopy returned a promise — await it safely
        const awaited = await Promise.resolve(res as unknown);
        return awaited === undefined ? true : Boolean(awaited);
      }
      return true;
    } catch (e) {
      console.debug('onCopy threw', e);
      return false;
    }
  };

  const openEditor = () => setShowModal(true);
  const closeEditor = () => setShowModal(false);

  return (
    <div className="border-none shadow-none p-0 m-0">
      <div className="p-0 m-0 border-none shadow-none">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">{title}</h3>
          {onCopy && (
            <div className="flex items-center gap-2">
              {isEditable && (
                <Button variant="ghost" size="sm" onClick={openEditor} title="Edit">
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await handleCopy();
                }}
              >
                {copiedField === title ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="text-slate-700 whitespace-pre-line leading-relaxed max-h-52 overflow-auto break-words">
          {text && text.length > 400 ? (
            <>
              <div className="text-sm text-slate-600 mb-2">{text.slice(0, 300)}...</div>
              <div>
                <Button variant="link" size="sm" onClick={openEditor} className="text-blue-600">
                  Open editor
                </Button>
              </div>
            </>
          ) : (
            text
          )}
        </div>

        {isEditable && showModal && (
          <ModalWrapper isOpen={showModal} onClose={closeEditor} panelClassName="max-w-6xl w-full">
            <div className="bg-white rounded-lg overflow-hidden max-h-[90vh]">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit {title}</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEdited(text)} title="Reset">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const ok = await handleCopy();
                      if (ok) {
                        // keep modal open
                      }
                    }}
                    title="Copy edited"
                    disabled={!!jsonError}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const ok = await handleCopy();
                      if (ok) closeEditor();
                    }}
                    title="Copy & Close"
                    disabled={!!jsonError}
                  >
                    Copy & Close
                  </Button>
                  <Button variant="outline" size="sm" onClick={closeEditor}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="p-4 overflow-auto">
                <div>
                  <Textarea
                    value={edited}
                    onChange={(e) => setEdited(e.target.value)}
                    className={`min-h-[400px] ${jsonError ? 'border-red-500' : ''}`}
                  />
                  {jsonError && (
                    <div className="text-xs text-red-600 mt-2">JSON error: {jsonError}</div>
                  )}
                  {saveStatus && <div className="text-xs text-slate-500 mt-2">{saveStatus}</div>}
                </div>
              </div>
            </div>
          </ModalWrapper>
        )}
      </div>
    </div>
  );
};

export const GroupedSections = ({
  sections,
  onCopy,
  copiedField,
}: {
  sections: Section[];
  onCopy?: (text: string, field: string) => Promise<boolean> | boolean | void;
  copiedField?: string | null;
}) => {
  return (
    <div className="space-y-4">
      {sections.map((s, idx) => (
        <SectionItem key={idx} section={s} onCopy={onCopy} copiedField={copiedField} />
      ))}
    </div>
  );
};

export default GroupedSections;
