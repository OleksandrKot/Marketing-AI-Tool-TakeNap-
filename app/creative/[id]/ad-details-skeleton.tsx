import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function AdDetailsSkeleton() {
  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl">
      {/* Header with back button */}
      <div className="flex items-center mb-8">
        <Button variant="ghost" className="mr-4 text-slate-600" disabled>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Library
        </Button>
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Creative preview skeleton */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-slate-200 rounded-2xl mb-6">
            <CardContent className="p-0">
              <div className="aspect-video bg-slate-200 animate-pulse"></div>
            </CardContent>
          </Card>

          {/* Ad text content skeleton */}
          <Card className="border-slate-200 rounded-2xl mb-6">
            <CardContent className="p-6">
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-4"></div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-20 w-full bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column skeleton */}
        <div>
          <Card className="border-slate-200 rounded-2xl mb-6">
            <CardContent className="p-6">
              <div className="h-6 w-40 bg-slate-200 rounded animate-pulse mb-4"></div>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
