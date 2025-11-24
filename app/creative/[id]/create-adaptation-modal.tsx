'use client';

import { useState, useEffect } from 'react';
import { X, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Ad } from '@/lib/core/types';
import { supabase } from '@/lib/core/supabase';
import ModalWrapper from '@/components/modals/ModalWrapper';
import ConfirmModal from '@/components/modals/confirm-modal';

interface PersonaOption {
  id: string | number;
  name?: string;
  profile?: string;
  needs?: string;
}

interface CreateAdaptationModalProps {
  ad: Ad;
  onClose: () => void;
}

export default function CreateAdaptationModal({ ad, onClose }: CreateAdaptationModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState<string | undefined>(undefined);
  const [warnTitle, setWarnTitle] = useState<string | undefined>(undefined);

  const handleCreateAdaptation = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);

    // Тут буде логіка відправки до Make.com коли буде готовий ланцюг
    try {
      // Симулюємо API запит
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // If user selected a persona, prepend persona description to prompt
      let finalPrompt = prompt;
      if (selectedPersonaId) {
        const persona = personas.find(
          (p) => p.id === selectedPersonaId || p.id === Number(selectedPersonaId)
        );
        if (persona) {
          const personaPrefix = `Persona: ${persona.name}\nProfile: ${persona.profile}\nPrimary needs: ${persona.needs}\n`;
          finalPrompt = personaPrefix + '\n' + prompt;
        }
      }

      // Показуємо успішне повідомлення
      // For now we show the final prompt for user confirmation
      console.debug('[CreateAdaptation] finalPrompt', finalPrompt);
      setWarnTitle('Adaptation sent');
      setWarnMsg('Adaptation request sent! Final prompt:\n\n' + finalPrompt.substring(0, 800));
      setWarnOpen(true);
      onClose();
    } catch (error) {
      setWarnTitle('Adaptation failed');
      setWarnMsg('Error creating adaptation. Please try again.');
      setWarnOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.data?.user ?? null;
        if (user) {
          const { data, error } = await supabase
            .from('user_personas')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
          if (!error && data && mounted) {
            setPersonas(data as unknown as PersonaOption[]);
            return;
          }
        }
      } catch (e) {
        console.debug('[CreateAdaptation] failed to load personas', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModalWrapper isOpen={true} onClose={onClose} panelClassName="p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <Zap className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Create New Adaptation</h3>
              <p className="text-sm text-slate-500">
                Generate personalized scenarios for this creative
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Creative Info */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Creative:</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{ad.title}</p>
                  <p className="text-sm text-slate-500">{ad.page_name}</p>
                </div>
                <div className="text-xs text-slate-400">ID: {ad.ad_archive_id || ad.id}</div>
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <div className="flex items-center mb-3">
                <Sparkles className="h-4 w-4 text-orange-500 mr-2" />
                <h4 className="text-sm font-medium text-slate-700">Adaptation Prompt</h4>
              </div>

              {/* Persona selector */}
              <div className="mb-3">
                <label htmlFor="persona-select" className="block text-xs text-slate-500 mb-2">
                  Use persona
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPersonaId ?? ''}
                    id="persona-select"
                    onChange={(e) => setSelectedPersonaId(e.target.value || null)}
                    className="rounded-lg border border-slate-200 p-2 bg-white"
                  >
                    <option value="">— None (custom prompt) —</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open('/personas-settings', '_self')}
                  >
                    Manage Personas
                  </Button>
                </div>
              </div>

              <Textarea
                placeholder='Describe how you want to adapt this creative. For example: "Create versions for different age groups", "Adapt for fitness enthusiasts vs beginners", "Make versions for different emotional states"...'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] border-slate-200 rounded-xl text-sm resize-none focus:border-orange-500 focus:ring-orange-500"
                maxLength={500}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-slate-500">
                  Be specific about target audiences, emotions, or scenarios you want to explore
                </p>
                <span className="text-xs text-slate-400">{prompt.length}/500</span>
              </div>
            </div>

            {/* Example Prompts */}
            <div className="bg-blue-50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-blue-900 mb-2">💡 Example Prompts:</h5>
              <div className="space-y-2">
                <button
                  onClick={() =>
                    setPrompt(
                      'Create adaptations for different age groups: Gen Z (18-24), Millennials (25-40), and Gen X (41-56)'
                    )
                  }
                  className="block w-full text-left text-xs text-blue-700 hover:text-blue-900 bg-white rounded-lg p-2 hover:bg-blue-100 transition-colors"
                >
                  &quot;Create adaptations for different age groups: Gen Z (18-24), Millennials
                  (25-40), and Gen X (41-56)&quot;
                </button>
                <button
                  onClick={() =>
                    setPrompt(
                      'Adapt this creative for different emotional states: stressed/overwhelmed vs motivated/optimistic'
                    )
                  }
                  className="block w-full text-left text-xs text-blue-700 hover:text-blue-900 bg-white rounded-lg p-2 hover:bg-blue-100 transition-colors"
                >
                  &quot;Adapt this creative for different emotional states: stressed/overwhelmed vs
                  motivated/optimistic&quot;
                </button>
                <button
                  onClick={() =>
                    setPrompt(
                      'Create versions targeting different experience levels: complete beginners vs experienced users'
                    )
                  }
                  className="block w-full text-left text-xs text-blue-700 hover:text-blue-900 bg-white rounded-lg p-2 hover:bg-blue-100 transition-colors"
                >
                  &quot;Create versions targeting different experience levels: complete beginners vs
                  experienced users&quot;
                </button>
              </div>
            </div>
          </div>
        </CardContent>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 px-6 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateAdaptation}
            disabled={!prompt.trim() || isLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Create Adaptation
              </>
            )}
          </Button>
        </div>
      </Card>
      <ConfirmModal
        isOpen={warnOpen}
        title={warnTitle}
        message={warnMsg}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setWarnOpen(false)}
        onCancel={() => setWarnOpen(false)}
      />
    </ModalWrapper>
  );
}
