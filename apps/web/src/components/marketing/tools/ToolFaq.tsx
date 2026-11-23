/** The questions under a tool, as plain HTML (read by search engines and AI assistants as is). */
export function ToolFaq({ items, title }: { items: { q: string; a: string }[]; title: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-6 space-y-6">
        {items.map((i) => (
          <div key={i.q}>
            <h3 className="font-semibold">{i.q}</h3>
            <p className="mt-1.5 leading-relaxed text-muted">{i.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
