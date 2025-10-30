"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type FolderItem = {
  id: string
  folder_id: string
  creative_id: string
  note?: string | null
  added_by?: string | null
  created_at: string
  position?: number | null
}

type Folder = {
  id: string
  owner: string
  name: string
  description?: string | null
  is_public: boolean
  created_at: string
  updated_at?: string | null
  folder_items?: FolderItem[]
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from("folders")
        .select(`id, owner, name, description, is_public, created_at, updated_at, folder_items(id, folder_id, creative_id, note, added_by, created_at, position)`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFolders((data || []) as Folder[])
    } catch (e: any) {
      console.error("Failed to fetch folders", e)
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFolders()
    // TODO: consider realtime subscriptions later
  }, [fetchFolders])

  const createFolder = useCallback(async (name: string, description?: string, is_public = false) => {
    try {
      const user = (await supabase.auth.getUser()).data.user
      const owner = user?.id || null
      const payload: any = { owner, name, description, is_public }
      const { data, error } = await supabase.from("folders").insert([payload]).select().single()
      if (error) throw error
      await fetchFolders()
      return data as Folder
    } catch (e: any) {
      console.error("Create folder failed", e)
      throw e
    }
  }, [fetchFolders])

  const updateFolder = useCallback(async (id: string, updates: { name?: string; description?: string; is_public?: boolean; owner?: string }) => {
    try {
      // If owner is being changed, call the server-side transfer endpoint
      if (updates.owner) {
        try {
          const session = (await supabase.auth.getSession()).data.session
          const token = session?.access_token
          if (!token) throw new Error("No access token available for transfer")

          const res = await fetch(`/api/folders/transfer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ folderId: id, newOwnerId: updates.owner }),
          })

          const json = await res.json()
          if (!res.ok) {
            const msg = json?.error || `transfer failed with status ${res.status}`
            throw new Error(msg)
          }

          await fetchFolders()
          return json.folder as Folder
        } catch (e: any) {
          console.error("Transfer to new owner failed", e)
          throw e
        }
      }

      const { data, error } = await supabase.from("folders").update(updates).eq("id", id).select().single()
      if (error) throw error
      await fetchFolders()
      return data as Folder
    } catch (e: any) {
      console.error("Update folder failed", e)
      throw e
    }
  }, [fetchFolders])

  const deleteFolder = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("folders").delete().eq("id", id)
      if (error) throw error
      await fetchFolders()
      return true
    } catch (e: any) {
      console.error("Delete folder failed", e)
      throw e
    }
  }, [fetchFolders])

  const addItemToFolder = useCallback(async (folderId: string, creativeId: string, note?: string) => {
    try {
      const user = (await supabase.auth.getUser()).data.user
      const added_by = user?.id || null
      const { data, error } = await supabase.from("folder_items").insert([{ folder_id: folderId, creative_id: creativeId, note, added_by }]).select().single()
      if (error) throw error
      await fetchFolders()
      return data as FolderItem
    } catch (e: any) {
      console.error("Add item to folder failed", e)
      throw e
    }
  }, [fetchFolders])

  const removeItemFromFolder = useCallback(async (folderId: string, creativeId?: string, itemId?: string) => {
    try {
      let query = supabase.from("folder_items").delete()
      if (itemId) query = query.eq("id", itemId)
      else if (creativeId) query = query.match({ folder_id: folderId, creative_id: creativeId })
      else throw new Error("provide itemId or creativeId")
      const { error } = await query
      if (error) throw error
      await fetchFolders()
      return true
    } catch (e: any) {
      console.error("Remove item from folder failed", e)
      throw e
    }
  }, [fetchFolders])

  const setItemNote = useCallback(async (itemId: string, note?: string) => {
    try {
      const { data, error } = await supabase.from("folder_items").update({ note }).eq("id", itemId).select().single()
      if (error) throw error
      await fetchFolders()
      return data as FolderItem
    } catch (e: any) {
      console.error("Set item note failed", e)
      throw e
    }
  }, [fetchFolders])

  return {
    folders,
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    addItemToFolder,
    removeItemFromFolder,
    setItemNote,
  }
}

export type { Folder, FolderItem }
