"use client"

import React, { useCallback, useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFavorites } from "@/lib/hooks/useFavorites"
import { supabase } from "@/lib/supabase"
import FavoritesModal from "./FavoritesModal"

interface Props {
  creativeId: string
}

export default function HeartButton({ creativeId }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [showModal, setShowModal] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  // More robust auth check: prefer session (getSession), fallback to getUser
  const checkAuth = useCallback(async () => {
    try {
      const sessionRes: any = await supabase.auth.getSession()
      const sessionUser = sessionRes?.data?.session?.user
      if (sessionUser) {
        setIsLoggedIn(true)
        return true
      }

      // fallback to getUser
      const res: any = await supabase.auth.getUser()
      const user = res?.data?.user
      setIsLoggedIn(!!user)
      return !!user
    } catch (e) {
      setIsLoggedIn(false)
      return false
    }
  }, [])

  // keep isLoggedIn in sync when component mounts (helps when user already signed in)
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const logged = await checkAuth()
        if (!mounted) return
        setIsLoggedIn(logged)
      } catch (e) {
        if (!mounted) return
        setIsLoggedIn(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [checkAuth])

  // Subscribe to auth state changes for reactive updates (magic link, sign out, etc.)
  React.useEffect(() => {
    const res: any = supabase.auth.onAuthStateChange((event: string, session: any) => {
      try {
        const hasUser = !!session?.user
        setIsLoggedIn(hasUser)
      } catch (e) {
        setIsLoggedIn(false)
      }
    })

    return () => {
      try {
        // supabase returns different shapes across versions. handle common shapes.
        const data = res?.data
        const sub = data?.subscription || data?.subscription || res?.data || res
        // unsubscribe if available
        if (sub?.unsubscribe) sub.unsubscribe()
        else if (typeof res?.unsubscribe === 'function') res.unsubscribe()
      } catch (e) {
        // noop
      }
    }
  }, [])

  const onClick = useCallback(async () => {
    const logged = isLoggedIn === null ? await checkAuth() : !!isLoggedIn
    if (!logged) {
      // still allow adding to local favorites for guests
      toggleFavorite(creativeId)
      return
    }

    // logged-in users should see modal to pick folder/collection
    setShowModal(true)
  }, [isLoggedIn, checkAuth, toggleFavorite, creativeId])

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={`transition-colors ${isFavorite(creativeId) ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-slate-600"}`}
        aria-label={isFavorite(creativeId) ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={`h-5 w-5 ${isFavorite(creativeId) ? "fill-current" : ""}`} />
      </Button>

      {/* small inline debug badge showing auth state */}
      <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${isLoggedIn ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
        {isLoggedIn === null ? 'Checking...' : isLoggedIn ? 'Logged in' : 'Guest'}
      </span>

      {showModal && <FavoritesModal isOpen={showModal} onClose={() => setShowModal(false)} creativeId={creativeId} />}
    </>
  )
}

export { HeartButton }
