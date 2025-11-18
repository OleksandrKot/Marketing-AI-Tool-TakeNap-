import { createServerSupabaseClient } from '@/lib/supabase';
import { ViewDetails } from './view-details';
import type { Ad } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ViewDetailsSkeleton } from './view-details-skeleton';
import type { Metadata } from 'next';

// Отримання креативу за ID
async function getAdById(id: string) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('ads_library')
    .select(
      `
      id,
      created_at,
      ad_archive_id,
      page_name,
      text,
      caption,
      cta_text,
      cta_type,
      display_format,
      link_url,
      title,
      video_hd_url,
      video_preview_image_url,
  concept,
  realisation,
  topic,
  hook,
  character,
      publisher_platform,
      audio_script,
      video_script,
      meta_ad_url,
      image_url,
      image_description,
      duplicates_ad_text,
      duplicates_links,
      duplicates_preview_image
    `
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching ad:', error);
    // Повертаємо фейкові дані для тестування
    return getFakeAdById(id);
  }

  return data;
}

// Фейкові дані для тестування
function getFakeAdById(id: string) {
  const fakeAds = {
    '1': {
      id: 1,
      created_at: '2024-01-15T10:30:00Z',
      ad_archive_id: 'LSC789456123',
      page_name: 'Lovescape - Dating App',
      text: 'Ready to find your perfect match? 💕\n\nLovescape uses advanced AI to connect you with people who truly understand you. No more endless swiping - just meaningful connections.\n\n✨ Smart matching algorithm\n💬 Video chat before you meet\n🔒 Verified profiles only\n🎯 Find love, not just dates\n\nJoin 2M+ singles who found love on Lovescape!\n\nDownload now and get 7 days premium FREE! 🎁',
      caption:
        'Your love story starts here. Join Lovescape today! 💕 #LovescapeApp #Dating #FindLove #TrueLove',
      cta_text: 'Download Free',
      cta_type: 'INSTALL_MOBILE_APP',
      display_format: 'VIDEO',
      link_url: 'https://lovescape.app/download',
      title: 'Find Your Perfect Match with Lovescape AI',
      video_hd_url: '/generic-dating-app-video.png',
      video_preview_image_url: '/lovescape-app-preview-couple-smiling.png',
      publisher_platform: 'Facebook',
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
      meta_ad_url: 'https://www.facebook.com/ads/library/?id=LSC789456123',
      image_url: '/lovescape-coffee-date.png',
      image_description: `A warm, inviting image showing a diverse couple in their late twenties having coffee at a modern café. The woman has curly brown hair and is wearing a soft pink sweater, while the man has short dark hair and a casual blue button-down shirt. They're both smiling genuinely and leaning slightly toward each other across a small round table with two coffee cups.

The lighting is natural and golden, coming through large windows in the background. The café has a cozy, modern aesthetic with exposed brick walls and hanging plants. In the bottom right corner, there's a subtle Lovescape app logo overlay.

The overall mood is authentic, romantic, and aspirational - showing the kind of meaningful connection that the app promises to deliver. The couple appears relaxed and genuinely happy, not posed or artificial.`,
      new_scenario: null,
      tags: null,
      duplicates_ad_text: null,
      duplicates_links: null,
      duplicates_preview_image: null,
    },
  };

  return fakeAds[id as keyof typeof fakeAds] || null;
}

// Генерація метаданих для SEO
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ad = await getAdById(params.id);

  if (!ad) {
    return {
      title: 'Creative Not Found',
      description: 'The requested creative could not be found.',
    };
  }

  return {
    title: `${ad.title || 'Creative'} - ${ad.page_name} | TakeNap`,
    description: ad.text
      ? ad.text.substring(0, 160)
      : ad.title
      ? ad.title.substring(0, 160)
      : `Creative from ${ad.page_name}`,
    openGraph: {
      title: ad.title || 'Creative',
      description:
        ad.text?.substring(0, 160) ||
        ad.title?.substring(0, 160) ||
        `Creative from ${ad.page_name}`,
      images: ad.video_preview_image_url ? [ad.video_preview_image_url] : [],
    },
  };
}

interface ViewDetailsPageProps {
  params: {
    id: string;
  };
}

export default async function ViewDetailsPage({ params }: ViewDetailsPageProps) {
  const ad = await getAdById(params.id);

  if (!ad) {
    notFound();
  }

  return (
    <Suspense fallback={<ViewDetailsSkeleton />}>
      <ViewDetails ad={ad as Ad} />
    </Suspense>
  );
}
