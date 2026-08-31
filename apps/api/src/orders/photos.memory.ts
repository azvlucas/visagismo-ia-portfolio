import type { PhotoType } from '@visagismo/shared';

export interface PhotoRecord {
  id: string;
  orderId: string;
  type: PhotoType;
  r2Key: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  expectedBytes: number;
}

const photosById = new Map<string, PhotoRecord>();
const photosByOrder = new Map<string, Set<string>>();

export const memoryPhotos = {
  save(photo: PhotoRecord) {
    photosById.set(photo.id, photo);
    const set = photosByOrder.get(photo.orderId) ?? new Set();
    set.add(photo.id);
    photosByOrder.set(photo.orderId, set);
  },

  getById(id: string): PhotoRecord | null {
    return photosById.get(id) ?? null;
  },

  listByOrder(orderId: string): PhotoRecord[] {
    const set = photosByOrder.get(orderId);
    if (!set) return [];
    return [...set]
      .map((id) => photosById.get(id))
      .filter((p): p is PhotoRecord => Boolean(p));
  },

  /** Replace same type for order (keep one frontal/lateral). */
  removeType(orderId: string, type: PhotoType, exceptId?: string) {
    for (const p of this.listByOrder(orderId)) {
      if (p.type === type && p.id !== exceptId) {
        photosById.delete(p.id);
        photosByOrder.get(orderId)?.delete(p.id);
      }
    }
  },
};
