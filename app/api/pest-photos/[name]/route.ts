import { readPestPhoto } from "@/app/lib/pestPhotos"
import { getCurrentUser } from "@/app/lib/session"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const current = getCurrentUser()
  if (!current || current.blocked) return new Response("Sign in to view saved photos", { status: current ? 403 : 401 })
  const photo = readPestPhoto(params.name)
  if (!photo) return new Response("Photo not found", { status: 404 })
  return new Response(new Uint8Array(photo.bytes), { headers: {
    "Content-Type": photo.contentType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  } })
}
