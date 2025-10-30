"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export default function ProfilePage() {
  const [user, setUser] = useState<any | null>(null)
  const [nickname, setNickname] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [changing, setChanging] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwMessage, setPwMessage] = useState("")
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (!mounted) return
      setUser(u)
      if (u) {
          const { data: profile } = await supabase.from("profiles").select("nickname, display_name").eq("id", u.id).single()
          if (profile?.display_name) setNickname(profile.display_name)
          else if (profile?.nickname) setNickname(profile.nickname)
        }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function handleSave() {
    if (!user) return
    setLoading(true)
    setMessage("")
    try {
      // Save both fields to support Supabase UI 'Display name' and our 'nickname'
      await supabase.from("profiles").upsert({ id: user.id, nickname, display_name: nickname })
      // Try to update auth user's metadata (display_name) as well
      try {
        await supabase.auth.updateUser({ data: { display_name: nickname } })
      } catch (metaErr) {
        console.warn('Could not update auth user metadata display_name:', metaErr)
      }
      localStorage.setItem("nickname", nickname)
      setMessage("Saved")
    } catch (err) {
      console.error(err)
      setMessage("Error saving profile")
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    localStorage.removeItem("nickname")
    router.push("/")
  }

  async function handleChangePassword() {
    setPwMessage("")
    if (!newPassword || newPassword.length < 6) {
      setPwMessage("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage("Passwords do not match")
      return
    }
    setChanging(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        console.error('Password change failed', error)
        setPwMessage(error.message || 'Failed to change password')
      } else {
        setPwMessage('Password updated')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (e) {
      console.error(e)
      setPwMessage('Failed to change password')
    } finally {
      setChanging(false)
    }
  }

  if (!user) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/")}
            aria-label="Back to home"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-2xl font-semibold">Profile</h1>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <p className="text-slate-600">You are not signed in.</p>
          <div className="mt-4">
            <Button onClick={() => router.push("/")}>Go to Home</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/")}
          aria-label="Back to home"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-2xl font-semibold">Profile</h1>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <p className="text-sm text-slate-500">Email</p>
        <p className="mb-4 font-medium">{user.email}</p>

        <label className="text-sm text-slate-500">Nickname</label>
        <div className="flex gap-3 mt-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-xl"
            placeholder="Nickname"
          />
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </div>
        {message && <p className="text-sm mt-3 text-slate-600">{message}</p>}

        <div className="mt-6">
          <Button variant="ghost" onClick={handleSignOut}>Sign out</Button>
        </div>

        <div className="mt-6 border-t pt-6">
          <h3 className="text-sm font-semibold mb-2">Change password</h3>
          <p className="text-sm text-slate-500 mb-3">Enter a new password to update your account password.</p>
          <div className="flex flex-col gap-2">
            <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="px-3 py-2 border rounded-xl" />
            <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="px-3 py-2 border rounded-xl" />
            <div className="flex items-center gap-3">
              <Button onClick={handleChangePassword} disabled={changing}>{changing ? 'Updating...' : 'Update password'}</Button>
            </div>
            {pwMessage && <div className="text-sm text-slate-600 mt-2">{pwMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
