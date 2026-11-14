import { ldJson } from "@/lib/seo";

/** schema.org structured data for search engines. */
export function JsonLd({ nodes }: { nodes: object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(...nodes) }} />;
}
