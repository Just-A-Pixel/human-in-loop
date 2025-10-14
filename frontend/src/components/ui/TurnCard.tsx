// src/components/ui/TurnCard.tsx
import type { JSX } from "react/jsx-runtime";

export default function TurnCard({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="bg-slate-50 rounded-md p-4">{children}</div>;
}
