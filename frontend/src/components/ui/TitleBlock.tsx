// src/components/ui/TitleBlock.tsx
import type { JSX } from "react/jsx-runtime";

export default function TitleBlock({
  title,
  contextId,
  deadline,
  children,
}: {
  title?: string;
  contextId?: string;
  deadline?: string | null;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-xs text-slate-500 mt-1">
        Context: <span className="font-mono">{contextId}</span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        Deadline:{" "}
        <span className="font-medium">{deadline ? new Date(deadline).toLocaleString() : "—"}</span>
      </div>

      {/* children used for the Approve/Deny/Rollback buttons area */}
      {children}
    </div>
  );
}
