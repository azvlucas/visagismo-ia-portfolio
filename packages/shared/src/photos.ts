import { z } from 'zod';

export const PHOTO_TYPES = ['frontal', 'lateral', 'extra'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export const PHOTO_TYPE_LABELS_PT: Record<PhotoType, string> = {
  frontal: 'Foto frontal',
  lateral: 'Foto lateral',
  extra: 'Foto extra',
};

export const ALLOWED_PHOTO_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedPhotoMime = (typeof ALLOWED_PHOTO_MIMES)[number];

/** 10 MB */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Soft minimum dimension on the shorter side */
export const MIN_PHOTO_EDGE_PX = 512;

export const presignPhotoSchema = z.object({
  type: z.enum(PHOTO_TYPES),
  mime: z.enum(ALLOWED_PHOTO_MIMES),
  bytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
  filename: z.string().max(200).optional(),
});

export type PresignPhotoInput = z.infer<typeof presignPhotoSchema>;

export const confirmPhotoSchema = z.object({
  photoId: z.string().uuid(),
});

export type ConfirmPhotoInput = z.infer<typeof confirmPhotoSchema>;
