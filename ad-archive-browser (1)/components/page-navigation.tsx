"use client"
import { Button } from "@/components/ui/button"
import { LayoutGrid, Layers, FileText } from "lucide-react"

interface PageNavigationProps {
  currentPage: "library" | "adaptations" | "specifications"
}

export function PageNavigation({ currentPage }: PageNavigationProps) {
  return (
    <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <Button
        variant="ghost"
        className={`h-11 px-4 rounded-none font-medium transition-all duration-200 ${
          currentPage === "library"
            ? "bg-blue-100 text-blue-700 border-r border-slate-200 hover:bg-blue-500 hover:text-white"
            : "bg-white text-slate-600 hover:bg-slate-700 hover:text-white border-r border-slate-200"
        }`}
      >
        <LayoutGrid className="h-4 w-4 mr-2" />
        Creative Library
      </Button>
      <Button
        variant="ghost"
        className={`h-11 px-4 rounded-none font-medium transition-all duration-200 ${
          currentPage === "adaptations"
            ? "bg-blue-100 text-blue-700 border-r border-slate-200 hover:bg-blue-500 hover:text-white"
            : "bg-white text-slate-600 hover:bg-slate-700 hover:text-white border-r border-slate-200"
        }`}
      >
        <Layers className="h-4 w-4 mr-2" />
        My Adaptations
      </Button>
      <Button
        variant="ghost"
        className={`h-11 px-4 rounded-none font-medium transition-all duration-200 ${
          currentPage === "specifications"
            ? "bg-blue-100 text-blue-700 hover:bg-blue-500 hover:text-white"
            : "bg-white text-slate-600 hover:bg-slate-700 hover:text-white"
        }`}
      >
        <FileText className="h-4 w-4 mr-2" />
        Product Specification
      </Button>
    </div>
  )
}
