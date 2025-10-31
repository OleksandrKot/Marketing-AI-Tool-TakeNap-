"use client"

import { useState, useEffect } from "react"
import { User, LogOut, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import LoginModal from "./LoginModal"
import { supabase } from "@/lib/supabase"

export function ProfileDropdown() {
  const [user, setUser] = useState<{ email: string; nickname?: string } | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [nickname, setNickname] = useState<string>("")

  // On mount, try to load current user from Supabase
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const u = data?.user
        if (mounted && u) {
          setUser({ email: u.email || "", nickname: localStorage.getItem("nickname") || undefined })
          setNickname(localStorage.getItem("nickname") || "")
        }
      } catch (e) {
        // ignore
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [])

  const handleLogout = async () => {
    setUser(null)
    setNickname("")
    localStorage.removeItem("nickname")
    // Sign out on Supabase as well
    try {
      await supabase.auth.signOut()
    } catch (e) {
    }
  }

  const router = useRouter()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25 w-full lg:w-auto">
            <User className="h-4 w-4 mr-2" />
            {nickname ? nickname : "My Profile"}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg w-64" align="start">
          {user ? (
            <>
              <div className="px-3 py-2">
                <p className="text-sm text-slate-500 font-medium">Signed in as</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{nickname ? nickname : user.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem onClick={handleLogout} className="hover:bg-red-50 text-red-600 hover:text-red-700 cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/folders')} className="hover:bg-slate-100 cursor-pointer">
                My Folders
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/profile')} className="hover:bg-slate-100 cursor-pointer">
                My Profile
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setShowLogin(true)} className="hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer">
                Sign In
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowLogin(true)} className="hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer">
                Register
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onAuth={(userData: any) => {
            // userData may include email and nickname from AuthForm
            setUser({ email: userData.email || "", nickname: userData.nickname || localStorage.getItem("nickname") || undefined })
            if (userData.nickname) setNickname(userData.nickname)
            setShowLogin(false)
          }}
        />
      )}
    </>
  )
}
