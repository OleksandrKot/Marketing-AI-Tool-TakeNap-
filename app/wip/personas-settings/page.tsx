'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PersonasSettingsWIP() {
  const router = useRouter();
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-3xl font-bold">Personas Settings — WIP</h1>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <p className="text-slate-700 mb-4">
          Personas settings are under construction. We&apos;ll add persona-driven targeting tools
          soon.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/')} variant="ghost">
            Go to Library
          </Button>
          <Button onClick={() => router.push('/profile')}>Go to Profile</Button>
        </div>
      </div>
    </div>
  );
}
