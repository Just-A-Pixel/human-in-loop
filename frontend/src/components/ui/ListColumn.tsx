import type { JSX } from "react/jsx-runtime";

export default function ListColumn({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="space-y-3">{children}</div>;
}
