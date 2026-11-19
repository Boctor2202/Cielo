/** Tells the app new flights were added (typed or imported), so it can show what they brought to the logbook. */
type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();

export function onGains(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export function announceGains(ids: string[]) {
  if (!ids.length) return;
  // after the save has reached the local database and the modal has closed
  setTimeout(() => listeners.forEach((l) => l(ids)), 450);
}
