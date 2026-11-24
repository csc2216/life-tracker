// crypto.randomUUID only exists in secure contexts (HTTPS / localhost);
// fall back so testing over LAN http still works.
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
