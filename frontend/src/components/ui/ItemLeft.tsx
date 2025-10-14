import type { JSX } from "react/jsx-runtime";

export default function ItemLeft({ contextId, title }: { contextId?: string; title?: string }): JSX.Element {
  return (
    <div>
      <div className="text-xs text-slate-500">Context</div>
      <div className="font-mono text-sm">{contextId}</div>
      <div className="mt-2 font-medium text-slate-800">{title}</div>
    </div>
  );
}
