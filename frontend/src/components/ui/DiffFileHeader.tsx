import type { JSX } from "react/jsx-runtime";

export default function DiffFileHeader({
  path,
  status,
}: {
  path: string;
  status?: string;
}): JSX.Element {
  return (
    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
      <div className="font-mono text-sm">{path}</div>
      <div className="text-xs text-slate-500">{status || ""}</div>
    </div>
  );
}
