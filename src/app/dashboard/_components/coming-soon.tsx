import Link from "next/link";

export default function ComingSoon({
  title,
  subtitle,
  features,
}: {
  title: string;
  subtitle: string;
  features: { title: string; desc: string }[];
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="anim-fade-up">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>{title}</h1>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}
          >
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>{subtitle}</p>
      </div>

      {/* Feature preview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`anim-fade-up d-${i + 1} rounded-xl border p-5`}
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}
            >
              {i + 1}
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{f.title}</h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        className="anim-fade-up d-4 flex flex-col items-start gap-3 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            This section is being built.
          </p>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-soft)" }}>
            Meanwhile, browse live roles on the Find Jobs page.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn-accent shrink-0 px-4 py-2 text-sm"
        >
          Go to Find Jobs
        </Link>
      </div>
    </div>
  );
}
