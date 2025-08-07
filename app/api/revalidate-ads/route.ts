import { type NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export async function POST(request: NextRequest) {
  // Опціонально: додайте перевірку API ключа, щоб тільки Make.com міг викликати цей endpoint
  // const apiKey = request.headers.get("x-api-key")
  // if (apiKey !== process.env.MAKE_API_KEY) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // }

  try {
    // Ревалідуємо головну сторінку, щоб вона завантажила нові дані з Supabase
    revalidatePath("/")

    return NextResponse.json({ revalidated: true, now: Date.now() })
  } catch (err) {
    return NextResponse.json({ revalidated: false, message: "Error revalidating" }, { status: 500 })
  }
}
