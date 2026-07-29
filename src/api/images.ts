import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const BUCKET = 'meal-images';

/** Matches the bucket's own file_size_limit, so we fail early and clearly. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Long edge, in pixels. Plenty for a meal thumbnail; keeps uploads small. */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

/**
 * Uploads a meal photo and returns its storage path.
 *
 * The path is always `<user_id>/<uuid>.jpg`. That prefix is what the storage
 * RLS policies key on, and `food_entries.image_path` has a CHECK constraint
 * requiring the same prefix — so an image can only ever belong to its owner,
 * enforced in two independent places.
 *
 * Only the path is stored, never a URL: the bucket is private, and read access
 * goes through short-lived signed URLs.
 */
export async function uploadMealImage(userId: string, localUri: string): Promise<string> {
  // Re-encoding to JPEG normalises the format (so the MIME type we declare is
  // the MIME type the bytes actually are) and shrinks a 4MB camera capture to
  // a few hundred KB.
  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const processed = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });

  if (!processed.base64) {
    throw new AppError('We could not process that photo. Please try again.');
  }

  const bytes = decode(processed.base64);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError('That photo is too large. Please try a smaller one.');
  }

  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    // Never overwrite: a colliding path would mean clobbering another entry's
    // photo. A fresh UUID makes a collision effectively impossible anyway.
    upsert: false,
  });

  if (error) throw error;

  // The re-encoded temp file is no longer needed once it is uploaded. Uses the
  // File API rather than the legacy `deleteAsync`, which expo-file-system now
  // ships only as a stub that throws a migration error.
  // Best-effort: leaving a file in the cache directory is harmless, and the OS
  // reclaims it — never fail a saved meal over cleanup.
  try {
    new File(processed.uri).delete();
  } catch {
    // ignored
  }

  return path;
}

/**
 * Signed URL for displaying a stored image. The bucket is private, so this is
 * the only way to read one, and the link expires — it cannot be shared into a
 * permanent public URL.
 */
export async function getSignedImageUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

/** Best-effort cleanup so deleting an entry does not orphan its photo. */
export async function deleteMealImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
