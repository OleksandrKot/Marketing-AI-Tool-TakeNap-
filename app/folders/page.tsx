"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useFavorites } from "@/lib/hooks/useFavorites"
import { useFolders } from "@/lib/hooks/useFolders"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit3, Trash2, ArrowLeft, User, Folder, Save, X } from "lucide-react"
import placeholder from "../../public/placeholder.svg"
import { truncateText } from "@/lib/utils"

export default function FoldersPage() {
  const { favorites } = useFavorites()
  const { folders: collections, createFolder, createFolder: createCollection, deleteFolder: deleteCollection, updateFolder: updateCollection, addItemToFolder: addToCollection, removeItemFromFolder: removeFromCollection, setItemNote } = useFolders()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  // owner is set automatically on create (auth user) — owner switch is allowed only when editing
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [adMap, setAdMap] = useState<Record<string, any>>({})
  const [addId, setAddId] = useState("")

  // pre-load users so we can display owner display names next to folders
  // owners are shown from user info when available; we no longer fetch users for owner transfer in the UI

  useEffect(() => {
    // prefetch ad metadata for items in collections
    let ids: string[] = []
    for (const c of collections) ids = ids.concat((c.folder_items || []).map((i: any) => i.creative_id))
    ids = Array.from(new Set(ids)).filter((i) => !!i && !adMap[i])
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const promises = ids.map(async (id) => {
          try {
            const res = await fetch(`/api/ads/${encodeURIComponent(id)}`)
            if (!res.ok) return { id, data: null }
            const payload = await res.json()
            return { id, data: payload?.data || null }
          } catch (e) {
            return { id, data: null }
          }
        })
        const results = await Promise.all(promises)
        if (cancelled) return
        setAdMap((prev) => {
          const next = { ...prev }
          for (const r of results) if (r?.id) next[r.id] = r.data
          return next
        })
      } catch (e) {
        console.error("Failed to load folder ad previews", e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [collections])

  const selected = useMemo(() => collections.find((c) => c.id === selectedId) || null, [collections, selectedId])

  function openCreate() {
    setNewName("")
    setNewDescription("")
    setCreating(true)
  }

  async function handleCreate() {
    if (!newName) return
    try {
      await createCollection(newName, newDescription || undefined)
      setStatusMessage('Folder created')
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (e: any) {
      console.error(e)
      setStatusMessage(`Create folder failed: ${e?.message || String(e)}`)
    }
    setCreating(false)
  }

  function startEdit(c: any) {
    setEditing(c.id)
    setEditName(c.name || "")
    setEditDescription(c.description ?? null)
  // editing only allows changing name and description (not transferring ownership)
  }

  async function saveEdit(id: string) {
    try {
      setSaving(true)
      setStatusMessage('Saving folder...')
  // only update folder name and description (no owner transfer from UI)
  await updateCollection(id, { name: editName, description: editDescription ?? undefined })
      setStatusMessage('Saved')
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (err: any) {
      console.error('Owner transfer failed:', err)
      // Show more detailed error if available from Supabase
      const message = err?.message || err?.error || JSON.stringify(err)
      setStatusMessage(`Failed to save folder: ${message}`)
      setTimeout(() => setStatusMessage(null), 6000)
    } finally {
      setSaving(false)
      setEditing(null)
    }
  }

  function handleAddToCollection(id: string) {
    if (!addId) return
    addToCollection(id, addId)
    setAddId("")
  }

  function setNote(creativeId: string) {
    const note = window.prompt("Add a note for this item:")
    if (note === null) return
    setItemNote(creativeId, note || undefined)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">My Folders</h1>
            <p className="text-slate-600 font-medium text-lg">Organize creatives into folders (like playlists).</p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Button onClick={openCreate} className="bg-blue-600 text-white">
              <Plus className="h-4 w-4 mr-2" /> Create Folder
            </Button>
            <Link href="/">
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                <ArrowLeft className="h-5 w-5 mr-2" /> Back to Library
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <Card className="bg-white border border-slate-200 rounded-2xl p-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Folders</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {collections.length === 0 && (
                    <div className="text-sm text-slate-500">No folders yet — create one to get started.</div>
                  )}
                  {collections.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Folder className="h-5 w-5 text-slate-600" />
                        <div>
                          <div className="font-medium text-slate-900">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.owner ? `Owner: ${c.owner}` : 'No owner'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(c.id)} className="px-2">Open</Button>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(c)} className="px-2"><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete folder?')) deleteCollection(c.id) }} className="px-2 text-red-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="bg-white border border-slate-200 rounded-2xl">
              <CardHeader className="p-6 pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{selected ? selected.name : 'Select a folder'}</h2>
                  <p className="text-sm text-slate-500">{selected ? (selected.owner ? `Owner: ${selected.owner}` : 'No owner') : 'Open a folder to view and manage items.'}</p>
                  {selected?.description && <div className="text-sm text-slate-600 mt-2">Description: {selected.description}</div>}
                  {statusMessage && <div className="text-sm text-slate-500 mt-2">{statusMessage}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {selected && (
                    <>
                      <input value={addId} onChange={(e) => setAddId(e.target.value)} placeholder="Add creative id" className="px-3 py-2 border rounded-md" />
                      <Button onClick={() => selected && handleAddToCollection(selected.id)}><Plus className="h-4 w-4 mr-2" />Add</Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {!selected ? (
                  <div className="text-slate-500">Choose a folder to see its contents and options to edit or add items.</div>
                ) : (
                  <div className="space-y-4">
                    {(selected.folder_items || []).length === 0 && (
                      <div className="text-sm text-slate-500">This folder is empty. Add creatives by their ID above.</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(selected.folder_items || []).map((it: any) => {
                        const id = it.creative_id
                        const ad = adMap[id]
                        const fav = favorites.find((f) => f.creativeId === id)
                        const thumb = ad?.video_preview_image_url || ad?.image_url || null
                        return (
                          <Card key={id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                            <CardContent className="flex items-center gap-4 p-4">
                              <div className="w-28 h-20 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                                {thumb ? (
                                  <div className="relative w-full h-full">
                                    <Image src={thumb} alt={ad?.title || 'preview'} fill className="object-cover" sizes="96px" />
                                  </div>
                                ) : (
                                  <Image src={placeholder.src || '/placeholder.svg'} alt="placeholder" width={48} height={48} className="opacity-40" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-slate-900">{truncateText(ad?.title || `Creative ${id}`, 60)}</div>
                                <div className="text-sm text-slate-500">{ad?.page_name || 'Unknown source'}</div>
                                {it?.note && <div className="text-xs text-slate-600 mt-1">Note: {it.note}</div>}
                              </div>
                              <div className="flex flex-col gap-2">
                                <Link href={`/creative/${id}`}><Button variant="outline" className="w-full">View</Button></Link>
                                <Button variant="ghost" onClick={() => setNote(id)}>Note</Button>
                                <Button variant="ghost" onClick={() => removeFromCollection(selected.id, id)} className="text-red-600">Remove</Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-6">
                {editing && (
                  <div className="flex items-center gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="px-3 py-2 border rounded-md" />
                    <input value={editDescription ?? ""} onChange={(e) => setEditDescription(e.target.value)} placeholder="Folder description" className="px-3 py-2 border rounded-md" />
                    <Button disabled={saving} onClick={() => editing && saveEdit(editing)}>
                      <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Create modal simple inline */}
        {creating && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setCreating(false)} />
              <div className="bg-white rounded-2xl p-6 z-10 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Create Folder</h3>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Folder name" className="w-full px-3 py-2 border rounded-md mb-2" />
              <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Folder description (optional)" className="w-full px-3 py-2 border rounded-md mb-2" />
              <p className="text-sm text-slate-500 mb-4">Owner will be set to the currently logged in user.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Create</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
