export const CANDIDATE_LEDGER_CHUNK_SIZE = 500;

export function candidateLedgerChunkCount(itemCount: number): number {
  return Math.ceil(itemCount / CANDIDATE_LEDGER_CHUNK_SIZE);
}

export function candidateLedgerChunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += CANDIDATE_LEDGER_CHUNK_SIZE) {
    result.push(items.slice(index, index + CANDIDATE_LEDGER_CHUNK_SIZE));
  }
  return result;
}

export function stableCandidateJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableCandidateJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableCandidateJson(item)}`)
    .join(",")}}`;
}
