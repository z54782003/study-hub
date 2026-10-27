"use client";

/** 可單選或多選的膠囊按鈕列 */
export function Chips<T extends string | number>({
  options,
  value,
  onToggle,
  label = (v) => String(v),
}: {
  options: readonly T[];
  value: readonly T[];
  onToggle: (v: T) => void;
  label?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={String(o)}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className={`h-9 min-w-11 rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${on ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="label mb-2">
        {title}
        {hint && <span className="ml-2 font-normal tracking-normal">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}
