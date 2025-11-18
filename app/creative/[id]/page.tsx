import { createServerSupabaseClient } from '@/lib/supabase';
import { AdDetails } from './ad-details';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdDetailsSkeleton } from './ad-details-skeleton';
import type { Metadata } from 'next';
import type { Ad, AdaptationScenario } from '@/lib/types';
import {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
} from './utils/adData';

// Кешування даних креативу
async function getAdById(id: string) {
  try {
    const supabase = createServerSupabaseClient();

    // Оптимізований запит - вибираємо тільки потрібні поля
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
        publisher_platform,
        audio_script,
        video_script,
        meta_ad_url,
        image_url,
        image_description,
        concept,
        realisation,
        topic,
        hook,
        character,
        new_scenario,
        duplicates_ad_text,
        duplicates_links,
        duplicates_preview_image
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching ad:', error);
      // Якщо помилка з базою даних, повертаємо фейкові дані для тестування
      return getFakeAdById(id);
    }

    return data;
  } catch (error) {
    console.error('Database connection error:', error);
    // Якщо проблема з підключенням, повертаємо фейкові дані
    return getFakeAdById(id);
  }
}

// Функція для отримання related ads по ID
async function getRelatedAdsByIds(ids: string[]): Promise<Ad[] | null> {
  try {
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
        publisher_platform,
        audio_script,
        video_script,
        meta_ad_url,
        image_url,
        image_description,
        concept,
        realisation,
        topic,
        hook,
        character,
        new_scenario,
        duplicates_ad_text,
        duplicates_links,
        duplicates_preview_image
      `
      )
      .in('id', ids);

    if (error) {
      console.error('Error fetching related ads:', error);
      return null;
    }

    return data as Ad[] | null;
  } catch (error) {
    console.error('Database connection error for related ads:', error);
    return null;
  }
}

// Фейкові дані для тестування, коли база даних недоступна
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
      new_scenario: 'New dating scenario added for ad 1',
    },
    '2': {
      id: 2,
      created_at: '2024-01-14T15:20:00Z',
      ad_archive_id: 'BM123789456',
      page_name: 'BetterMe',
      text: 'How to hit enough protein for weight loss and gain muscle? High Protein Meal Plan for Busy Women on a Weight Loss Journey',
      caption: 'Transform your body with our meal plan',
      cta_text: 'Try now!',
      cta_type: 'LEARN_MORE',
      display_format: 'VIDEO',
      link_url: 'https://betterme.world',
      title: 'High Protein Meal Plan',
      video_hd_url: '/video-placeholder.png',
      video_preview_image_url: '/placeholder.svg?height=400&width=600',
      publisher_platform: 'Facebook',
      audio_script:
        "How to hit enough protein for weight loss and gain muscle. In a week, you'll start to feel it...",
      video_script:
        '00:00 – 00:02: A hand uses a spoon to scoop a spoonful of a fruit-and-yogurt-based meal.',
      meta_ad_url: 'https://www.facebook.com/ads/library/ad_archive/?id=123456789',
      image_url: '/placeholder-hm5r5.png',
      image_description: 'Image of a healthy protein-rich meal.',
      new_scenario: null,
    },
    '3': {
      id: 3,
      created_at: '2024-01-13T09:15:00Z',
      ad_archive_id: 'NK987654321',
      page_name: 'Nike',
      text: 'Just Do It. New collection available now.',
      caption: 'Nike Air Max - Step into greatness',
      cta_text: 'Shop Now',
      cta_type: 'SHOP_NOW',
      display_format: 'IMAGE',
      link_url: 'https://nike.com',
      title: 'Nike Air Max Collection',
      video_hd_url: null,
      video_preview_image_url: '/placeholder.svg?height=400&width=600',
      publisher_platform: 'Instagram',
      audio_script: null,
      video_script: null,
      meta_ad_url: 'https://www.facebook.com/ads/library/ad_archive/?id=987654321',
      image_url: '/stylish-sneakers.png',
      image_description: 'Close-up of Nike Air Max shoes on a running track.',
      new_scenario: null,
    },
  };

  return fakeAds[id as keyof typeof fakeAds] || null;
}

// Генерація метаданих для SEO та соціальних мереж
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
    twitter: {
      card: 'summary_large_image',
      title: ad.title || 'Creative',
      description:
        ad.text?.substring(0, 160) ||
        ad.title?.substring(0, 160) ||
        `Creative from ${ad.page_name}`,
      images: ad.video_preview_image_url ? [ad.video_preview_image_url] : [],
    },
  };
}

// Статична генерація для популярних креативів (опціонально)
export async function generateStaticParams() {
  try {
    const supabase = createServerSupabaseClient();

    // Генеруємо статичні сторінки для топ-100 креативів
    const { data } = await supabase
      .from('ads_library')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(100);

    return (
      data?.map((ad) => ({
        id: ad.id.toString(),
      })) || []
    );
  } catch (error) {
    console.error('Error generating static params:', error);
    // Повертаємо базові ID для фейкових даних
    return [{ id: '1' }, { id: '2' }, { id: '3' }];
  }
}

interface CreativePageProps {
  params: {
    id: string;
  };
  searchParams: {
    related?: string;
  };
}

export default async function CreativePage({ params, searchParams }: CreativePageProps) {
  const ad = await getAdById(params.id);

  if (!ad) {
    notFound();
  }

  // Отримуємо related ads якщо є параметр related в URL
  let relatedAds = null;
  if (searchParams.related) {
    const relatedIds = searchParams.related.split(',');
    relatedAds = await getRelatedAdsByIds(relatedIds);
  }

  // Precompute parsing and grouped sections on the server to reduce client bundle work
  const { visualMainParagraphs, visualDerivedFromVideo } = getVisualParagraphs(ad as Ad);

  const rawScenarios = parseScenarios(ad as Ad);
  const adaptationScenarios = sanitizeScenarios(rawScenarios);

  const metaAnalysis = buildMetaAnalysis(ad as Ad, visualMainParagraphs);

  const groupedSections = buildGroupedSections(ad as Ad, metaAnalysis, adaptationScenarios);

  return (
    <Suspense fallback={<AdDetailsSkeleton />}>
      <AdDetails
        ad={ad}
        relatedAds={relatedAds}
        groupedSections={groupedSections}
        visualMainParagraphs={visualMainParagraphs}
        visualDerivedFromVideo={visualDerivedFromVideo}
        metaAnalysis={metaAnalysis}
        adaptationScenarios={adaptationScenarios as unknown as AdaptationScenario[]}
      />
    </Suspense>
  );
}
