'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  User,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  DollarSign,
  Users,
  Heart,
  Target,
  Share2,
  ArrowLeft,
  Home,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/core/supabase';
import log from '@/lib/core/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ProfileDropdown } from '@/app/login-auth/components/profile-dropdown';
import { PageNavigation } from '@/components/navigation/PageNavigation';
import ModalWrapper from '@/components/modals/ModalWrapper';
import ConfirmModal from '@/components/modals/confirm-modal';

interface Persona {
  id: number;
  name: string;
  needs: string;
  profile: string;
  ageRange: string;
  income: string;
  status: string;
  goals: string[];
}

const initialPersonas: Persona[] = [
  {
    id: 1,
    name: 'The Seeker of Connection',
    needs: 'Emotional support, companionship, and a sense of being valued.',
    profile:
      'A man, 18+, single or divorced, who feels lonely and seeks meaningful communication with an AI companion to feel needed and understood.',
    ageRange: '18+',
    income: 'Not specified',
    status: 'Single or divorced',
    goals: ['Emotional support', 'Companionship', 'Feel valued', 'Meaningful communication'],
  },
  {
    id: 2,
    name: 'The Social Strategist',
    needs: 'Self-improvement in social skills and casual, stimulating conversation.',
    profile:
      'A man, 18+, with an income of ~$4k/month, who wants to learn to flirt and practice engaging, casual dialogue with an AI to boost his confidence and satisfy social needs.',
    ageRange: '18+',
    income: '~$4k/month',
    status: 'Single',
    goals: ['Learn to flirt', 'Practice dialogue', 'Boost confidence', 'Social skills improvement'],
  },
];

// Helper to extract user object safely from Supabase client responses
function extractUser(res: unknown): { id: string } | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const data = r['data'];
  if (!data || typeof data !== 'object') return null;
  const user = (data as Record<string, unknown>)['user'];
  if (!user || typeof user !== 'object') return null;
  const id = (user as Record<string, unknown>)['id'];
  if (typeof id !== 'string') return null;
  return { id };
}

function formatError(err: unknown): string {
  try {
    if (!err) return 'Unknown error';
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error === 'string') return String(e.error);
    return JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
  } catch (e) {
    try {
      return String(err);
    } catch {
      return '[object Object]';
    }
  }
}

export default function PersonasSettingsPage() {
  const [showLogin, setShowLogin] = useState(false);
  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState<string | undefined>(undefined);
  const [warnTitle, setWarnTitle] = useState<string | undefined>(undefined);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [newPersona, setNewPersona] = useState<Omit<Persona, 'id'>>({
    name: '',
    needs: '',
    profile: '',
    ageRange: '',
    income: '',
    status: '',
    goals: [],
  });
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);
  // (import/export removed per request)

  const handleSharePersona = async (persona: Persona) => {
    try {
      // require auth to create share links
      try {
        const userRes = await supabase.auth.getUser();
        const user = extractUser(userRes);
        if (!user) {
          setShowLogin(true);
          return;
        }
      } catch (e) {
        setShowLogin(true);
        return;
      }
      // create share token via API
      const res = await fetch('/api/personas/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const j = await res.json();
      if (res.ok && j?.token) {
        const url = `${location.origin}/shared/persona/${j.token}`;
        await navigator.clipboard.writeText(url);
        setWarnTitle('Share link copied');
        setWarnMsg('Share link copied to clipboard:\n' + url);
        setWarnOpen(true);
      } else {
        log.error('Share failed', j);
        setWarnTitle('Share failed');
        setWarnMsg('Failed to create share link');
        setWarnOpen(true);
      }
    } catch (e) {
      log.error('Share failed', e);
      setWarnTitle('Share failed');
      setWarnMsg('Failed to create share link');
      setWarnOpen(true);
    }
  };

  const handleCopyToProfile = async (persona: Persona) => {
    try {
      const userRes = await supabase.auth.getUser();
      const user = extractUser(userRes);
      if (!user) {
        setShowLogin(true);
        return;
      }

      const id = Date.now().toString();
      const { data, error } = await supabase
        .from('user_personas')
        .insert([
          {
            id,
            user_id: user.id,
            name: persona.name,
            needs: persona.needs,
            profile: persona.profile,
            age_range: persona.ageRange,
            income: persona.income,
            status: persona.status,
            goals: persona.goals,
          },
        ])
        .select()
        .maybeSingle();
      if (error) throw error;
      setWarnTitle('Success');
      setWarnMsg('Persona copied to your profile');
      setWarnOpen(true);
      if (data && typeof data === 'object') {
        const row = data as Record<string, unknown>;
        const idVal = row['id'];
        const newId =
          typeof idVal === 'number' || typeof idVal === 'string' ? Number(idVal) : Date.now();
        setPersonas((p) => [...p, { ...persona, id: newId }]);
      } else {
        setPersonas((p) => [...p, { ...persona, id: Number(id) }]);
      }
    } catch (e) {
      log.error('Copy to profile failed', e);
      try {
        setSupabaseError(formatError(e));
      } catch {}
      setWarnTitle('Copy failed');
      setWarnMsg('Failed to copy persona to profile: ' + formatError(e));
      setWarnOpen(true);
    }
  };

  // Load personas from Supabase (per-user) or fall back to localStorage
  useEffect(() => {
    try {
      // detect if there's a navigation history or referrer from same origin
      const hist = typeof window !== 'undefined' ? window.history.length > 1 : false;
      const ref =
        typeof document !== 'undefined' && document.referrer
          ? document.referrer.includes(location.origin)
          : false;
      setHasHistory(hist || ref);
    } catch (e) {}

    let mounted = true;
    (async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const user = extractUser(userRes);
        if (user) {
          const { data, error } = await supabase
            .from('user_personas')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
          if (!error && data && mounted) {
            // map DB rows to Persona shape
            const mapped: Persona[] = (data as unknown[]).map((r) => {
              const row = (
                r && typeof r === 'object' ? (r as Record<string, unknown>) : {}
              ) as Record<string, unknown>;
              const idVal = row['id'];
              const id =
                typeof idVal === 'number' || typeof idVal === 'string' ? Number(idVal) : Date.now();
              return {
                id,
                name: typeof row['name'] === 'string' ? (row['name'] as string) : '',
                needs: typeof row['needs'] === 'string' ? (row['needs'] as string) : '',
                profile: typeof row['profile'] === 'string' ? (row['profile'] as string) : '',
                ageRange: typeof row['age_range'] === 'string' ? (row['age_range'] as string) : '',
                income: typeof row['income'] === 'string' ? (row['income'] as string) : '',
                status: typeof row['status'] === 'string' ? (row['status'] as string) : '',
                goals: Array.isArray(row['goals']) ? (row['goals'] as string[]) : [],
              };
            });
            setPersonas(mapped.length ? mapped : initialPersonas);
            return;
          }
        }
      } catch (e) {
        log.debug('[Personas] Supabase fetch failed', e);
        try {
          setSupabaseError(String(e));
        } catch {}
      }

      // fallback to localStorage
      try {
        const existing = JSON.parse(localStorage.getItem('local_personas') || '[]') as
          | Persona[]
          | [];
        if (mounted) setPersonas(existing.length ? existing : initialPersonas);
      } catch (e) {
        setPersonas(initialPersonas);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleBack = () => {
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    } catch (e) {
      router.push('/');
    }
  };

  const handleCreatePersona = () => {
    if (!newPersona.name.trim()) return;

    const persona: Persona = {
      id: Date.now(),
      ...newPersona,
      goals: newPersona.goals.filter((goal) => goal.trim() !== ''),
    };

    (async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const user = extractUser(userRes);
        if (!user) {
          setShowLogin(true);
          return;
        }

        const { data, error } = await supabase
          .from('user_personas')
          .insert([
            {
              id: persona.id.toString(),
              user_id: user.id,
              name: persona.name,
              needs: persona.needs,
              profile: persona.profile,
              age_range: persona.ageRange,
              income: persona.income,
              status: persona.status,
              goals: persona.goals,
            },
          ])
          .select()
          .maybeSingle();
        if (error) throw error;
        // append DB-returned row (if present) for instant UI
        if (data && typeof data === 'object') {
          const row = data as Record<string, unknown>;
          const idVal = row['id'];
          const newId =
            typeof idVal === 'number' || typeof idVal === 'string' ? Number(idVal) : persona.id;
          setPersonas((p) => [...p, { ...persona, id: newId }]);
        } else {
          setPersonas((p) => [...p, persona]);
        }
        setNewPersona({
          name: '',
          needs: '',
          profile: '',
          ageRange: '',
          income: '',
          status: '',
          goals: [],
        });
        setIsCreating(false);
        return;
      } catch (e) {
        log.debug('[Personas] supabase insert failed', e);
        try {
          setSupabaseError(formatError(e));
        } catch {}
      }

      // On failure, show error and do NOT fallback to localStorage when strict auth is required
      setWarnTitle('Create failed');
      setWarnMsg('Failed to create persona');
      setWarnOpen(true);
      setIsCreating(false);
    })();
  };

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona({ ...persona });
  };

  const handleSaveEdit = () => {
    if (!editingPersona) return;

    (async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const user = extractUser(userRes);
        if (!user) {
          setShowLogin(true);
          return;
        }

        const { error } = await supabase
          .from('user_personas')
          .update({
            name: editingPersona.name,
            needs: editingPersona.needs,
            profile: editingPersona.profile,
            age_range: editingPersona.ageRange,
            income: editingPersona.income,
            status: editingPersona.status,
            goals: editingPersona.goals,
          })
          .eq('id', editingPersona.id.toString())
          .eq('user_id', user.id);
        if (error) throw error;
        setPersonas((p) => p.map((x) => (x.id === editingPersona.id ? editingPersona : x)));
        setEditingPersona(null);
        return;
      } catch (e) {
        log.debug('[Personas] supabase update failed', e);
        try {
          setSupabaseError(String(e));
        } catch {}
      }

      setWarnTitle('Save failed');
      setWarnMsg('Failed to save persona changes');
      setWarnOpen(true);
      setEditingPersona(null);
    })();
  };

  const handleDeletePersona = (id: number) => {
    // Open confirm modal and remember target id
    setConfirmTargetId(id);
    setConfirmOpen(true);
  };

  const performDeletePersona = (id: number) => {
    (async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const user = extractUser(userRes);
        if (!user) {
          setShowLogin(true);
          setConfirmOpen(false);
          setConfirmTargetId(null);
          return;
        }

        const { error } = await supabase
          .from('user_personas')
          .delete()
          .eq('id', id.toString())
          .eq('user_id', user.id);
        if (error) throw error;
        setPersonas((p) => p.filter((x) => x.id !== id));
        setConfirmOpen(false);
        setConfirmTargetId(null);
        return;
      } catch (e) {
        log.debug('[Personas] supabase delete failed', e);
        try {
          setSupabaseError(String(e));
        } catch {}
      }

      setWarnTitle('Delete failed');
      setWarnMsg('Failed to delete persona');
      setWarnOpen(true);
      setConfirmOpen(false);
      setConfirmTargetId(null);
    })();
  };

  const handleAddGoal = (goal: string, isEditing = false) => {
    if (goal.trim()) {
      if (isEditing && editingPersona) {
        if (!editingPersona.goals.includes(goal.trim())) {
          setEditingPersona({
            ...editingPersona,
            goals: [...editingPersona.goals, goal.trim()],
          });
        }
      } else {
        if (!newPersona.goals.includes(goal.trim())) {
          setNewPersona({
            ...newPersona,
            goals: [...newPersona.goals, goal.trim()],
          });
        }
      }
    }
  };

  const handleRemoveGoal = (goalToRemove: string, isEditing = false) => {
    if (isEditing && editingPersona) {
      setEditingPersona({
        ...editingPersona,
        goals: editingPersona.goals.filter((goal) => goal !== goalToRemove),
      });
    } else {
      setNewPersona({
        ...newPersona,
        goals: newPersona.goals.filter((goal) => goal !== goalToRemove),
      });
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 py-12 max-w-7xl">
          {/* Hero section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">
                Personas Settings
              </h1>
              <p className="text-slate-600 font-medium text-lg">
                Manage your user personas for targeted creative adaptations
              </p>
              <div className="mt-4 text-sm text-slate-500">
                <nav aria-label="breadcrumb">
                  <ol className="flex items-center gap-2">
                    <li>
                      <button
                        onClick={() => router.push('/')}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Home
                      </button>
                    </li>
                    <li className="select-none">/</li>
                    <li className="text-slate-700">Settings</li>
                    <li className="select-none">/</li>
                    <li className="font-medium text-slate-900">Personas</li>
                  </ol>
                </nav>
              </div>
            </div>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <PageNavigation currentPage="personas" />
              <ProfileDropdown />
            </div>
          </div>
          {supabaseError && (
            <Card className="border-red-200 bg-red-50 rounded-2xl mb-6">
              <CardContent className="p-4 flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-red-700">Supabase Error</div>
                  <pre className="text-xs text-red-700 mt-2 whitespace-pre-wrap">
                    {supabaseError}
                  </pre>
                </div>
                <div className="pl-4">
                  <Button
                    variant="ghost"
                    onClick={() => setSupabaseError(null)}
                    className="text-red-700"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create New Persona Button */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Your Personas</h2>
            </div>
            <div className="flex items-center gap-3">
              {hasHistory && (
                <Button
                  onClick={handleBack}
                  variant="outline"
                  title="Go back to previous page (falls back to Home)"
                  aria-label="Go back"
                  className="flex items-center h-11 px-4 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              <Button
                onClick={() => router.push('/')}
                variant="outline"
                title="Go to Home"
                aria-label="Home"
                className="flex items-center h-11 px-4 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>

              <Button
                onClick={() => setIsCreating(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Persona
              </Button>
            </div>
          </div>

          {/* Create New Persona Form */}
          {isCreating && (
            <Card className="border-slate-200 rounded-2xl mb-8">
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-900">Create New Persona</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCreating(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="new-persona-name"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Persona Name *
                      </label>
                      <Input
                        id="new-persona-name"
                        placeholder="e.g., The Ambitious Professional"
                        value={newPersona.name}
                        onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-persona-ageRange"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Age Range
                      </label>
                      <Input
                        id="new-persona-ageRange"
                        placeholder="e.g., 25-35"
                        value={newPersona.ageRange}
                        onChange={(e) => setNewPersona({ ...newPersona, ageRange: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-persona-income"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Income Level
                      </label>
                      <Input
                        id="new-persona-income"
                        placeholder="e.g., $5k-8k/month"
                        value={newPersona.income}
                        onChange={(e) => setNewPersona({ ...newPersona, income: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-persona-status"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Relationship Status
                      </label>
                      <Input
                        id="new-persona-status"
                        placeholder="e.g., Single, Married, Divorced"
                        value={newPersona.status}
                        onChange={(e) => setNewPersona({ ...newPersona, status: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="new-persona-needs"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Primary Needs *
                      </label>
                      <Textarea
                        id="new-persona-needs"
                        placeholder="Describe what this persona needs and is looking for..."
                        value={newPersona.needs}
                        onChange={(e) => setNewPersona({ ...newPersona, needs: e.target.value })}
                        className="border-slate-200 rounded-lg min-h-[100px] resize-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-persona-profile"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Profile Description *
                      </label>
                      <Textarea
                        id="new-persona-profile"
                        placeholder="Detailed description of this persona's background, characteristics, and behavior..."
                        value={newPersona.profile}
                        onChange={(e) => setNewPersona({ ...newPersona, profile: e.target.value })}
                        className="border-slate-200 rounded-lg min-h-[120px] resize-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-persona-goal"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Goals & Motivations
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {newPersona.goals.map((goal, index) => (
                          <Badge
                            key={index}
                            className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-3 py-1 rounded-full border"
                          >
                            {goal}
                            <button
                              onClick={() => handleRemoveGoal(goal)}
                              className="ml-2 text-blue-500 hover:text-blue-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <Input
                        id="new-persona-goal"
                        placeholder="Add a goal and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddGoal(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreating(false)}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePersona}
                    disabled={
                      !newPersona.name.trim() ||
                      !newPersona.needs.trim() ||
                      !newPersona.profile.trim()
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create Persona
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* import/export removed */}

          {/* Edit Persona Modal */}
          {editingPersona && (
            <ModalWrapper
              isOpen={!!editingPersona}
              onClose={() => setEditingPersona(null)}
              panelClassName="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4"
            >
              <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <CardHeader className="border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-2xl font-semibold text-slate-900">Edit Persona</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingPersona(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor={`edit-persona-name-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Persona Name *
                        </label>
                        <Input
                          id={`edit-persona-name-${editingPersona.id}`}
                          placeholder="e.g., The Ambitious Professional"
                          value={editingPersona.name}
                          onChange={(e) =>
                            setEditingPersona({ ...editingPersona, name: e.target.value })
                          }
                          className="border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-persona-ageRange-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Age Range
                        </label>
                        <Input
                          id={`edit-persona-ageRange-${editingPersona.id}`}
                          placeholder="e.g., 25-35"
                          value={editingPersona.ageRange}
                          onChange={(e) =>
                            setEditingPersona({ ...editingPersona, ageRange: e.target.value })
                          }
                          className="border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-persona-income-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Income Level
                        </label>
                        <Input
                          id={`edit-persona-income-${editingPersona.id}`}
                          placeholder="e.g., $5k-8k/month"
                          value={editingPersona.income}
                          onChange={(e) =>
                            setEditingPersona({ ...editingPersona, income: e.target.value })
                          }
                          className="border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-persona-status-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Relationship Status
                        </label>
                        <Input
                          id={`edit-persona-status-${editingPersona.id}`}
                          placeholder="e.g., Single, Married, Divorced"
                          value={editingPersona.status}
                          onChange={(e) =>
                            setEditingPersona({ ...editingPersona, status: e.target.value })
                          }
                          className="border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor={`edit-persona-needs-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Primary Needs *
                        </label>
                        <Textarea
                          id={`edit-persona-needs-${editingPersona.id}`}
                          placeholder="Describe what this persona needs and is looking for..."
                          value={editingPersona.needs}
                          onChange={(e) =>
                            setEditingPersona({ ...editingPersona, needs: e.target.value })
                          }
                          className="border-slate-200 rounded-lg min-h-[100px] resize-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-persona-profile-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Profile Description *
                        </label>
                        <Textarea
                          id={`edit-persona-profile-${editingPersona.id}`}
                          placeholder="Detailed description of this persona's background, characteristics, and behavior..."
                          value={editingPersona.profile}
                          onChange={(e) =>
                            setEditingPersona({ ...editingPersona, profile: e.target.value })
                          }
                          className="border-slate-200 rounded-lg min-h-[120px] resize-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-persona-goal-${editingPersona.id}`}
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Goals & Motivations
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {editingPersona.goals.map((goal, index) => (
                            <Badge
                              key={index}
                              className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-3 py-1 rounded-full border"
                            >
                              {goal}
                              <button
                                onClick={() => handleRemoveGoal(goal, true)}
                                className="ml-2 text-blue-500 hover:text-blue-700"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <Input
                          id={`edit-persona-goal-${editingPersona.id}`}
                          placeholder="Add a goal and press Enter"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddGoal(e.currentTarget.value, true);
                              e.currentTarget.value = '';
                            }
                          }}
                          className="border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
                    <Button
                      variant="outline"
                      onClick={() => setEditingPersona(null)}
                      className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      disabled={
                        !editingPersona.name.trim() ||
                        !editingPersona.needs.trim() ||
                        !editingPersona.profile.trim()
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ModalWrapper>
          )}

          {/* Existing Personas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {personas.map((persona) => (
              <Card
                key={persona.id}
                className="border-slate-200 rounded-2xl hover:shadow-lg transition-all duration-300 p-0"
              >
                <CardHeader className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold text-slate-900">{persona.name}</h3>
                        <p className="text-sm text-slate-500">Persona ID: {persona.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSharePersona(persona)}
                        className="text-slate-500 hover:text-slate-700"
                        title="Copy persona JSON"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToProfile(persona)}
                        className="text-slate-500 hover:text-slate-700"
                        title="Copy persona to my profile"
                      >
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPersona(persona)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePersona(persona.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {/* Demographics */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center mb-2">
                          <Users className="h-4 w-4 text-slate-500 mr-2" />
                          <span className="text-xs font-medium text-slate-500">Age</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{persona.ageRange}</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center mb-2">
                          <DollarSign className="h-4 w-4 text-slate-500 mr-2" />
                          <span className="text-xs font-medium text-slate-500">Income</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{persona.income}</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center mb-2">
                          <Heart className="h-4 w-4 text-slate-500 mr-2" />
                          <span className="text-xs font-medium text-slate-500">Status</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{persona.status}</p>
                      </div>
                    </div>

                    {/* Needs */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                        <Target className="h-4 w-4 mr-2 text-blue-600" />
                        Primary Needs
                      </h4>
                      <p className="text-base text-slate-700 leading-relaxed bg-[#eef6ff] p-4 rounded-lg">
                        {persona.needs}
                      </p>
                    </div>

                    {/* Profile */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        Profile Description
                      </h4>
                      <p className="text-base text-slate-700 leading-relaxed bg-[#f8fafc] p-4 rounded-lg">
                        {persona.profile}
                      </p>
                    </div>

                    {/* Goals */}
                    {persona.goals.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                          Goals & Motivations
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {persona.goals.map((goal, index) => (
                            <Badge
                              key={index}
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium px-3.5 py-1.5 rounded-full border text-sm"
                            >
                              {goal}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {personas.length === 0 && !isCreating && (
            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Personas Yet</h3>
                <p className="text-slate-500 mb-6">
                  Create your first persona to start generating targeted creative adaptations.
                </p>
                <Button
                  onClick={() => setIsCreating(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Persona
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={warnOpen}
        title={warnTitle}
        message={warnMsg}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setWarnOpen(false)}
        onCancel={() => setWarnOpen(false)}
      />
      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete persona"
        message={'Are you sure you want to delete this persona?'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (confirmTargetId !== null) performDeletePersona(confirmTargetId);
        }}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTargetId(null);
        }}
      />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
