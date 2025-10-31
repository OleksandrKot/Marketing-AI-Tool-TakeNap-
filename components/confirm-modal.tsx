"use client"

import { Button } from "@/components/ui/button"

type Props = {
  isOpen: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="bg-white rounded-2xl p-6 z-10 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {message && <p className="text-sm text-slate-600 mb-4">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
