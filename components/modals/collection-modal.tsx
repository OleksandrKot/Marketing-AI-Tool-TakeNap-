"use client"

import { useCallback, useMemo, useState } from "react"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useFavorites } from "@/lib/hooks/useFavorites"
import ModalWrapper from "./ModalWrapper"

interface CollectionModalProps {
  isOpen: boolean
  onClose: () => void
  creativeId: string
}

export function CollectionModal({ isOpen, onClose, creativeId }: CollectionModalProps) {
  const { collections, createCollection, addToCollection, removeFromCollection } = useFavorites()
  const [newName, setNewName] = useState("")

  const membership = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const c of collections) map[c.id] = c.itemIds.includes(creativeId)
    return map
  }, [collections, creativeId])

  const handleToggle = useCallback(
    (collectionId: string) => {
      if (membership[collectionId]) removeFromCollection(collectionId, creativeId)
      else addToCollection(collectionId, creativeId)
    },
    [membership, addToCollection, removeFromCollection, creativeId],
  )

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    createCollection(name)
    // small timeout to allow collection to appear in store and then add
    setTimeout(() => {
      const created = (collections.find((c) => c.name === name) || null)
      if (created) addToCollection(created.id, creativeId)
    }, 50)
    setNewName("")
  }, [newName, createCollection, collections, addToCollection, creativeId])

  if (!isOpen) return null

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} panelClassName="p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
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
                {collections.length === 0 && <div className="text-sm text-slate-500">No collections yet</div>}
                {collections.map((c) => (
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
                        <div className="text-xs text-slate-500">{c.itemIds.length} items</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ModalWrapper>
  )
}

export default CollectionModal
