import type { JSX } from "react/jsx-runtime";

export default function FormContainer({ title, children }: { title?: string; children?: React.ReactNode }): JSX.Element {
  return (
    <form className="space-y-3 p-3 bg-white rounded-md border" onSubmit={(e) => e.preventDefault()}>
      {title && <div className="text-sm font-semibold">{title}</div>}
      {children}
    </form>
  );
}
