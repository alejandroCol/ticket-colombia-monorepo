const STORAGE_KEY = 'tc_scan_validation_queue_v1';

export type PendingValidation = { ticketId: string; queuedAt: number };

export function readValidationQueue(): PendingValidation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingValidation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushValidationQueue(ticketId: string): void {
  const q = readValidationQueue();
  if (q.some((x) => x.ticketId === ticketId)) return;
  q.push({ ticketId, queuedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function removeFromValidationQueue(ticketId: string): void {
  const q = readValidationQueue().filter((x) => x.ticketId !== ticketId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function clearValidationQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}
