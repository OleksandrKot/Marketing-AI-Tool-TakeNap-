"use client"
import { Button } from "@/components/ui/button"
import { LayoutGrid, Layers, User, Heart } from "lucide-react"
import { useRouter } from "next/navigation"

interface PageNavigationProps {
  currentPage: "library" | "adaptations" | "personas" | "favorites"
}

export function PageNavigation({ currentPage }: PageNavigationProps) {
  const router = useRouter()

  const handleNavigation = (page: string) => {
    switch (page) {
      case "library":
        router.push("/")
        break
        case "favorites":
          router.push("/favorites")
          break
      case "adaptations":
        router.push("/adaptations")
        break
      case "personas":
        router.push("/personas-settings")
        break
    }
  }

  return (
    <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <Button
        variant="ghost"
        onClick={() => handleNavigation("library")}
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
        onClick={() => handleNavigation("adaptations")}
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
        onClick={() => handleNavigation("favorites")}
        className={`h-11 px-4 rounded-none font-medium transition-all duration-200 ${
          currentPage === "favorites"
            ? "bg-blue-100 text-blue-700 border-r border-slate-200 hover:bg-blue-500 hover:text-white"
            : "bg-white text-slate-600 hover:bg-slate-700 hover:text-white border-r border-slate-200"
        }`}
      >
        <Heart className="h-4 w-4 mr-2" />
        Favorites
      </Button>
      <Button
        variant="ghost"
        onClick={() => handleNavigation("personas")}
        className={`h-11 px-4 rounded-none font-medium transition-all duration-200 ${
          currentPage === "personas"
            ? "bg-blue-100 text-blue-700 hover:bg-blue-500 hover:text-white"
            : "bg-white text-slate-600 hover:bg-slate-700 hover:text-white"
        }`}
      >
        <User className="h-4 w-4 mr-2" />
        Personas Settings
      </Button>
    </div>
  )
}
