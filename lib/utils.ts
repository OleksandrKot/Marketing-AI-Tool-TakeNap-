// Lightweight, dependency-free `cn` helper.
// We avoid importing `clsx` / `tailwind-merge` here to prevent runtime
// interop issues during the Next.js server build. This function merges
// className inputs safely and returns a single string.
export function cn(...inputs: any[]) {
  return inputs
    .flat(Infinity)
    .filter(Boolean)
    .map(String)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return ""
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
}
