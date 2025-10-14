import type { JSX } from "react/jsx-runtime";

export default function DetailColumn({ children }: { children: React.ReactNode }): JSX.Element {
  return <div>{children}</div>;
}
