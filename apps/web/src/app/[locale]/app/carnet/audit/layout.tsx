import type { ReactNode } from "react";
import { Requires } from "@/lib/access";

/** Max plan only. */
export default function Layout({ children }: { children: ReactNode }) {
  return <Requires feature="audit">{children}</Requires>;
}
