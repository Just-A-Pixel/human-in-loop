// src/components/ui/TurnsContainer.tsx
import type { JSX } from "react/jsx-runtime";

export default function TurnsContainer({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="space-y-6">{children}</div>;
}
