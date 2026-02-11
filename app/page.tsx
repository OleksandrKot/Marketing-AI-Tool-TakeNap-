import { getAdGroups, getAds, getUniquePages, getBusinesses } from './actions';
import { AdArchiveBrowser } from './ad-archive-browser/ad-archive-browser';

// Ensure this page is rendered dynamically at request time so counts and ads
// reflect the current database state instead of being statically captured at build time.
export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { business?: string } }) {
  console.log('🏠 Home page rendering...');

  const businessId = searchParams.business;
  console.log('🏢 Selected business:', businessId || 'All');

  // Get list of businesses for selector
  const businesses = await getBusinesses();
  console.log(`🏢 Found ${businesses.length} businesses`);

  // Try to fetch groups (new DB structure) filtered by business
  const selectedBiz = businessId || (businesses[0]?.id ?? undefined);
  const adGroups = await getAdGroups(selectedBiz, 100);
  console.log(`📦 getAdGroups returned ${adGroups.length} groups`);

  let initialAds;

  if (adGroups && adGroups.length > 0) {
    // Use group representatives
    console.log(`✅ Using ${adGroups.length} ad groups as initial data`);
    initialAds = adGroups.map((item) => item.representative);
    console.log(`📊 Extracted ${initialAds.length} representatives`);
  } else {
    // Fallback: fetch all ads using old method
    console.log('⚠️ No groups found, falling back to all ads');
    const raw = await getAds(undefined, undefined, undefined, undefined, undefined, selectedBiz);
    console.log(`📦 getAds returned:`, raw);
    // Safely extract the ads array whether the API returned an array directly
    // or an object that contains { data: [...] }.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractDataArray } = require('@/lib/core/utils');
    initialAds = extractDataArray(raw);
    console.log(`📊 Extracted ${initialAds.length} ads from getAds`);
  }

  const uniquePages = await getUniquePages(selectedBiz);
  console.log(`📄 Found ${uniquePages.length} unique pages`);
  console.log(`🎯 Final initialAds count: ${initialAds.length}`);

  return (
    <main className="min-h-screen">
      <AdArchiveBrowser
        key={selectedBiz}
        initialAds={initialAds}
        pages={uniquePages}
        businesses={businesses}
        selectedBusiness={selectedBiz}
      />
    </main>
  );
}
