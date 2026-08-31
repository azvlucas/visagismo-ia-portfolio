export interface CostLogRecord {
  id: string;
  orderId: string;
  phase: 'analysis' | 'image' | 'thumb';
  provider: string;
  modelId: string;
  costUsdMicros: number;
  latencyMs: number;
  createdAt: Date;
}

const logs: CostLogRecord[] = [];

export const memoryCostLogs = {
  add(row: CostLogRecord) {
    logs.push(row);
  },
  list(limit = 100) {
    return logs.slice(-limit).reverse();
  },
  byOrder(orderId: string) {
    return logs.filter((l) => l.orderId === orderId);
  },
  totals() {
    const byProvider: Record<
      string,
      { count: number; costUsdMicros: number; avgLatencyMs: number }
    > = {};
    for (const l of logs) {
      const key = `${l.provider}`;
      const cur = byProvider[key] ?? {
        count: 0,
        costUsdMicros: 0,
        avgLatencyMs: 0,
      };
      cur.count += 1;
      cur.costUsdMicros += l.costUsdMicros;
      cur.avgLatencyMs += l.latencyMs;
      byProvider[key] = cur;
    }
    for (const k of Object.keys(byProvider)) {
      const row = byProvider[k]!;
      row.avgLatencyMs = Math.round(row.avgLatencyMs / Math.max(1, row.count));
    }
    return {
      totalCostUsdMicros: logs.reduce((s, l) => s + l.costUsdMicros, 0),
      totalCalls: logs.length,
      byProvider,
    };
  },
};
