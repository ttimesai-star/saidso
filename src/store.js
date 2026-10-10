// "My receipts": receipts sealed in this browser, newest first.
export const LIST_SLOT = 'saidso.receipts.v1';
export const LIST_CAP = 200;

export function listReceipts(storage) {
  if (!storage) return [];
  try {
    const v = JSON.parse(storage.getItem(LIST_SLOT) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function save(storage, list) {
  try { storage.setItem(LIST_SLOT, JSON.stringify(list)); return true; } catch { return false; }
}

/** entry = {number, receipt}; returns false if storage is unavailable or full. */
export function addReceipt(storage, entry) {
  if (!storage) return false;
  const list = listReceipts(storage).filter((e) => e.number !== entry.number);
  list.unshift(entry);
  return save(storage, list.slice(0, LIST_CAP));
}

export function removeReceipt(storage, number) {
  if (!storage) return false;
  return save(storage, listReceipts(storage).filter((e) => e.number !== number));
}

/** In-memory stand-in with the localStorage interface (tests, blocked storage). */
export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
