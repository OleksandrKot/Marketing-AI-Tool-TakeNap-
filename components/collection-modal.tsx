"use client"

import { useCallback, useMemo, useState } from "react"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useFavorites } from "@/lib/hooks/useFavorites"
import { useFolders } from "@/lib/hooks/useFolders"

interface CollectionModalProps {
  isOpen: boolean
  onClose: () => void
  creativeId: string
}

export function CollectionModal({ isOpen, onClose, creativeId }: CollectionModalProps) {
  const { collections } = useFavorites()
  const { folders: serverCollections, createFolder, addItemToFolder, removeItemFromFolder } = useFolders()
  // prefer server-backed collections when available
  const cols = serverCollections && serverCollections.length ? serverCollections : collections
  const [newName, setNewName] = useState("")

  const membership = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const c of cols) {
      const anyc: any = c
      const ids = (anyc.folder_items || anyc.itemIds || []).map((i: any) => i.creative_id || i)
      map[c.id] = ids.includes(creativeId)
    }
    return map
  }, [cols, creativeId])

  const handleToggle = useCallback(
    (collectionId: string) => {
      if (membership[collectionId]) removeItemFromFolder(collectionId, creativeId)
      else addItemToFolder(collectionId, creativeId)
    },
    [membership, addItemToFolder, removeItemFromFolder, creativeId],
  )

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const created = await createFolder(name)
      if (created) await addItemToFolder(created.id, creativeId)
    } catch (e) {
      console.error(e)
    }
    setNewName("")
  }, [newName, createFolder, addItemToFolder, creativeId, cols])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">Manage Collections</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-600">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm text-slate-600 mb-2 block">Create new collection</label>
              <div className="flex gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Collection name" />
                <Button onClick={handleCreate} className="px-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-600 mb-2 block">Your collections</label>
              <div className="space-y-2 max-h-48 overflow-auto">
                {cols.length === 0 && <div className="text-sm text-slate-500">No collections yet</div>}
                {cols.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <input
                        id={`col-${c.id}`}
                        type="checkbox"
                        checked={!!membership[c.id]}
                        onChange={() => handleToggle(c.id)}
                        className="w-4 h-4"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{(((c as any).folder_items || (c as any).itemIds || []) as any).length} items</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`/folders/${c.id}`} className="text-sm text-slate-500 hover:underline">Open</a>
                      <div className="text-sm text-slate-500">{new Date(((c as any).createdAt || (c as any).created_at) as any).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CollectionModal
