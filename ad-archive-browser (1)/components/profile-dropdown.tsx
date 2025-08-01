"use client"

import { useState } from "react"
import { User, LogOut, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export function ProfileDropdown() {
  const [userEmail] = useState("user@example.com") // This would come from your auth system

  const handleLogout = () => {
    // Add your logout logic here
    console.log("Logging out...")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25 w-full lg:w-auto">
          <User className="h-4 w-4 mr-2" />
          My Profile
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg w-64" align="start">
        <div className="px-3 py-2">
          <p className="text-sm text-slate-500 font-medium">Signed in as</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{userEmail}</p>
        </div>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="hover:bg-red-50 text-red-600 hover:text-red-700 cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
