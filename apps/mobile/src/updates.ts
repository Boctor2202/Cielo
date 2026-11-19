import * as Updates from "expo-updates";

let shown = false;

/**
 * At launch, while the opening screen shows: fetch a newer update if there is one and restart on it at once,
 * so a fresh install (or an app not opened for a while) does not run the old code until the next launch.
 * The restart only happens while the opening screen is still up (see `launchReady`): once the app is on
 * screen, an update that arrives late is kept for the next launch instead of restarting the app a second time.
 * Gives up quietly offline, in development, or after a few seconds.
 */
export const launchReady: Promise<void> = (async () => {
  if (__DEV__ || !Updates.isEnabled) return;
  const work = (async () => {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const r = await Updates.fetchUpdateAsync();
    if (r.isNew && !shown) await Updates.reloadAsync();
  })();
  await Promise.race([work.catch(() => undefined), new Promise((res) => setTimeout(res, 3500))]);
})();

/** The app is on screen: from now on, a downloaded update waits for the next launch. */
export function markShown() {
  shown = true;
}

/** Which code the app runs: the update's id and date, or the build's own. */
export function runningVersion(): string {
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : "build";
  const at = Updates.createdAt ? Updates.createdAt.toISOString().slice(0, 16).replace("T", " ") : "";
  return [Updates.channel, id, at].filter(Boolean).join(" · ");
}
