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
import LoginModal from "@/app/login-auth/LoginModal"
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
          // Prefer display name from auth user metadata
          const metaName = (u as any).user_metadata?.display_name || (u as any).user_metadata?.nickname
          if (metaName) {
            setUser({ email: u.email || "", nickname: metaName })
            setNickname(metaName)
            localStorage.setItem("nickname", metaName)
          } else {
            // Fallback to cached nickname if available
            const cached = localStorage.getItem("nickname")
            if (cached) {
              setUser({ email: u.email || "", nickname: cached })
              setNickname(cached)
            } else {
              // Try to read from profiles table as a last resort
              try {
                const { data: profileData } = await supabase.from("profiles").select("nickname").eq("id", u.id).single()
                if (profileData?.nickname) {
                  setUser({ email: u.email || "", nickname: profileData.nickname })
                  setNickname(profileData.nickname)
                  localStorage.setItem("nickname", profileData.nickname)
                } else {
                  setUser({ email: u.email || "", nickname: undefined })
                }
              } catch (e) {
                setUser({ email: u.email || "", nickname: undefined })
              }
            }
          }
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

              {/* Main menu items */}
              <DropdownMenuItem onClick={() => router.push('/profile')} className="hover:bg-slate-100 cursor-pointer">
                My Profile
              </DropdownMenuItem>

              {/* WIP items placed below Logout as requested (navigate to WIP stub pages; show tooltip) */}
              <DropdownMenuSeparator className="bg-slate-200 mt-1" />
              <DropdownMenuItem
                onClick={() => router.push('/wip/my-adaptations')}
                title="Coming soon"
                className="hover:bg-slate-100 cursor-pointer text-slate-700"
              >
                My Adaptations <span className="ml-2 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">WIP</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/wip/personas-settings')}
                title="Coming soon"
                className="hover:bg-slate-100 cursor-pointer text-slate-700"
              >
                Personas settings <span className="ml-2 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">WIP</span>
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
          onAuth={async (userData: any) => {
            // Be defensive about the shape of userData. Supabase/auth flows may return
            // { user } or a flat user object. Normalize accordingly.
            try {
              let email = ""
              let nicknameFromData: string | undefined = undefined
              let userId: string | undefined = undefined

              if (!userData) {
                // nothing to do
              } else if (userData.user) {
                // shape: { user: { id, email, ... }, ... }
                email = userData.user.email || ""
                userId = userData.user.id || userData.user.sub || undefined
                nicknameFromData = userData.nickname || (userData.user as any).nickname
              } else {
                // flat shape: { id, email, nickname }
                email = userData.email || ""
                userId = userData.id || undefined
                nicknameFromData = userData.nickname
              }

              // Prefer nickname from the auth response, then localStorage, then DB lookup
              if (nicknameFromData) {
                setNickname(nicknameFromData)
                localStorage.setItem("nickname", nicknameFromData)
              } else {
                const cached = localStorage.getItem("nickname")
                if (cached) {
                  setNickname(cached)
                } else if (userId) {
                  try {
                    const { data: profileData, error } = await supabase.from("profiles").select("nickname").eq("id", userId).single()
                    if (!error && profileData?.nickname) {
                      setNickname(profileData.nickname)
                      localStorage.setItem("nickname", profileData.nickname)
                      nicknameFromData = profileData.nickname
                    }
                  } catch (e) {
                    // ignore
                  }
                }
              }

              setUser({ email, nickname: nicknameFromData || localStorage.getItem("nickname") || undefined })
            } finally {
              setShowLogin(false)
            }
          }}
        />
      )}
    </>
  )
}
