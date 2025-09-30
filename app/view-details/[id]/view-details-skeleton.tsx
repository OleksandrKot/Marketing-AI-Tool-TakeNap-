import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export function ViewDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header skeleton */}
        <div className="flex items-center mb-8">
          <Button variant="ghost" className="mr-4 text-slate-600" disabled>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Library
          </Button>
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column skeleton */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="aspect-video bg-slate-200 animate-pulse"></div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <div className="h-11 w-32 bg-slate-200 rounded-xl animate-pulse"></div>
              <div className="h-11 w-32 bg-slate-200 rounded-xl animate-pulse"></div>
            </div>

            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="bg-slate-100 p-6 border-b border-slate-200">
                  <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="p-6">
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column skeleton */}
          <div className="space-y-6">
            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="bg-slate-100 p-6 border-b border-slate-200">
                  <div className="h-6 w-40 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="p-6 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4">
                      <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-2"></div>
                      <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
