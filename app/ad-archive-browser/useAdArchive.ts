"use client"

import { useEffect, useRef, useState } from "react"
import type { Ad, FilterOptions, ViewMode } from "@/lib/types"
import { getAds } from "../actions"
import * as utils from "./utils"

export function useAdArchive(initialAds: Ad[], pages: string[]) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12
  const [productFilter, setProductFilter] = useState<string>("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showAINewsModal, setShowAINewsModal] = useState(false)
  const [processingMessage, setProcessingMessage] = useState("")
  const [selectedCreativeType, setSelectedCreativeType] = useState<"all" | "video" | "image">("all")

  // uniqueTags may fail under certain bundler interop cases; fall back to local implementation
  let availableTags: string[] = []
  try {
    if (typeof (utils as any).uniqueTags === "function") {
      availableTags = (utils as any).uniqueTags(ads)
    } else {
      // fallback: extract tags from ads
      const set = new Set<string>()
      for (const a of ads) {
        if (Array.isArray(a.tags)) for (const t of a.tags) if (t) set.add(t)
      }
      availableTags = Array.from(set).sort()
    }
  } catch (e) {
    console.error("Failed to compute availableTags from utils.uniqueTags, falling back", e)
    const set = new Set<string>()
    for (const a of ads) {
      if (Array.isArray(a.tags)) for (const t of a.tags) if (t) set.add(t)
    }
    availableTags = Array.from(set).sort()
  }

  const filteredAdsByType = ads.filter((ad) => {
    if (selectedCreativeType === "all") return true
    if (selectedCreativeType === "video") return ad.display_format === "VIDEO"
    if (selectedCreativeType === "image") return ad.display_format === "IMAGE"
    return true
  })

  const groupedAll = (() => {
    const map = new Map<string, Ad[]>()
    for (const ad of filteredAdsByType) {
    const key = utils.getGroupingKey(ad)
      const arr = map.get(key)
      if (arr) arr.push(ad)
      else map.set(key, [ad])
    }
    return map
  })()

  const adIdToGroupMap: Record<string, Ad[]> = {}
  groupedAll.forEach((groupAds) => {
    for (const ad of groupAds) adIdToGroupMap[ad.id] = groupAds
  })

  const ungroupedPages = utils.chunk(filteredAdsByType, itemsPerPage)
  const totalPages = Math.max(1, ungroupedPages.length)

  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const currentPageAds = ungroupedPages[currentPage - 1] || []
  const currentPageAdsCount = currentPageAds.length
  const visibleAdsCount = ungroupedPages.slice(0, currentPage).reduce((sum, pg) => sum + pg.length, 0)
  const totalAds = filteredAdsByType.length

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleFilterChange = async (filters: FilterOptions) => {
    setIsLoading(true)
    try {
      const filtered = await getAds(filters.search, filters.page, filters.date, filters.tags)
      setAds(filtered)
      setCurrentPage(1)
    } catch (error) {
      console.error("Error filtering ads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagsChange = async (tags: string[]) => {
    setSelectedTags(tags)
    setIsLoading(true)
    try {
      const filtered = await getAds(productFilter || "", null, null, tags)
      setAds(filtered)
      setCurrentPage(1)
    } catch (error) {
      console.error("Error filtering by tags:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    const searchValue = productFilter.trim()

    if (!searchValue && selectedTags.length === 0) {
      try {
        const allAds = await getAds(undefined, null, null, undefined)
        setAds(allAds)
        setCurrentPage(1)
      } catch (error) {
        console.error("Error resetting ads:", error)
      }
      return
    }

    const isMetaLink = searchValue.includes("facebook.com/ads/library")

    if (isMetaLink) {
      const typeMessages = {
        all: `Analyzing link and extracting all creatives (video & static)...`,
        video: `Analyzing link and extracting VIDEO creatives only...`,
        image: `Analyzing link and extracting STATIC creatives only...`,
      }
      setProcessingMessage(typeMessages[selectedCreativeType])
      setShowAINewsModal(true)
      setIsLoading(true)

      try {
        const response = await fetch("/api/parse-meta-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metaLink: searchValue, creativeType: selectedCreativeType }),
        })
        const result = await response.json()

        if (result.success) {
          const successMessages = {
            all: `Successfully processed link! New ads (video & static) will appear shortly.`,
            video: `Successfully processed link! New video ads will appear shortly.`,
            image: `Successfully processed link! New static ads will appear shortly.`,
          }
          setProcessingMessage(successMessages[selectedCreativeType])
          setTimeout(() => {
            setShowAINewsModal(false)
            window.location.reload()
          }, 3000)
        } else {
          setShowAINewsModal(false)
          alert(`Error processing link:\n\n${result.message || result.error}`)
        }
      } catch (error: unknown) {
        setShowAINewsModal(false)
        const message = error instanceof Error ? error.message : "Unknown error"
        alert("Error: " + message)
      } finally {
        setIsLoading(false)
      }
    } else {
      setIsLoading(true)
      try {
        const filtered = await getAds(
          searchValue || undefined,
          null,
          null,
          selectedTags.length ? selectedTags : undefined,
        )
        setAds(filtered)
        setCurrentPage(1)
      } catch (error) {
        console.error("Error filtering ads:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const videoAds = filteredAdsByType.filter((ad) => ad.display_format === "VIDEO").length

  const searchTimeout = useRef<number | null>(null)

  const handleProductFilterChange = (value: string) => {
    setProductFilter(value)

    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current)
      searchTimeout.current = null
    }

    const id = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const filtered = await getAds(
          value || undefined,
          null,
          null,
          selectedTags.length > 0 ? selectedTags : undefined,
        )
        setAds(filtered)
        setCurrentPage(1)
      } catch (error) {
        console.error("Error filtering ads:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    searchTimeout.current = id
  }

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current)
      }
    }
  }, [])

  const clearProductFilter = async () => {
    setProductFilter("")
    setIsLoading(true)
    try {
      const allAds = await getAds("", null, null, selectedTags)
      setAds(allAds)
      setCurrentPage(1)
    } catch (error) {
      console.error("Error loading ads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    ads,
    setAds,
    viewMode,
    setViewMode,
    isLoading,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    productFilter,
    setProductFilter,
    selectedTags,
    setSelectedTags,
    showAINewsModal,
    setShowAINewsModal,
    processingMessage,
    setProcessingMessage,
    selectedCreativeType,
    setSelectedCreativeType,
    availableTags,
    filteredAdsByType,
    adIdToGroupMap,
    ungroupedPages,
    totalPages,
    currentPageAds,
    currentPageAdsCount,
    visibleAdsCount,
    totalAds,
    handlePageChange,
    handleFilterChange,
    handleTagsChange,
    handleSearch,
    handleProductFilterChange,
    clearProductFilter,
    videoAds,
  }
}

export type UseAdArchiveReturn = ReturnType<typeof useAdArchive>
