import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function AdDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="mr-2 text-slate-600 h-11" disabled>
              <ArrowLeft className="h-5 w-5 mr-2" />
              Return Back
            </Button>
            <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
          </div>
          <div className="h-11 w-48 bg-slate-200 rounded-lg animate-pulse"></div>
        </div>

        {/* Tab Navigation skeleton */}
        <div className="flex gap-4 mb-8">
          <div className="h-10 w-24 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-10 w-24 bg-slate-200 rounded animate-pulse"></div>
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Creative preview skeleton */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="aspect-video bg-slate-200 animate-pulse"></div>
              </CardContent>
            </Card>

            {/* Controls skeleton */}
            <div className="flex gap-3">
              <div className="h-11 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
              <div className="h-11 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
            </div>

            {/* Ad text content skeleton */}
            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-6">
                <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-4/5 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column skeleton */}
          <div>
            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-6">
                <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
