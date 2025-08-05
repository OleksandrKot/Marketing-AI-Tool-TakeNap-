"use client"

import { Button } from "@/components/ui/button"

interface TabNavigationProps {
  activeTab: "browse" | "sauron"
  onTabChange: (tab: "browse" | "sauron") => void
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex space-x-2">
      <Button
        variant={activeTab === "browse" ? "default" : "outline"}
        className={
          activeTab === "browse"
            ? "bg-blue-500 hover:bg-blue-600 text-white font-light"
            : "bg-transparent border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 font-light"
        }
        onClick={() => onTabChange("browse")}
      >
        Browse Ads
      </Button>
    </div>
  )
}
