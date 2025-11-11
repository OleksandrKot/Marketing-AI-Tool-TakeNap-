import { getAds, getUniquePages } from './actions';
import { AdArchiveBrowser } from './ad-archive-browser/ad-archive-browser';

// Ensure this page is rendered dynamically at request time so counts and ads
// reflect the current database state instead of being statically captured at build time.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const raw = await getAds();
  // Safely extract the ads array whether the API returned an array directly
  // or an object that contains { data: [...] }.
  // We import the utility lazily to avoid server/client import ordering issues.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extractDataArray } = require('@/lib/utils');
  const initialAds = extractDataArray(raw);
  const uniquePages = await getUniquePages();

  return (
    <main className="min-h-screen">
      <AdArchiveBrowser initialAds={initialAds} pages={uniquePages} />
    </main>
  );
}
