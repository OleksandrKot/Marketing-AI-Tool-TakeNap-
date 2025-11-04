"use client"

import { useState } from "react"
import { Tag, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface TagFilterProps {
  availableTags: string[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  className?: string
}

export function TagFilter({ availableTags, selectedTags, onTagsChange, className }: TagFilterProps) {
  // Quick feature flag: hide tag filter UI while WIP
  const SHOW_TAGS = false

  const [isOpen, setIsOpen] = useState(false)

  if (!SHOW_TAGS) {
    // temporarily hide tag filter UI
    return null
  }

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const clearAllTags = () => {
    onTagsChange([])
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-3 shadow-sm ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1">
          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex items-center space-x-1 flex-wrap">
              {selectedTags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2 py-1 rounded-full border text-xs"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                  <button onClick={() => handleTagToggle(tag)} className="ml-1 text-blue-500 hover:text-blue-700">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedTags.length > 2 && (
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium px-2 py-1 rounded-full border text-xs">
                  +{selectedTags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Tag Dropdown */}
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-medium rounded-xl justify-between h-9 transition-all duration-200">
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    {selectedTags.length > 0 ? `${selectedTags.length} tags` : "Filter by tags"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
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
                      className={`hover:bg-blue-100 cursor-pointer rounded-lg ${
                        selectedTags.includes(tag) ? "bg-blue-100" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <Tag className="h-3 w-3 mr-2 text-slate-400" />
                          <span className="text-sm">{tag}</span>
                        </div>
                        {selectedTags.includes(tag) && (
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
                  ))
                ) : (
                  <div className="text-xs text-slate-400 px-2 py-1">No tags available</div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clear button */}
        {selectedTags.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearAllTags}
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium h-9 px-3 rounded-xl transition-all duration-200 ml-2"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
