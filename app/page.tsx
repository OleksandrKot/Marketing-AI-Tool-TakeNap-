import { getAds, getUniquePages } from "./actions"
import { AdArchiveBrowser } from "./ad-archive-browser/ad-archive-browser"

export default async function Home() {
  const initialAds = await getAds()
  const uniquePages = await getUniquePages()

  return (
    <main className="min-h-screen">
      <AdArchiveBrowser initialAds={initialAds} pages={uniquePages} />
    </main>
  )
}
