'use client';

import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileDropdown } from '@/app/login-auth/components/profile-dropdown';
import { PageNavigation } from '@/components/page-navigation';

export default function AdaptationsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Hero section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">
              My Adaptations
            </h1>
            <p className="text-slate-600 font-medium text-lg">
              View and manage your creative adaptations
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <PageNavigation currentPage="adaptations" />
            <ProfileDropdown />
          </div>
        </div>

        {/* Empty State */}
        <Card className="border-slate-200 rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Adaptations Yet</h3>
            <p className="text-slate-500 mb-6">
              Create your first adaptation from the Creative Library to see it here.
            </p>
            <Button
              onClick={() => (window.location.href = '/')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              Go to Creative Library
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
