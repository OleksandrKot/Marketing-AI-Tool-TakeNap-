"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProductFilterIndicatorProps {
  productName: string
  onClear: () => void
}

export function ProductFilterIndicator({ productName, onClear }: ProductFilterIndicatorProps) {
  return (
    <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-4">
      <span className="text-sm text-blue-700">
        Showing results for: <span className="font-semibold">"{productName}"</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 h-6 w-6 p-0 rounded-full"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
