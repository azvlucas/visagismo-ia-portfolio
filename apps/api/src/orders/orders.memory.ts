import type { OrderRecord } from './order.types.js';

/** Process-local store for local/dev when Postgres is unavailable. */
const ordersById = new Map<string, OrderRecord>();
const ordersByTokenHash = new Map<string, string>();

export const memoryOrders = {
  save(order: OrderRecord) {
    ordersById.set(order.id, order);
    ordersByTokenHash.set(order.accessTokenHash, order.id);
  },

  getById(id: string): OrderRecord | null {
    return ordersById.get(id) ?? null;
  },

  getByTokenHash(hash: string): OrderRecord | null {
    const id = ordersByTokenHash.get(hash);
    if (!id) return null;
    return ordersById.get(id) ?? null;
  },

  update(id: string, mutator: (order: OrderRecord) => OrderRecord): OrderRecord | null {
    const current = ordersById.get(id);
    if (!current) return null;
    const next = mutator({ ...current });
    ordersById.set(id, next);
    if (next.accessTokenHash !== current.accessTokenHash) {
      ordersByTokenHash.delete(current.accessTokenHash);
      ordersByTokenHash.set(next.accessTokenHash, id);
    }
    return next;
  },

  listAll(): OrderRecord[] {
    return [...ordersById.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  },
};
