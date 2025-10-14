import type { JSX } from "react/jsx-runtime";

export default function DiffFileBody({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="p-4">{children}</div>;
}
