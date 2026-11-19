"use client";

import { useEffect } from "react";

const APP = "geardown://account";

/** Opens the app on its account screen (the in-app browser closes on it); a button in case it does not. */
export function BackToApp({ fr }: { fr: boolean }) {
  useEffect(() => {
    window.location.replace(APP);
  }, []);
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center text-text">
      <div className="space-y-4">
        <p className="text-lg font-semibold">{fr ? "Retour dans l'app Geardown…" : "Back to the Geardown app…"}</p>
        <a href={APP} className="btn btn-primary">{fr ? "Ouvrir l'app" : "Open the app"}</a>
      </div>
    </main>
  );
}
