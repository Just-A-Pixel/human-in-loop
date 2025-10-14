import type { JSX } from "react/jsx-runtime";

export default function DetailPlaceholder({ children }: { children?: React.ReactNode }): JSX.Element {
  return <div className="bg-white rounded-lg p-6 shadow text-slate-500">{children ?? "Select an approval to view details."}</div>;
}
