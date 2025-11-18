import { createServerSupabaseClient } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Metadata } from 'next';

interface PageProps {
  params: { token: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('shared_personas')
    .select('persona')
    .eq('token', params.token)
    .single();
  const persona = data?.persona || null;
  return {
    title: persona?.name ? `Persona: ${persona.name}` : 'Shared Persona',
    description: persona?.profile ? String(persona.profile).slice(0, 160) : 'Shared persona',
  };
}

export default async function SharedPersonaPage({ params }: PageProps) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('shared_personas')
    .select('persona')
    .eq('token', params.token)
    .single();
  if (error || !data) return <div className="p-8">Persona not found</div>;

  const rawPersona = (data && (data as Record<string, unknown>)['persona']) || null;
  const persona =
    rawPersona && typeof rawPersona === 'object' ? (rawPersona as Record<string, unknown>) : {};

  const personaName = typeof persona['name'] === 'string' ? (persona['name'] as string) : '';
  const personaProfile =
    typeof persona['profile'] === 'string' ? (persona['profile'] as string) : '';
  const personaNeeds = typeof persona['needs'] === 'string' ? (persona['needs'] as string) : '';
  const personaAgeRange =
    typeof persona['ageRange'] === 'string'
      ? (persona['ageRange'] as string)
      : typeof persona['age_range'] === 'string'
      ? (persona['age_range'] as string)
      : '';
  const personaIncome = typeof persona['income'] === 'string' ? (persona['income'] as string) : '';
  const personaStatus = typeof persona['status'] === 'string' ? (persona['status'] as string) : '';
  const personaGoals = Array.isArray(persona['goals']) ? (persona['goals'] as string[]) : [];

  const PageNavigation = dynamic(
    () => import('@/components/page-navigation').then((m) => m.PageNavigation),
    {
      ssr: false,
    }
  );
  const ProfileDropdown = dynamic(
    () => import('@/app/login-auth/components/profile-dropdown').then((m) => m.ProfileDropdown),
    {
      ssr: false,
    }
  );
  const CopyToProfileButton = dynamic(
    () => import('../CopyToProfileButton').then((m) => m.default),
    {
      ssr: false,
    }
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-4 max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-slate-900">
              TakeNap
            </Link>
            <div className="hidden md:block">
              <PageNavigation currentPage="library" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12 max-w-3xl">
        <div className="bg-white rounded-2xl border p-8">
          <h1 className="text-3xl font-bold mb-2">{personaName}</h1>
          <p className="text-sm text-slate-600 mb-4">
            Shared persona — copy into your profile to use
          </p>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm text-slate-700 font-medium">Profile</h3>
              <p className="text-sm text-slate-600 mt-2">{personaProfile}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm text-slate-700 font-medium">Primary Needs</h3>
              <p className="text-sm text-slate-600 mt-2">{personaNeeds}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Age</div>
                <div className="font-semibold text-slate-900">{personaAgeRange}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Income</div>
                <div className="font-semibold text-slate-900">{personaIncome}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Status</div>
                <div className="font-semibold text-slate-900">{personaStatus}</div>
              </div>
            </div>

            {personaGoals.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Goals</h3>
                <div className="flex flex-wrap gap-2">
                  {personaGoals.map((g: string, i: number) => (
                    <span
                      key={i}
                      className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <CopyToProfileButton token={params.token} />
        </div>
      </div>
    </div>
  );
}
