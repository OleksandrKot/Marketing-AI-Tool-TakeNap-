"use client"

import { useScrollbarWidth } from "@/lib/utils"
import { useEffect } from "react"

type Props = {
    isOpen: boolean
    onClose?: () => void
    children: React.ReactNode
    panelClassName?: string
}

export default function ModalWrapper({ isOpen, onClose, children, panelClassName }: Props) {
    const scrollbarWidth = useScrollbarWidth();
    useEffect(() => {
        if (typeof document === "undefined") return
        const html = document.documentElement
        const body = document.body
        const prevOverflow = body.style.overflow
        const hadHtmlClass = html.classList.contains("modal-open")
        const hadBodyClass = body.classList.contains("modal-open")
        console.log(scrollbarWidth);
        html.style.setProperty("padding-right", `${scrollbarWidth}px`)

        if (isOpen) {
            html.classList.add("modal-open")
            body.classList.add("modal-open")
        }

        return () => {
            if (!hadHtmlClass) html.classList.remove("modal-open")
            if (!hadBodyClass) body.classList.remove("modal-open")
            html.style.removeProperty("padding-right")
            body.style.overflow = prevOverflow || ""
        }
    }, [isOpen])


    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 !m-0 !mx-0"
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
        >
            <div className={panelClassName ?? "max-w-md w-full"} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}
