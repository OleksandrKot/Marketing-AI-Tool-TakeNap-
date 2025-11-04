"use client"
import { Button } from "@/components/ui/button"
import { ReactNode } from "react"

interface Option {
  value: string
  label: string
  icon?: ReactNode
}

interface PillTypeSelectorProps {
  options: Option[]
  selected: string
  onChange: (value: string) => void
  className?: string
}

export function PillTypeSelector({ options, selected, onChange, className }: PillTypeSelectorProps) {
  return (
    <div className={`max-w-xl mx-auto ${className || ""}`}>
      <div className="grid gap-2 justify-center bg-slate-100 rounded-xl p-1 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        {options.map((o) => (
          <Button
            key={o.value}
            variant="ghost"
            size="sm"
            className={`h-8 px-3 rounded-lg font-medium transition-all duration-200 w-full md:w-auto md:min-w-[120px] whitespace-nowrap ${selected === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default PillTypeSelector
