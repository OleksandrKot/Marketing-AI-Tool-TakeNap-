"use client"
import { Video, ImageIcon, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface CreativeTypeSelectorProps {
  selectedType: "all" | "video" | "image"
  onTypeChange: (type: "all" | "video" | "image") => void
  className?: string
}

export function CreativeTypeSelector({ selectedType, onTypeChange, className }: CreativeTypeSelectorProps) {
  return (
    <Card
      className={`border-slate-200 rounded-2xl hover:shadow-md transition-all duration-300 hover:border-slate-300 ${className || ""}`}
    >
      <CardContent className="p-6 flex items-center space-x-4">
        <div className="p-3 bg-purple-50 rounded-xl">
          <LayoutGrid className="h-6 w-6 text-purple-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-2">
            Creative Type <span className="text-orange-500">*</span>
          </p>
          <p className="text-xs text-slate-400 mb-2">Select type before searching Meta Ad Library</p>
          <div className="flex bg-slate-100 rounded-xl p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 rounded-lg font-medium transition-all duration-200 ${
                selectedType === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
              onClick={() => onTypeChange("all")}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              All Types
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 rounded-lg font-medium transition-all duration-200 ${
                selectedType === "video"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
              onClick={() => onTypeChange("video")}
            >
              <Video className="h-4 w-4 mr-2" />
              Video Only
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 rounded-lg font-medium transition-all duration-200 ${
                selectedType === "image"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
              onClick={() => onTypeChange("image")}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Static Only
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
