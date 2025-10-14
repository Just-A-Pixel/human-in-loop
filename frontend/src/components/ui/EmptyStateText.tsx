import type { JSX } from "react/jsx-runtime";

export default function EmptyStateText({ text }: { text: string }): JSX.Element {
  return <div className="text-sm text-slate-500">{text}</div>;
}
