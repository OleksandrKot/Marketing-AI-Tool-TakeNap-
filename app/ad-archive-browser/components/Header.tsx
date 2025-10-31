"use client"

import { PageNavigation } from "@/components/page-navigation"
import { ProfileDropdown } from "@/components/profile-dropdown"

export function Header() {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
      <div>
        <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">Creative Library</h1>
        <p className="text-slate-600 font-medium text-lg">
          Powered by <span className="text-blue-600 font-bold">TakeNap</span>
        </p>
      </div>
      <div className="flex items-center space-x-4 mt-4 md:mt-0">
        <PageNavigation currentPage="library" />
        <ProfileDropdown />
      </div>
    </div>
  )
}

export default Header
