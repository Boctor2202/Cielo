import type { ReactNode } from "react";
import { Requires } from "@/lib/access";

/** Needs a live subscription (or the demo): read-only otherwise. */
export default function Layout({ children }: { children: ReactNode }) {
  return <Requires write>{children}</Requires>;
}
