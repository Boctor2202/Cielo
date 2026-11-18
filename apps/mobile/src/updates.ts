import * as Updates from "expo-updates";

/**
 * At launch, while the opening screen shows: fetch a newer update if there is one and restart on it at once,
 * so a fresh install (or an app not opened for a while) does not run the old code until the next launch.
 * Gives up quietly offline, in development, or after a few seconds.
 */
export async function applyUpdateAtLaunch(timeoutMs = 6000): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  const work = (async () => {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const r = await Updates.fetchUpdateAsync();
    if (r.isNew) await Updates.reloadAsync();
  })();
  await Promise.race([work.catch(() => undefined), new Promise((res) => setTimeout(res, timeoutMs))]);
}

/** Which code the app runs: the update's id and date, or the build's own. */
export function runningVersion(): string {
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : "build";
  const at = Updates.createdAt ? Updates.createdAt.toISOString().slice(0, 16).replace("T", " ") : "";
  return [Updates.channel, id, at].filter(Boolean).join(" · ");
}
