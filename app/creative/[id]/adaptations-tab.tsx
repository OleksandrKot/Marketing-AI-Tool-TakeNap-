'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Zap,
  ExternalLink,
  Edit,
  Trash2,
  Share,
  User,
  Mic,
  Video,
  Palette,
  Copy,
  Check,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Ad, AdaptationScenario } from '@/lib/types';
import { parseScenarios, sanitizeScenarios } from './utils/adData';

// Динамічне завантаження модального вікна
const CreateAdaptationModal = dynamic(() => import('./create-adaptation-modal'), {
  loading: () => <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />,
});

interface AdaptationsTabProps {
  ad: Ad;
}

export function AdaptationsTab({ ad }: AdaptationsTabProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adData, setAdData] = useState<Ad>(ad);

  useEffect(() => {
    let mounted = true;
    const fetchLatest = async () => {
      try {
        console.debug('[AdaptationsTab] fetching latest ad', ad.id);
        const res = await fetch(`/api/ads/${encodeURIComponent(ad.id)}`);
        if (!res.ok) {
          console.debug('[AdaptationsTab] fetch failed', res.status);
          return;
        }
        const j = await res.json().catch(() => null);
        const fresh = j?.data || null;
        if (mounted && fresh) {
          console.debug('[AdaptationsTab] fetched latest ad', fresh);
          setAdData(fresh as Ad);
        }
      } catch (e) {
        console.debug('[AdaptationsTab] failed to fetch latest ad', e);
      }
    };

    if (ad?.id) fetchLatest();
    return () => {
      mounted = false;
    };
  }, [ad.id]);

  const scenarios: AdaptationScenario[] = useMemo(() => {
    const raw = parseScenarios(adData);
    const sanitized = sanitizeScenarios(raw);
    console.debug('[AdaptationsTab] scenarios', sanitized);
    return sanitized;
  }, [adData]);

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Ad Adaptations</h2>
          <p className="text-slate-600">
            Create and manage adaptations for this creative using your adaptation scenarios.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-white-400 hover:bg-white-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200"
        >
          <Zap className="h-4 w-4 mr-2" />
          Create Adaptation
        </Button>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 ? (
        <div className="space-y-6">
          {scenarios.map((scenario, index) => (
            <Card key={index} className="border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-xl font-semibold text-slate-900">
                        {scenario.persona_adapted_for}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Ad Script Title */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-500">Ad Script Title:</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(scenario.ad_script_title, `title-${index}`)
                        }
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === `title-${index}` ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{scenario.ad_script_title}</h3>
                  </div>

                  {/* Ad Script Full Text */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-500">Ad Text:</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(scenario.ad_script_full_text, `text-${index}`)
                        }
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === `text-${index}` ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{scenario.ad_script_full_text}</p>
                  </div>

                  {/* Call to Action */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Call to Action:</h4>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg h-10 px-6">
                      {scenario.technical_task_json.call_to_action}
                    </Button>
                  </div>

                  {/* Technical Task Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Visual Elements */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center mb-3">
                        <Video className="h-4 w-4 text-slate-600 mr-2" />
                        <h4 className="text-sm font-medium text-slate-700">Visual Elements</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopyToClipboard(
                              scenario.technical_task_json.visual_elements.join('\n'),
                              `visual-${index}`
                            )
                          }
                          className="text-slate-500 hover:text-slate-700 ml-auto"
                        >
                          {copiedField === `visual-${index}` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <ul className="space-y-2">
                        {scenario.technical_task_json.visual_elements.map(
                          (element: string, elemIndex: number) => (
                            <li key={elemIndex} className="text-sm text-slate-600 flex items-start">
                              <Palette className="h-3 w-3 text-slate-400 mr-2 mt-0.5 flex-shrink-0" />
                              {element}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    {/* Audio Style */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center mb-3">
                        <Mic className="h-4 w-4 text-slate-600 mr-2" />
                        <h4 className="text-sm font-medium text-slate-700">Audio Style</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopyToClipboard(
                              scenario.technical_task_json.audio_style,
                              `audio-${index}`
                            )
                          }
                          className="text-slate-500 hover:text-slate-700 ml-auto"
                        >
                          {copiedField === `audio-${index}` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-slate-600">
                        {scenario.technical_task_json.audio_style}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg h-10 px-4 bg-transparent"
                      >
                        <Share className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </div>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg h-10 px-4">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Ad Link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="border-slate-200 rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Adaptations Yet</h3>
            <p className="text-slate-500 mb-6">
              Create your first adaptation to see personalized versions of this creative.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl h-11 px-6"
            >
              <Zap className="h-4 w-4 mr-2" />
              Create First Adaptation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Adaptation Modal */}
      {showCreateModal && (
        <CreateAdaptationModal ad={adData} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
