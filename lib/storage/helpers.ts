export const getPublicImageUrl = (imagePath: string) => {
  if (!imagePath) return '';

  try {
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) return imagePath;

    // If it's a storage path, construct the full URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) return imagePath;

    // Remove any leading slashes
    const cleanPath = imagePath.replace(/^\/+/, '');

    // Return the full storage URL
    return `${baseUrl}/storage/v1/object/public/${cleanPath}`;
  } catch (e) {
    console.error('Error constructing storage URL:', e);
    return imagePath;
  }
};

// Helper to check if a URL is a Supabase storage URL
export const isStorageUrl = (url: string) => {
  if (!url) return false;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url.startsWith(`${baseUrl}/storage/v1/object/public/`);
  } catch (e) {
    return false;
  }
};

/**
 * Построить путь к файлу в бакете creatives
 * @param businessSlug - slug бизнеса из таблицы businesses
 * @param adArchiveId - ad_archive_id объявления
 * @param ext - расширение файла (jpg, mp4, png, и т.д.)
 * @returns путь вида "businessSlug/adArchiveId.ext"
 */
export const buildCreativePath = (businessSlug: string, adArchiveId: string, ext: string) => {
  return `${businessSlug}/${adArchiveId}.${ext}`;
};

/**
 * Get full storage URL for creative
 * @param businessSlug - slug бизнеса
 * @param adArchiveId - ad_archive_id
 * @param ext - расширение файла
 * @returns полный URL вида "https://.../storage/v1/object/public/creatives/slug/id.ext"
 */
export const getCreativeUrl = (businessSlug: string, adArchiveId: string, ext: string) => {
  const bucket = process.env.NEXT_PUBLIC_AD_BUCKET || 'creatives';
  const path = buildCreativePath(businessSlug, adArchiveId, ext);
  return getPublicImageUrl(`${bucket}/${path}`);
};

/**
 * Try to find media with different extensions
 * @param businessSlug - slug бизнеса
 * @param adArchiveId - ad_archive_id
 * @param preferVideo - предпочитать видео если true
 * @returns объект с путями для разных форматов
 */
export const getCreativeMediaPaths = (
  businessSlug: string,
  adArchiveId: string,
  preferVideo = false
) => {
  const bucket = process.env.NEXT_PUBLIC_AD_BUCKET || 'creatives';
  const imageExts = ['jpg', 'jpeg', 'png', 'webp'];
  const videoExts = ['mp4', 'mov', 'webm'];

  return {
    bucket,
    imagePaths: imageExts.map((ext) => buildCreativePath(businessSlug, adArchiveId, ext)),
    videoPaths: videoExts.map((ext) => buildCreativePath(businessSlug, adArchiveId, ext)),
    preferVideo,
  };
};
