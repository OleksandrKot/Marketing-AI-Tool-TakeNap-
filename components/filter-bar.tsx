"use client"

import { useState } from "react"
import { X, ChevronDown, MapPin, Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { FilterOptions } from "@/lib/types"
import { useRouter } from "next/navigation"

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void
  pages: string[]
  className?: string
  availableTags?: string[]
  selectedTags?: string[]
  onTagsChange?: (tags: string[]) => void
}

export function FilterBar({
  onFilterChange,
  pages,
  className,
  availableTags = [],
  selectedTags = [],
  onTagsChange,
}: FilterBarProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    page: null,
    date: null,
    tags: null,
  })

  const router = useRouter()
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null)
  const [selectedActiveDays, setSelectedActiveDays] = useState<string | null>(null)
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false)

  const handlePlacementFilter = (placement: string | null) => {
    setSelectedPlacement(placement)
    const newFilters = { ...filters, page: placement }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleActiveDaysFilter = (days: string | null) => {
    setSelectedActiveDays(days)
    // You can extend FilterOptions type to include activeDays if needed
    onFilterChange(filters)
  }

  const handleTagToggle = (tag: string) => {
    if (!onTagsChange) return

    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const clearAllTags = () => {
    if (onTagsChange) {
      onTagsChange([])
    }
  }

  const clearFilters = () => {
    const newFilters = { search: "", page: null, date: null, tags: null }
    setFilters(newFilters)
    setSelectedPlacement(null)
    setSelectedActiveDays(null)
    if (onTagsChange) {
      onTagsChange([])
    }
    onFilterChange(newFilters)
  }

  const placementOptions = [
    { label: "Facebook", value: "facebook" },
    { label: "Instagram", value: "instagram" },
    { label: "Messenger", value: "messenger" },
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
      <div className="flex flex-col md:flex-row md:justify-between  md:items-center w-full space-y-2 md:space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
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

          {/* Filter by Tags */}
          <DropdownMenu open={isTagsDropdownOpen} onOpenChange={setIsTagsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200 w-full">
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    {selectedTags.length > 0 ? `${selectedTags.length} tags` : "Filter by tags"}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedTags.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        clearAllTags()
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg w-64">
              <div className="p-2">
                <div className="text-xs text-slate-500 font-medium mb-2 px-2">Available Tags:</div>
                {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={`hover:bg-purple-100 cursor-pointer rounded-lg ${
                        selectedTags.includes(tag) ? "bg-purple-100" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <Tag className="h-3 w-3 mr-2 text-slate-400" />
                          <span className="text-sm">{tag}</span>
                        </div>
                        {selectedTags.includes(tag) && (
                          <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
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
                  ))
                ) : (
                  <div className="text-xs text-slate-400 px-2 py-1">No tags available</div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clear button moved to the right */}
        <Button
          variant="ghost"
          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium h-9 px-3 rounded-xl transition-all duration-200 ml-0 md:ml-2"
          onClick={clearFilters}
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>

        {/* Advanced Filter Button */}
        <div className="flex justify-center">
               <Button
                 onClick={() => router.push("/advance-filter")}
                 className="bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md font-medium rounded-xl h-9 px-6 transition-all duration-200"
               >
                 Advanced Filter
               </Button>
             </div>
      </div>
    </div>
  )
}
