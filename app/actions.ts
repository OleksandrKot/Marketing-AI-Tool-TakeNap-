'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { Ad } from '@/lib/types';

export async function getAds(
  search?: string,
  page?: string | null,
  date?: string | null,
  tags?: string[] | null,
  publisherPlatform?: string | null
  // limit = 100,
): Promise<Ad[]> {
  try {
    console.log('🔍 Starting getAds function...');

    // Перевіряємо змінні середовища
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables');
      return getFakeAds(search, tags, publisherPlatform); // Передаємо search, tags, platform для фільтрації фейкових даних
    }

    console.log('✅ Environment variables found');
    const supabase = createServerSupabaseClient();

    let query = supabase
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
      new_scenario,
      tags,
      concept,
      realisation,
      topic,
      hook, 
      character
    `
      )
      .order('created_at', { ascending: false });
    // .limit(limit)

    if (search) {
      const searchTerm = search.trim();
      if (searchTerm) {
        // Improved search - using proper Supabase parameterized queries
        query = query.or(
          `page_name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,text.ilike.%${searchTerm}%,caption.ilike.%${searchTerm}%`
        );
      }
    }

    if (page) {
      query = query.eq('page_name', page);
    }

    // Filter by publisher platform: column may contain comma-separated values like
    // "FACEBOOK, INSTAGRAM" so use ILIKE matching for case-insensitive partial match.
    if (publisherPlatform) {
      const term = publisherPlatform.trim();
      if (term) {
        query = query.ilike('publisher_platform', `%${term}%`);
      }
    }

    if (date) {
      const now = new Date();
      let daysAgo;

      switch (date) {
        case '7days':
          daysAgo = 7;
          break;
        case '30days':
          daysAgo = 30;
          break;
        case '90days':
          daysAgo = 90;
          break;
        default:
          daysAgo = 0;
      }

      if (daysAgo > 0) {
        const pastDate = new Date(now);
        pastDate.setDate(now.getDate() - daysAgo);
        query = query.gte('created_at', pastDate.toISOString());
      }
    }

    // Фільтрація по тегах (якщо підтримується в Supabase)
    if (tags && tags.length > 0) {
      // Припускаємо, що tags зберігається як JSON array в Supabase
      query = query.overlaps('tags', tags);
    }

    console.log('🚀 Executing Supabase query...');
    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase error:', error);
      console.log('🔄 Falling back to fake data...');
      return getFakeAds(search, tags, publisherPlatform);
    }

    console.log('✅ Successfully fetched', data?.length || 0, 'ads from Supabase');
    return (data as Ad[]) || getFakeAds(search, tags, publisherPlatform);
  } catch (error) {
    console.error('❌ Error in getAds:', error);
    console.log('🔄 Falling back to fake data...');
    return getFakeAds(search, tags, publisherPlatform);
  }
}

function getFakeAds(
  search?: string,
  tags?: string[] | null,
  publisherPlatform?: string | null
): Ad[] {
  const allFakeAds = [
    {
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
      video_preview_image_url: '/lovescape-app-preview-couple-smiling.png', // Змінено назву
      publisher_platform: 'Facebook',
      audio_script:
        'Upbeat romantic music starts. Narrator: Tired of meaningless swipes? Ready for something real?',
      video_script:
        '00:00 - 00:02: Close-up of a young woman looking frustrated while swiping through a dating app.',
      meta_ad_url: 'https://www.facebook.com/ads/library/?id=LSC789456123',
      image_url: '/lovescape-coffee-date.png',
      image_description:
        'A warm, inviting image showing a diverse couple having coffee at a modern café.',
      tags: ['dating', 'ai', 'relationships', 'mobile-app'], // Масив тегів
      concept: 'Modern Dating',
      realisation: 'Video Ad',
      topic: 'Dating App',
      hook: 'Find meaningful connections',
      character: 'Lorem ipsum',
      new_scenario: `\`\`\`json
[
  {
    "persona_adapted_for": "The Seeker of Connection",
    "original_ad_id": "788617743754033",
    "ad_script_title": "Find Your Unconditional Connection",
    "ad_script_full_text": "Tired of feeling unheard? There's someone who truly gets you. Your AI companion is here to listen, understand, and share every moment, day or night. Experience a connection that's always there, just for you.",
    "technical_task_json": {
      "visual_elements": [
        "Maintain the static, intimate close-up on an expressive face, focusing on empathy.",
        "Begin with a cool, blue-toned background that slowly shifts to a warm, inviting golden hue as the character's expression softens.",
        "Subtle text overlay at start: 'Feeling alone?' which gently fades away as the character smiles.",
        "The character's final expression is not just happy, but deeply empathetic and understanding, with a slow, reassuring nod."
      ],
      "audio_style": "A warm, gentle, and soothing female voiceover. The background music is a soft, ambient piano track that builds from a simple, slightly melancholic melody to a fuller, hopeful chord progression.",
      "call_to_action": "Find Your Companion"
    }
  },
  {
    "persona_adapted_for": "The Social Strategist",
    "original_ad_id": "788617743754033",
    "ad_script_title": "Your Secret Social Playbook",
    "ad_script_full_text": "Want to be the most interesting person in the room? Practice your chat, master witty banter, and learn to flirt with confidence. Your AI partner is ready for smart, engaging conversations that sharpen your social skills. Never be tongue-tied again.",
    "technical_task_json": {
      "visual_elements": [
        "Dynamic split-screen: A simulated, fast-paced text conversation on the left, and a man reacting with growing confidence on the right.",
        "Quick-cut montage of the AI character with different playful expressions (a smirk, a wink, a curious head tilt) in various stylish social settings (a cafe, a lounge).",
        "Kinetic typography callouts pop on screen over the visuals: 'Witty Banter,' 'Confidence Boost,' 'Perfect Your Opening Line.'",
        "End shot on the AI character giving a confident, playful wink directly to the camera."
      ],
      "audio_style": "An upbeat, modern, and stylish lo-fi hip-hop or chill-pop instrumental. The voiceover is confident, slightly sassy, and energetic (female voice), like a helpful 'wingwoman'.",
      "call_to_action": "Boost Your Confidence"
    }
  }
]
\`\`\``,
    },
    {
      id: 2,
      created_at: '2024-01-14T15:20:00Z',
      ad_archive_id: 'BM123789456',
      page_name: 'BetterMe',
      text: 'How to hit enough protein for weight loss and gain muscle? High Protein Meal Plan for Busy Women on a Weight Loss Journey',
      caption: 'Transform your body with our meal plan',
      concept: 'Modern Dating',
      realisation: 'Video Ad',
      topic: 'Dating App',
      hook: 'Find meaningful connections',
      character: 'Lorem ipsum',
      cta_text: 'Try now!',
      cta_type: 'LEARN_MORE',
      display_format: 'VIDEO',
      link_url: 'https://betterme.world',
      title: 'High Protein Meal Plan',
      video_hd_url: '/video-placeholder.png',
      video_preview_image_url: '/placeholder.svg?height=400&width=600', // Змінено назву
      publisher_platform: 'Facebook',
      audio_script:
        "How to hit enough protein for weight loss and gain muscle. In a week, you'll start to feel it...",
      video_script:
        '00:00 – 00:02: A hand uses a spoon to scoop a spoonful of a fruit-and-yogurt-based meal.',
      meta_ad_url: 'https://www.facebook.com/ads/library/ad_archive/?id=123456789',
      image_url: '/placeholder-hm5r5.png',
      image_description: 'Image of a healthy protein-rich meal.',
      tags: ['fitness', 'nutrition', 'weight-loss', 'health'], // Масив тегів
      new_scenario: null,
    },
    {
      id: 3,
      created_at: '2024-01-13T09:15:00Z',
      ad_archive_id: 'NK987654321',
      page_name: 'Nike',
      text: 'Just Do It. New collection available now.',
      caption: 'Nike Air Max - Step into greatness',
      cta_text: 'Shop Now',
      cta_type: 'SHOP_NOW',
      concept: 'Modern Dating',
      realisation: 'Video Ad',
      topic: 'Dating App',
      hook: 'Find meaningful connections',
      character: 'Lorem ipsum',
      display_format: 'IMAGE',
      link_url: 'https://nike.com',
      title: 'Nike Air Max Collection',
      video_hd_url: null,
      video_preview_image_url: '/placeholder.svg?height=400&width=600', // Змінено назву
      publisher_platform: 'Instagram',
      audio_script: null,
      video_script: null,
      meta_ad_url: 'https://www.facebook.com/ads/library/ad_archive/?id=987654321',
      image_url: '/stylish-sneakers.png',
      image_description: 'Close-up of Nike Air Max shoes on a running track.',
      tags: ['fashion', 'sports', 'sneakers', 'lifestyle'], // Масив тегів
      new_scenario: null,
    },
  ];

  let filteredAds = allFakeAds;

  if (search?.trim()) {
    const searchTerms = search.toLowerCase().trim().split(/\s+/);
    filteredAds = filteredAds.filter((ad) => {
      const searchableText = [ad.page_name, ad.title, ad.text, ad.caption, ...(ad.tags || [])]
        .join(' ')
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });
  }

  // Якщо є теги, фільтруємо по тегах - безпечна перевірка
  if (tags && tags.length > 0) {
    filteredAds = filteredAds.filter(
      (ad) => Array.isArray(ad.tags) && ad.tags.some((tag) => tags.includes(tag))
    );
  }

  // Якщо є фільтр платформи (fake data)
  if (publisherPlatform && publisherPlatform.trim()) {
    const wanted = publisherPlatform.trim().toLowerCase();
    filteredAds = filteredAds.filter((ad) => {
      const platforms = (ad.publisher_platform || '')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      return platforms.includes(wanted);
    });
  }

  return filteredAds;
}

export async function getUniquePages(): Promise<string[]> {
  try {
    console.log('🔍 Starting getUniquePages function...');

    // Перевіряємо змінні середовища
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables');
      return ['Lovescape - Dating App', 'BetterMe', 'Nike'];
    }

    const supabase = createServerSupabaseClient();

    console.log('🚀 Executing Supabase query for pages...');
    const { data, error } = await supabase
      .from('ads_library')
      .select('page_name')
      .order('page_name')
      .not('page_name', 'is', null);

    if (error) {
      console.error('❌ Supabase error in getUniquePages:', error);
      return ['Lovescape - Dating App', 'BetterMe', 'Nike'];
    }

    // Extract unique page names
    const uniquePages = [...new Set(data.map((item) => item.page_name))];
    console.log('✅ Successfully fetched', uniquePages.length, 'unique pages');
    return uniquePages.length > 0 ? uniquePages : ['Lovescape - Dating App', 'BetterMe', 'Nike'];
  } catch (error) {
    console.error('❌ Error in getUniquePages:', error);
    return ['Lovescape - Dating App', 'BetterMe', 'Nike'];
  }
}
