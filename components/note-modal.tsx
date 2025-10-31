"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  isOpen: boolean
  initialValue?: string | null
  onClose: () => void
  onSave: (value?: string) => void
}

export default function NoteModal({ isOpen, initialValue, onClose, onSave }: Props) {
  const [value, setValue] = useState<string>(initialValue || "")

  useEffect(() => {
    if (isOpen) setValue(initialValue || "")
  }, [isOpen, initialValue])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-2xl p-6 z-10 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">Edit note</h3>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} className="w-full h-32 p-3 border rounded-md mb-4" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(value || undefined); onClose() }}>Save</Button>
        </div>
      </div>
    </div>
  )
}
