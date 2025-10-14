// src/components/ui/TurnHeader.tsx
import type { JSX } from "react/jsx-runtime";

export default function TurnHeader({ role, index }: { role?: string; index: number }): JSX.Element {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-slate-400 uppercase">{role ?? "assistant"}</div>
      <div className="text-xs text-slate-400">turn #{index + 1}</div>
    </div>
  );
}
