import { Redirect } from "expo-router";

/** The centre "+" tab: never shown as a screen, its button opens the new-flight form. */
export default function NewFlightTab() {
  return <Redirect href="/flight/new" />;
}
