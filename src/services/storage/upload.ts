import { createClient } from '@supabase/supabase-js'

const BUCKET = 'user-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[mimeType] || 'jpg'
}

/**
 * Upload an image to Supabase Storage and return the public URL.
 */
export async function uploadImage(
  projectId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }

  if (buffer.length > MAX_SIZE) {
    throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Max: 5MB`)
  }

  const supabase = getServiceSupabase()
  const ext = getExtension(mimeType)
  const uniqueId = crypto.randomUUID()
  const path = `${projectId}/${uniqueId}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
