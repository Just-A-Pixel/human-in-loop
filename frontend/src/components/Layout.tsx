import React from "react";
import type { JSX } from "react/jsx-runtime";

export default function Layout(props: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">{props.children}</div>
    </div>
  );
}
