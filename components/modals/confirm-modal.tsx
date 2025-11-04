"use client"

import { Button } from "@/components/ui/button"
import ModalWrapper from "./ModalWrapper"

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
    <ModalWrapper isOpen={isOpen} onClose={onCancel} panelClassName="">
      <div className="bg-white rounded-2xl p-6 z-10 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {message && <p className="text-sm text-slate-600 mb-4">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </ModalWrapper>
  )
}
