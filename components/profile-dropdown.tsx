"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, LogOut, ChevronDown, Folder } from "lucide-react"
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
  const router = useRouter()
  const [user, setUser] = useState<any | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [nickname, setNickname] = useState<string>("")

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data } = await supabase.auth.getUser()
        const u = data.user
        if (!mounted) return
        if (u) {
          setUser(u)
          // prefer display_name from auth user metadata first
          try {
            const authDisplay = (u as any)?.user_metadata?.display_name
            if (authDisplay) {
              setNickname(authDisplay)
              localStorage.setItem("nickname", authDisplay)
              return
            }
          } catch (e) {
            // ignore metadata read errors
          }

          // try to fetch nickname from profiles table if auth metadata not present
          try {
            const { data: profile, error: profileError } = await supabase.from("profiles").select("nickname, display_name").eq("id", u.id).single()
            if (profileError) {
              // If the profiles table doesn't exist (e.g., dev environment), avoid noisy warnings
              const msg = (profileError as any)?.message || ''
              const code = (profileError as any)?.code || ''
              if (code === '42P01' || msg.includes('does not exist')) {
                // silently fallback to localStorage
                const stored = localStorage.getItem("nickname")
                if (stored) setNickname(stored)
              } else {
                console.warn("Could not fetch profile nickname:", profileError.message || profileError)
                const stored = localStorage.getItem("nickname")
                if (stored) setNickname(stored)
              }
            } else if (profile?.display_name || profile?.nickname) {
              const name = profile.display_name || profile.nickname
              setNickname(name)
              localStorage.setItem("nickname", name)
            } else {
              const stored = localStorage.getItem("nickname")
              if (stored) setNickname(stored)
            }
          } catch (e) {
            console.warn("Profile fetch failed:", e)
            const stored = localStorage.getItem("nickname")
            if (stored) setNickname(stored)
          }
        } else {
          const stored = localStorage.getItem("nickname")
          if (stored) setNickname(stored)
          setUser(null)
        }
      } catch (err) {
        console.error("ProfileDropdown load error", err)
      }
    }

    load()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        // prefer auth metadata display_name on auth change, else try profiles
        ;(async () => {
          try {
            const authDisplay = (session.user as any)?.user_metadata?.display_name
            if (authDisplay) {
              setNickname(authDisplay)
              localStorage.setItem("nickname", authDisplay)
              return
            }

            const { data, error } = await supabase.from("profiles").select("nickname, display_name").eq("id", session.user.id).single()
            if (error) {
              const msg = (error as any)?.message || ''
              const code = (error as any)?.code || ''
              if (code === '42P01' || msg.includes('does not exist')) {
                // profiles table missing — fallback gracefully
                const stored = localStorage.getItem("nickname")
                if (stored) setNickname(stored)
                return
              }
              console.warn("Could not fetch nickname on auth change:", error)
              return
            }
            const name = data?.display_name || data?.nickname
            if (name) {
              setNickname(name)
              localStorage.setItem("nickname", name)
            }
          } catch (e: unknown) {
            console.warn("Profile fetch error:", e)
          }
        })()
      } else {
        setUser(null)
        setNickname("")
        localStorage.removeItem("nickname")
      }
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error("Sign out error", err)
    }
    setUser(null)
    setNickname("")
    localStorage.removeItem("nickname")
    router.push("/")
  }

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
          <DropdownMenuItem
            onClick={() => router.push('/profile')}
            className="hover:bg-slate-100 cursor-pointer">
            <User className="h-4 w-4 mr-2" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push('/folders')}
            className="hover:bg-slate-100 cursor-pointer">
            <Folder className="h-4 w-4 mr-2" />
            My Folders
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-200" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="hover:bg-red-50 text-red-600 hover:text-red-700 cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </>
        ) : (
        <>
          <DropdownMenuItem
          onClick={() => setShowLogin(true)}
          className="hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer"
          >
          Sign In
          </DropdownMenuItem>
          <DropdownMenuItem
          onClick={() => setShowLogin(true)}
          className="hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer"
          >
          Register
          </DropdownMenuItem>
        </>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
      {showLogin && <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />}
    </>
  )
}
