'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Ad } from '@/lib/core/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Copy } from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/core/supabase';
type SupabaseSessionLike = { session?: { user?: Record<string, unknown> } };

interface PromptShape {
  persona?: string;
  size?: string;
  format?: string;
  appearance?: string;
  concept?: string;
  hook?: string;
  title?: string;
  caption?: string;
  text?: string;
  audio_script?: string;
  video_script?: string;
  [key: string]: unknown;
}

function prettyJson(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

export default function PromptEditor({ ad }: { ad: Ad }) {
  const initial: PromptShape = {
    persona: ad.character || '',
    size: '',
    format: ad.display_format || '',
    appearance: ad.image_description || '',
    concept: ad.concept || '',
    hook: ad.hook || '',
    title: ad.title || '',
    caption: ad.caption || '',
    text: ad.text || '',
    audio_script: ad.audio_script || '',
    video_script: ad.video_script || '',
  };

  const [fields, setFields] = useState<PromptShape>(initial);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showLogin, setShowLogin] = useState(false);
  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });

  // keep customPrompt in sync with generated prompt unless user edits it
  const generatedPrompt = useMemo(() => {
    const parts: string[] = [];
    if (fields.persona) parts.push(`Persona: ${fields.persona}`);
    if (fields.size) parts.push(`Size: ${fields.size}`);
    if (fields.format) parts.push(`Format: ${fields.format}`);
    if (fields.appearance) parts.push(`Appearance: ${fields.appearance}`);
    if (fields.concept) parts.push(`Concept: ${fields.concept}`);
    if (fields.hook) parts.push(`Hook: ${fields.hook}`);
    if (fields.title) parts.push(`Title: ${fields.title}`);
    if (fields.caption) parts.push(`Caption: ${fields.caption}`);
    if (fields.text) parts.push(`Text: ${fields.text}`);
    if (fields.audio_script) parts.push(`Audio script: ${fields.audio_script}`);
    if (fields.video_script) parts.push(`Video script: ${fields.video_script}`);
    return parts.join('\n\n');
  }, [fields]);

  useEffect(() => {
    // If the user hasn't typed a custom prompt yet, keep it in sync
    if (!customPrompt) setCustomPrompt(generatedPrompt);
  }, [generatedPrompt]);

  function updateField<K extends keyof PromptShape>(key: K, value: PromptShape[K]) {
    setFields((p) => ({ ...p, [key]: value }));
  }

  async function copyToClipboard(text: string) {
    try {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = (sessionData as unknown as SupabaseSessionLike).session?.user;
        if (!sessionUser) {
          setShowLogin(true);
          return;
        }
      } catch (e) {
        setShowLogin(true);
        return;
      }

      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }

  function handleJsonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    try {
      const parsed = JSON.parse(v);
      setFields((p) => ({ ...p, ...parsed }));
      setCustomPrompt('');
    } catch (err) {
      // ignore invalid json until user finishes
    }
  }

  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        <div className="bg-slate-50 p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Prompt (JSON)</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Редагуйте параметри промпта по полям або прямо JSON.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <Input
              value={fields.persona}
              onChange={(e) => updateField('persona', e.target.value)}
              placeholder="Persona (персонаж)"
            />
            <Input
              value={fields.size}
              onChange={(e) => updateField('size', e.target.value)}
              placeholder="Size (розмір креативу) — наприклад 1080x1080"
            />
            <Input
              value={fields.format}
              onChange={(e) => updateField('format', e.target.value)}
              placeholder="Format (формат) — Image / Video / Stories"
            />
            <Textarea
              value={fields.appearance}
              onChange={(e) => updateField('appearance', e.target.value)}
              placeholder="Appearance / Вигляд креативу"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Textarea
              value={fields.concept}
              onChange={(e) => updateField('concept', e.target.value)}
              placeholder="Concept"
            />
            <Textarea
              value={fields.hook}
              onChange={(e) => updateField('hook', e.target.value)}
              placeholder="Hook"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-600">JSON Preview</h3>
            <div className="relative">
              <Textarea
                className="font-mono text-sm"
                value={prettyJson(fields)}
                onChange={handleJsonChange}
                rows={8}
              />
              <div className="absolute right-3 top-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(prettyJson(fields))}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy JSON
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-600">Final Prompt (editable)</h3>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={6}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={() => setCustomPrompt(generatedPrompt)}>
                Revert to generated
              </Button>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(customPrompt)}>
                <Copy className="h-4 w-4 mr-2" /> Copy Prompt
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </Card>
  );
}
