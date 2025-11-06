import { getAds, getUniquePages } from './actions';
import { AdArchiveBrowser } from './ad-archive-browser/ad-archive-browser';

// Ensure this page is rendered dynamically at request time so counts and ads
// reflect the current database state instead of being statically captured at build time.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialAds = await getAds();
  const uniquePages = await getUniquePages();

  return (
    <main className="min-h-screen">
      <AdArchiveBrowser initialAds={initialAds} pages={uniquePages} />
    </main>
  );
}
