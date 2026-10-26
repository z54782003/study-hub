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
            className={`min-w-11 rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent text-white" : "border-line bg-card"}`}
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
      <h2 className="mb-2 text-sm font-semibold">
        {title}
        {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}
