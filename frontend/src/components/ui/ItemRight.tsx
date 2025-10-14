import type { JSX } from "react/jsx-runtime";

export default function ItemRight({ deadline }: { deadline?: string | null }): JSX.Element {
  return (
    <div className="text-right">
      <div className="text-xs text-slate-400">Deadline</div>
      <div className="mt-1 text-sm font-medium text-red-600">
        {deadline ? new Date(deadline).toLocaleString() : "—"}
      </div>
    </div>
  );
}
