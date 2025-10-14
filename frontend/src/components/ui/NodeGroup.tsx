import type { JSX } from "react/jsx-runtime";

export default function NodeGroup({ title, children }: { title?: string; children?: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-3">
      {title && <div className="text-sm font-semibold mb-1">{title}</div>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
