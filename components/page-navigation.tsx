"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LayoutGrid, Layers, User, Heart, Menu, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface PageNavigationProps {
  currentPage: "library" | "adaptations" | "personas" | "favorites" | "folders"
}

export function PageNavigation({ currentPage }: PageNavigationProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Use pointerdown in capture phase to robustly detect outside interactions
    const onDoc = (e: PointerEvent) => {
      if (!containerRef.current) return
      const target = e.target as Node | null
      if (target && !containerRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDoc, true)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDoc, true)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const handleNavigation = (page: string) => {
    switch (page) {
      case "library":
        router.push("/")
        break
        case "favorites":
          router.push("/favorites")
          break
      case "folders":
        router.push("/folders")
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
    <div className="relative" ref={containerRef}>
      {/* mobile / tablet burger */}
      <div className="flex items-center md:hidden">
        <button
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((s) => !s)
          }}
          className="p-2 rounded-md bg-white border border-slate-200 shadow-sm mr-2"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* dropdown for small/medium screens (animated) */}
      <div
        id="mobile-nav"
        role="menu"
        aria-hidden={!open}
        className={`md:hidden absolute left-2 top-12 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 transform transition-all duration-150 origin-top ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
      >
        <div className="flex flex-col p-2 space-y-1">
          <Button variant="ghost" role="menuitem" onClick={() => { setOpen(false); handleNavigation("library") }} className={`justify-start`}>
            <LayoutGrid className="h-4 w-4 mr-2" /> Creative Library
          </Button>
          <Button variant="ghost" role="menuitem" onClick={() => { setOpen(false); handleNavigation("folders") }} className={`justify-start`}>
            <Layers className="h-4 w-4 mr-2" /> My Folders
          </Button>
          <Button variant="ghost" role="menuitem" onClick={() => { setOpen(false); handleNavigation("favorites") }} className={`justify-start`}>
            <Heart className="h-4 w-4 mr-2" /> Favorites
          </Button>
          {/* removed Personas Settings from mobile nav (WIP elsewhere) */}
        </div>
      </div>

      <div className="hidden md:flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
        onClick={() => handleNavigation("folders")}
        className={`h-11 px-4 rounded-none font-medium transition-all duration-200 ${
          currentPage === "folders"
            ? "bg-blue-100 text-blue-700 border-r border-slate-200 hover:bg-blue-500 hover:text-white"
            : "bg-white text-slate-600 hover:bg-slate-700 hover:text-white border-r border-slate-200"
        }`}
      >
        <Layers className="h-4 w-4 mr-2" />
        My Folders
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
      {/* Personas Settings removed from main navigation (WIP) */}
      </div>
    </div>
  )
}
