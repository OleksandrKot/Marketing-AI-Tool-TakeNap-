"use client"

import { useState } from "react"
import { X, ChevronDown, MapPin, Smartphone, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { FilterOptions } from "@/lib/types"

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void
  pages: string[]
  className?: string
}

export function FilterBar({ onFilterChange, pages, className }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    page: null,
    date: null,
  })

  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null)
  const [selectedAppStore, setSelectedAppStore] = useState<string | null>(null)
  const [selectedActiveDays, setSelectedActiveDays] = useState<string | null>(null)

  const handlePlacementFilter = (placement: string | null) => {
    setSelectedPlacement(placement)
    const newFilters = { ...filters, page: placement }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleAppStoreFilter = (store: string | null) => {
    setSelectedAppStore(store)
    const newFilters = { ...filters, date: store }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleActiveDaysFilter = (days: string | null) => {
    setSelectedActiveDays(days)
    // You can extend FilterOptions type to include activeDays if needed
    onFilterChange(filters)
  }

  const clearFilters = () => {
    const newFilters = { search: "", page: null, date: null }
    setFilters(newFilters)
    setSelectedPlacement(null)
    setSelectedAppStore(null)
    setSelectedActiveDays(null)
    onFilterChange(newFilters)
  }

  const placementOptions = [
    { label: "Facebook", value: "facebook" },
    { label: "Instagram", value: "instagram" },
    { label: "Messenger", value: "messenger" },
  ]

  const appStoreOptions = [
    { label: "App Store", value: "app_store" },
    { label: "Google Play", value: "google_play" },
  ]

  const activeDaysOptions = [
    { label: "1 day", value: "1_day" },
    { label: "Less than week", value: "less_week" },
    { label: "1-2 weeks", value: "1_2_weeks" },
    { label: "2-4 weeks", value: "2_4_weeks" },
    { label: "1-3 months", value: "1_3_months" },
    { label: "3+ months", value: "3_months_plus" },
  ]

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-3 shadow-sm ${className || ""}`}>
      <div className="flex justify-between items-center w-full">
        <div className="grid grid-cols-3 gap-2 flex-1">
          {/* Placements Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200 w-full">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    {selectedPlacement
                      ? placementOptions.find((p) => p.value === selectedPlacement)?.label
                      : "Placements"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
              <DropdownMenuItem
                onClick={() => handlePlacementFilter(null)}
                className={`hover:bg-blue-100 ${!selectedPlacement ? "bg-blue-100" : ""}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>All placements</span>
                  {!selectedPlacement && (
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
              {placementOptions.map((placement) => (
                <DropdownMenuItem
                  key={placement.value}
                  onClick={() => handlePlacementFilter(placement.value)}
                  className={`hover:bg-blue-100 ${selectedPlacement === placement.value ? "bg-blue-100" : ""}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{placement.label}</span>
                    {selectedPlacement === placement.value && (
                      <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* App Store Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200 w-full">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    {selectedAppStore ? appStoreOptions.find((s) => s.value === selectedAppStore)?.label : "App Store"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
              <DropdownMenuItem
                onClick={() => handleAppStoreFilter(null)}
                className={`hover:bg-blue-100 ${!selectedAppStore ? "bg-blue-100" : ""}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>All stores</span>
                  {!selectedAppStore && (
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
              {appStoreOptions.map((store) => (
                <DropdownMenuItem
                  key={store.value}
                  onClick={() => handleAppStoreFilter(store.value)}
                  className={`hover:bg-blue-100 ${selectedAppStore === store.value ? "bg-blue-100" : ""}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{store.label}</span>
                    {selectedAppStore === store.value && (
                      <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active Days Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200 w-full">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    {selectedActiveDays
                      ? activeDaysOptions.find((d) => d.value === selectedActiveDays)?.label
                      : "Active days"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
              <DropdownMenuItem
                onClick={() => handleActiveDaysFilter(null)}
                className={`hover:bg-blue-100 ${!selectedActiveDays ? "bg-blue-100" : ""}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>All periods</span>
                  {!selectedActiveDays && (
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
              {activeDaysOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleActiveDaysFilter(option.value)}
                  className={`hover:bg-blue-100 ${selectedActiveDays === option.value ? "bg-blue-100" : ""}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    {selectedActiveDays === option.value && (
                      <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clear button moved to the right */}
        <Button
          variant="ghost"
          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium h-9 px-3 rounded-xl transition-all duration-200 ml-2"
          onClick={clearFilters}
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  )
}
