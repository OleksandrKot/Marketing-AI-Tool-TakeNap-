'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/core/supabase';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface ScriptRendererProps {
  script: string | null | undefined;
  copyPrefix?: string; // used for copiedField naming
}

export default function ScriptRenderer({ script, copyPrefix = 'script' }: ScriptRendererProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });

  if (!script) return null;

  const normalize = (s: string) =>
    s
      .replace(/^\s*```(?:[a-zA-Z0-9_-]+)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();
  const s = normalize(script);

  const handleCopy = async (text: string, id: string) => {
    try {
      // require authentication before allowing clipboard copy
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let accessToken: string | null = null;
        const sd = sessionData as unknown;
        if (sd && typeof sd === 'object') {
          const sdObj = sd as Record<string, unknown>;
          const sess = sdObj['session'];
          if (sess && typeof sess === 'object') {
            const at = (sess as Record<string, unknown>)['access_token'];
            if (typeof at === 'string') accessToken = at;
          }
        }
        if (!accessToken) {
          setShowLogin(true);
          return;
        }
      } catch (e) {
        setShowLogin(true);
        return;
      }

      await navigator.clipboard.writeText(text);
      setCopiedField(id);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };
  // Try parse JSON. If parsing fails, attempt to extract a JSON block from
  // the text (handles cases like "Here's analysis... ```json { ... } ```").
  const tryParse = (text: string): unknown | null => {
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  };

  let parsed: unknown = tryParse(s);
  if (!parsed) {
    // Attempt to extract the first balanced JSON object/array from the text
    const extractJSONBlock = (txt: string) => {
      const startIdx = txt.search(/[\[{]/);
      if (startIdx === -1) return null;
      const openChar = txt[startIdx];
      const closeChar = openChar === '{' ? '}' : ']';
      let depth = 0;
      for (let i = startIdx; i < txt.length; i++) {
        const ch = txt[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            return txt.slice(startIdx, i + 1);
          }
        }
      }
      return null;
    };

    const block = extractJSONBlock(s);
    if (block) {
      parsed = tryParse(block);
    }
  }

  if (parsed) {
    // recursive renderer for objects/arrays
    const renderNode = (node: unknown, path: string[] = []): JSX.Element | null => {
      if (node == null) return null;

      if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        return (
          <p className="text-slate-700 leading-relaxed whitespace-pre-line mt-2">{String(node)}</p>
        );
      }

      if (Array.isArray(node)) {
        return (
          <div>
            {node.map((item, idx) => (
              <div key={idx} className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500 font-medium">Item {idx + 1}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        typeof item === 'string' ? item : JSON.stringify(item, null, 2),
                        `${copyPrefix}-${[...path, String(idx)].join('-')}`
                      )
                    }
                    className="text-slate-500 hover:text-slate-700"
                  >
                    {copiedField === `${copyPrefix}-${[...path, String(idx)].join('-')}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="ml-2">{renderNode(item, [...path, String(idx)])}</div>
              </div>
            ))}
          </div>
        );
      }

      if (typeof node === 'object' && node !== null) {
        const rec = node as Record<string, unknown>;
        return (
          <div>
            {Object.entries(rec).map(([k, v]) => (
              <div key={k} className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500 font-medium">{k}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        typeof v === 'string' ? v : JSON.stringify(v, null, 2),
                        `${copyPrefix}-${[...path, k].join('-')}`
                      )
                    }
                    className="text-slate-500 hover:text-slate-700"
                  >
                    {copiedField === `${copyPrefix}-${[...path, k].join('-')}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="ml-2">{renderNode(v, [...path, k])}</div>
              </div>
            ))}
          </div>
        );
      }

      return <pre className="text-slate-700 whitespace-pre-wrap">{String(node)}</pre>;
    };

    if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) {
      return <div>{renderNode(parsed)}</div>;
    }
  }

  // Not JSON: split into paragraphs
  const paragraphs = s.split(/\n\s*\n/);
  if (paragraphs.length > 1) {
    return (
      <div>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-slate-700 leading-relaxed mb-3 whitespace-pre-line">
            {p.trim()}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div>
      {showLogin ? <LoginModal onClose={() => setShowLogin(false)} /> : null}
      {s.split(/\n/).map((line, idx) => (
        <p key={idx} className="text-slate-700 leading-relaxed mb-1 whitespace-pre-line">
          {line}
        </p>
      ))}
    </div>
  );
}
