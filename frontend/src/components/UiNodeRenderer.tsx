import React, { useMemo, useState } from "react";
import ChatBox from "./ChatBox";
import UnifiedDiffRenderer from "./UnifiedDiffRenderer";
// import DiffViewer from "./DiffViewer";

export type FieldDef = {
  id: string;
  type: "choice" | "textarea" | "text" | "number" | "checkbox";
  label?: string;
  options?: string[];
  required?: boolean;
};

export type UiNode = {
  render_type: string;
  id?: string;
  title?: string;
  text?: string;
  diff_text?: string;
  base?: string;
  target?: string;
  fields?: FieldDef[];
  children?: UiNode[];
  [k: string]: any;
};

export type UiNodeRendererProps = {
  node: UiNode;
  // path used to build unique field ids / submission keys, e.g. "turn0.groupA.form1"
  path?: string;
  // callback when a form inside this node is submitted: (formId, values, meta)
  onFormSubmit?: (formId: string, values: Record<string, any>, meta?: any) => void;
};

export default function UiNodeRenderer({ node, path = "", onFormSubmit }: UiNodeRendererProps) {
  const nodePath = node.id ? `${path}${path ? "." : ""}${node.id}` : path;

  switch (node.render_type) {
    case "chat-box":
      console.log(node)
      return <ChatBox text={node.text ?? ""} />;

    case "diff":
      return <UnifiedDiffRenderer diffText={node.diff_text || ""} />;
      

    case "form":
      return (
        <FormNode
          node={node}
          path={nodePath}
          onSubmit={(values, meta) => onFormSubmit?.(node.id ?? nodePath, values, meta)}
        />
      );

    case "group":
    case "section":
      return (
        <div className="space-y-3">
          {node.title && <div className="text-sm font-semibold mb-1">{node.title}</div>}
          <div className="space-y-4">
            {(node.children || []).map((child: UiNode, i: number) => (
              <UiNodeRenderer key={child.id ?? i} node={child} path={nodePath} onFormSubmit={onFormSubmit} />
            ))}
          </div>
        </div>
      );

      case "boundary":
       return (
         <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
           {node.title && <div className="text-sm font-semibold mb-2 text-slate-600">{node.title}</div>}
           <div className="space-y-3">
             {(node.children || []).map((child: UiNode, i: number) => (
               <UiNodeRenderer
                 key={child.id ?? i}
                 node={child}
                 path={nodePath}
                 onFormSubmit={onFormSubmit}
               />
             ))}
           </div>
         </div>
       );     

    // add more container render types e.g. 'accordion', 'tabs', 'list'
    default:
      // unknown node: render text if present or render children
      return (
        <div>
          {node.title && <div className="font-medium">{node.title}</div>}
          {node.text && <div className="whitespace-pre-wrap">{node.text}</div>}
          {(node.children || []).map((c, i) => (
            <UiNodeRenderer key={c.id ?? i} node={c} path={nodePath} onFormSubmit={onFormSubmit} />
          ))}
        </div>
      );
  }
}

/** Simple form node component (no external libs) */
function FormNode({ node, path, onSubmit }: { node: UiNode; path: string; onSubmit: (values: Record<string, any>, meta?: any) => void }) {
  const fields: FieldDef[] = node.fields ?? [];
  // initialize state with empty values
  const [values, setValues] = useState<Record<string, any>>(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.id]: "" }), {})
  );
  const uid = path || node.id || "form";

  function setField(id: string, v: any) {
    setValues((p) => ({ ...p, [id]: v }));
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    // basic required validation
    const missing = fields.filter((f) => f.required && !values[f.id]);
    if (missing.length) {
      alert(`Please fill: ${missing.map((m) => m.id).join(", ")}`);
      return;
    }
    // build submission payload with fully-qualified keys
    const payload: Record<string, any> = {};
    for (const f of fields) {
      payload[`${uid}.${f.id}`] = values[f.id];
    }
    onSubmit(payload, { formId: node.id ?? uid });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-white rounded-md border">
      {node.title && <div className="text-sm font-semibold">{node.title}</div>}
      {fields.map((f) => {
        const fid = `${uid}.${f.id}`;
        const val = values[f.id] ?? "";
        if (f.type === "choice") {
          return (
            <div key={fid}>
              <label className="block text-sm font-medium">{f.label ?? f.id}</label>
              <div className="flex gap-3 mt-2">
                {(f.options || []).map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-2">
                    <input type="radio" name={fid} checked={val === opt} onChange={() => setField(f.id, opt)} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        } else if (f.type === "textarea") {
          return (
            <div key={fid}>
              <label className="block text-sm font-medium">{f.label ?? f.id}</label>
              <textarea value={val} onChange={(e) => setField(f.id, e.target.value)} className="w-full rounded-md border p-2 mt-1" />
            </div>
          );
        } else {
          return (
            <div key={fid}>
              <label className="block text-sm font-medium">{f.label ?? f.id}</label>
              <input value={val} onChange={(e) => setField(f.id, e.target.value)} className="w-full rounded-md border p-2 mt-1" />
            </div>
          );
        }
      })}

      <div className="flex justify-end">
        <button type="button" onClick={() => handleSubmit()} className="px-3 py-1 bg-indigo-600 text-white rounded">
          Submit
        </button>
      </div>
    </form>
  );
}
