export type DeletionStatus =
  | 'pending_verify'
  | 'pending'
  | 'executed'
  | 'rejected';

export interface DeletionRequestRecord {
  id: string;
  email: string;
  orderId: string | null;
  status: DeletionStatus;
  verifyTokenHash: string | null;
  requestedAt: Date;
  executeAfter: Date | null;
  executedAt: Date | null;
  resultMeta: Record<string, unknown> | null;
}

const byId = new Map<string, DeletionRequestRecord>();

export const memoryDeletions = {
  save(row: DeletionRequestRecord) {
    byId.set(row.id, row);
  },
  get(id: string) {
    return byId.get(id) ?? null;
  },
  list() {
    return [...byId.values()].sort(
      (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime(),
    );
  },
  findPendingByEmail(email: string) {
    return [...byId.values()].filter(
      (r) =>
        r.email.toLowerCase() === email.toLowerCase() &&
        (r.status === 'pending' || r.status === 'pending_verify'),
    );
  },
};
