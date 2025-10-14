// src/components/ui/Card.tsx
import type { JSX } from "react/jsx-runtime";

export default function Card({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="p-4 bg-white rounded-lg shadow-md">{children}</div>;
}
