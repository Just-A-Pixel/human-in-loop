import type { JSX } from "react/jsx-runtime";

export default function BoundaryBox({ title, children }: { title?: string; children?: React.ReactNode }): JSX.Element {
  return (
    <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
      {title && <div className="text-sm font-semibold mb-2 text-slate-600">{title}</div>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
