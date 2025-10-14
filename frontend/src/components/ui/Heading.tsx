import type { JSX } from "react/jsx-runtime";

export default function Heading({ children }: { children: React.ReactNode }): JSX.Element {
  return <h2 className="text-lg font-semibold mb-4">{children}</h2>;
}
