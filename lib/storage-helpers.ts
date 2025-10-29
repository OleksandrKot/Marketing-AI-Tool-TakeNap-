import { createClient } from "@supabase/supabase-js"

export const getPublicImageUrl = (imagePath: string) => {
  if (!imagePath) return ''
  
  try {
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) return imagePath
    
    // If it's a storage path, construct the full URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!baseUrl) return imagePath
    
    // Remove any leading slashes
    const cleanPath = imagePath.replace(/^\/+/, '')
    
    // Return the full storage URL
    return `${baseUrl}/storage/v1/object/public/${cleanPath}`
  } catch (e) {
    console.error('Error constructing storage URL:', e)
    return imagePath
  }
}

// Helper to check if a URL is a Supabase storage URL
export const isStorageUrl = (url: string) => {
  if (!url) return false
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    return url.startsWith(`${baseUrl}/storage/v1/object/public/`)
  } catch (e) {
    return false
  }
}