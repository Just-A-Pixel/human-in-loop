import type { JSX } from "react/jsx-runtime";

export default function DefaultNode({ title, text, children }: { title?: string; text?: string; children?: React.ReactNode }): JSX.Element {
  return (
    <div>
      {title && <div className="font-medium">{title}</div>}
      {text && <div className="whitespace-pre-wrap">{text}</div>}
      <div>{children}</div>
    </div>
  );
}
