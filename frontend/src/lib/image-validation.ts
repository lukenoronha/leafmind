const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export const ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',')

/** Shared client-side validation for leaf image uploads — used by both the
 * chat "+" attach button and (historically) the standalone ImageUploader
 * dropzone, so the accepted types/size limit stay in one place. */
export function validateLeafImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported file type. Upload a JPEG, PNG, or WEBP image.'
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image is too large. Maximum size is 10 MB.'
  }
  return null
}
