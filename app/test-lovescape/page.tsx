"use client"

import { AdDetails } from "../creative/[id]/ad-details"
import type { Ad } from "@/lib/types"

// Фейкові дані про Lovescape
const lovescapeAd: Ad = {
  id: 999,
  created_at: "2024-01-15T10:30:00Z",
  ad_archive_id: "LSC789456123",
  page_name: "Lovescape - Dating App",
  text: `Ready to find your perfect match? 💕

Lovescape uses advanced AI to connect you with people who truly understand you. No more endless swiping - just meaningful connections.

✨ Smart matching algorithm
💬 Video chat before you meet
🔒 Verified profiles only
🎯 Find love, not just dates

Join 2M+ singles who found love on Lovescape!

Download now and get 7 days premium FREE! 🎁`,
  caption: "Your love story starts here. Join Lovescape today! 💕 #LovescapeApp #Dating #FindLove #TrueLove",
  cta_text: "Download Free",
  cta_type: "INSTALL_MOBILE_APP",
  display_format: "VIDEO",
  link_url: "https://lovescape.app/download",
  title: "Find Your Perfect Match with Lovescape AI",
  video_hd_url: "https://placeholder.svg?height=720&width=1280&query=lovescape-dating-app-video",
  video_preview_image: "https://placeholder.svg?height=720&width=1280&query=lovescape-app-preview-couple-smiling",
  publisher_platform: "Facebook",
  audio_script: `[Upbeat romantic music starts]

Narrator (warm, friendly female voice): "Tired of meaningless swipes? Ready for something real?"

[Sound of notification ping]

Narrator: "Meet Sarah. She tried every dating app... until she found Lovescape."

Sarah (testimonial): "I was so tired of small talk and ghosting. But Lovescape's AI actually understood what I was looking for."

Narrator: "Our smart algorithm doesn't just match faces - it matches hearts, minds, and life goals."

[Gentle transition music]

Narrator: "Video chat before you meet. Verified profiles only. Real connections, real fast."

Sarah: "I met Jake on Lovescape three months ago. We're moving in together next week!"

[Happy couple laughing in background]

Narrator: "Join over 2 million singles who found love on Lovescape. Download free today and get 7 days premium - on us!"

[App notification sound]

Narrator: "Lovescape. Where love finds you."

[Music fades out]`,
  video_script: `00:00 - 00:02: Close-up of a young woman (Sarah, 28) looking frustrated while swiping through a generic dating app on her phone. She sighs and puts the phone down.

00:02 - 00:04: Text overlay appears: "Tired of meaningless swipes?" The screen transitions to show the Lovescape app logo with a heart animation.

00:04 - 00:07: Split screen showing Sarah downloading Lovescape. The app interface appears with AI matching animation - colorful connecting lines between profile photos.

00:07 - 00:10: Sarah's face lights up as she sees a match notification. Cut to her having a video chat with Jake (30, friendly smile) through the app.

00:10 - 00:13: Montage of their video dates: cooking together virtually, watching a movie, laughing. Text overlay: "Video chat before you meet"

00:13 - 00:16: Real-life meeting at a coffee shop. They're both smiling, clearly comfortable with each other. Text: "Verified profiles only"

00:16 - 00:19: Quick testimonial - Sarah speaking to camera: "Lovescape's AI actually understood what I was looking for."

00:19 - 00:22: Statistics animation: "2M+ singles found love" with happy couple photos floating by.

00:22 - 00:25: Sarah and Jake together, happy and in love. Text overlay: "3 months later..." They're holding hands.

00:25 - 00:28: App download screen with "7 days premium FREE" badge pulsing. 

00:28 - 00:30: Final logo animation: "Lovescape - Where love finds you" with download button.`,
  meta_ad_url: "https://www.facebook.com/ads/library/?id=LSC789456123",
  image_url: "https://placeholder.svg?height=720&width=1280&query=lovescape-dating-app-couple-coffee-date-smiling",
  image_description: `A warm, inviting image showing a diverse couple in their late twenties having coffee at a modern café. The woman has curly brown hair and is wearing a soft pink sweater, while the man has short dark hair and a casual blue button-down shirt. They're both smiling genuinely and leaning slightly toward each other across a small round table with two coffee cups.

The lighting is natural and golden, coming through large windows in the background. The café has a cozy, modern aesthetic with exposed brick walls and hanging plants. In the bottom right corner, there's a subtle Lovescape app logo overlay.

The overall mood is authentic, romantic, and aspirational - showing the kind of meaningful connection that the app promises to deliver. The couple appears relaxed and genuinely happy, not posed or artificial.`,
}

export default function TestLovescapePage() {
  return <AdDetails ad={lovescapeAd} />
}
