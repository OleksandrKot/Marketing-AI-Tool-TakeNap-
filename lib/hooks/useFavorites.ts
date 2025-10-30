"use client"

import { useCallback, useEffect, useState } from "react"

type FavoriteItem = {
  creativeId: string
  createdAt: string
  note?: string
}

type Collection = {
  id: string
  name: string
  itemIds: string[]
  createdAt: string
  updatedAt?: string
}

type FavoritesStore = {
  version: number
  favorites: FavoriteItem[]
  collections: Collection[]
}

const STORAGE_KEY = "tn_favorites_v1"

function defaultStore(): FavoritesStore {
  return { version: 1, favorites: [], collections: [] }
}

function loadFromStorage(): FavoritesStore {
  if (typeof window === "undefined") return defaultStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStore()
    return JSON.parse(raw) as FavoritesStore
  } catch (e) {
    console.error("Failed to load favorites from storage", e)
    return defaultStore()
  }
}

function saveToStorage(state: FavoritesStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error("Failed to save favorites to storage", e)
  }
}

export function useFavorites() {
  const [store, setStore] = useState<FavoritesStore>(() => loadFromStorage())

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setStore(loadFromStorage())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    saveToStorage(store)
  }, [store])

  const isFavorite = useCallback(
    (creativeId: string) => store.favorites.some((f) => f.creativeId === creativeId),
    [store.favorites],
  )

  const addFavorite = useCallback((creativeId: string, note?: string) => {
    setStore((prev) => {
      if (prev.favorites.some((f) => f.creativeId === creativeId)) return prev
      const fav: FavoriteItem = { creativeId, createdAt: new Date().toISOString(), note }
      const next = { ...prev, favorites: [...prev.favorites, fav] }
      saveToStorage(next)
      return next
    })
  }, [])

  const removeFavorite = useCallback((creativeId: string) => {
    setStore((prev) => {
      const next = { ...prev, favorites: prev.favorites.filter((f) => f.creativeId !== creativeId) }
      saveToStorage(next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback(
    (creativeId: string) => {
      if (isFavorite(creativeId)) removeFavorite(creativeId)
      else addFavorite(creativeId)
    },
    [isFavorite, addFavorite, removeFavorite],
  )

  // Collections (basic)
  const createCollection = useCallback((name: string) => {
    const id = typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`
    setStore((prev) => {
      const col: Collection = { id, name, itemIds: [], createdAt: new Date().toISOString() }
      const next = { ...prev, collections: [...prev.collections, col] }
      saveToStorage(next)
      return next
    })
  }, [])

  const deleteCollection = useCallback((collectionId: string) => {
    setStore((prev) => {
      const next = { ...prev, collections: prev.collections.filter((c) => c.id !== collectionId) }
      saveToStorage(next)
      return next
    })
  }, [])

  const addToCollection = useCallback((collectionId: string, creativeId: string) => {
    setStore((prev) => {
      const next = {
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId ? { ...c, itemIds: Array.from(new Set([...c.itemIds, creativeId])), updatedAt: new Date().toISOString() } : c,
        ),
      }
      saveToStorage(next)
      return next
    })
  }, [])

  const removeFromCollection = useCallback((collectionId: string, creativeId: string) => {
    setStore((prev) => {
      const next = {
        ...prev,
        collections: prev.collections.map((c) => (c.id === collectionId ? { ...c, itemIds: c.itemIds.filter((i) => i !== creativeId), updatedAt: new Date().toISOString() } : c)),
      }
      saveToStorage(next)
      return next
    })
  }, [])

  const exportJSON = useCallback(() => JSON.stringify(store, null, 2), [store])

  const importJSON = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as FavoritesStore
      if (!parsed || !Array.isArray(parsed.favorites) || !Array.isArray(parsed.collections)) throw new Error("Invalid format")
      const next = { ...parsed, version: parsed.version || 1 }
      setStore(next)
      saveToStorage(next)
      return true
    } catch (e) {
      console.error("Failed to import favorites", e)
      return false
    }
  }, [])

  return {
    favorites: store.favorites,
    collections: store.collections,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    createCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    exportJSON,
    importJSON,
  }
}

export type { FavoriteItem, Collection }
