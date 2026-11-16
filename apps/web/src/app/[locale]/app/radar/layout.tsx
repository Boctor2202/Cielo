import type { ReactNode } from "react";
import { Requires } from "@/lib/access";
import { FeatureOff } from "@/components/app/FeatureOff";

/** Max plan only. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <FeatureOff flag="radar">
      <Requires feature="radar">{children}</Requires>
    </FeatureOff>
  );
}
