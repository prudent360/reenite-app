/**
 * The largest file anyone can upload. Uploads pass through this website, and Vercel refuses
 * requests over 4.5MB, so this stays well under that. The API has the same number in
 * api/app/Uploads/UploadLimit.php.
 */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "3MB";

/** A message for a file that is too big, or null when it fits. */
export function uploadTooLarge(file: File, what = "Files"): string | null {
  return file.size > MAX_UPLOAD_BYTES ? `${what} must be ${MAX_UPLOAD_LABEL} or smaller.` : null;
}
