import React, { useMemo, useState } from "react";
import ChatBox from "./ChatBox";
import UnifiedDiffRenderer from "./UnifiedDiffRenderer";
// import DiffViewer from "./DiffViewer";

import NodeGroup from "./ui/NodeGroup";
import BoundaryBox from "./ui/BoundaryBox";
import DefaultNode from "./ui/DefaultNode";
import FormContainer from "./ui/FormContainer";
import FieldBlock from "./ui/FieldBlock";
import ChoiceRow from "./ui/ChoiceRow";
import RadioLabel from "./ui/RadioLabel";
import TextareaField from "./ui/TextareaField";
import InputField from "./ui/InputField";
import SubmitRow from "./ui/SubmitRow";

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
      return <NodeGroup title={node.title}>{(node.children || []).map((child: UiNode, i: number) => (
        <UiNodeRenderer key={child.id ?? i} node={child} path={nodePath} onFormSubmit={onFormSubmit} />
      ))}</NodeGroup>;

    case "boundary":
      return (
        <BoundaryBox title={node.title}>
          {(node.children || []).map((child: UiNode, i: number) => (
            <UiNodeRenderer key={child.id ?? i} node={child} path={nodePath} onFormSubmit={onFormSubmit} />
          ))}
        </BoundaryBox>
      );

    // add more container render types e.g. 'accordion', 'tabs', 'list'
    default:
      return (
        <DefaultNode title={node.title} text={node.text}>
          {(node.children || []).map((c, i) => (
            <UiNodeRenderer key={c.id ?? i} node={c} path={nodePath} onFormSubmit={onFormSubmit} />
          ))}
        </DefaultNode>
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
    <FormContainer title={node.title}>
      {fields.map((f) => {
        const fid = `${uid}.${f.id}`;
        const val = values[f.id] ?? "";
        if (f.type === "choice") {
          return (
            <div key={fid}>
              <FieldBlock label={f.label ?? f.id}>
                <ChoiceRow>
                  {(f.options || []).map((opt) => (
                    <RadioLabel key={opt}>
                      <input type="radio" name={fid} checked={val === opt} onChange={() => setField(f.id, opt)} />
                      <span className="text-sm">{opt}</span>
                    </RadioLabel>
                  ))}
                </ChoiceRow>
              </FieldBlock>
            </div>
          );
        } else if (f.type === "textarea") {
          return (
            <div key={fid}>
              <FieldBlock label={f.label ?? f.id}>
                <TextareaField value={val} onChange={(v) => setField(f.id, v)} />
              </FieldBlock>
            </div>
          );
        } else {
          return (
            <div key={fid}>
              <FieldBlock label={f.label ?? f.id}>
                <InputField value={val} onChange={(v) => setField(f.id, v)} />
              </FieldBlock>
            </div>
          );
        }
      })}

      <SubmitRow onClick={() => handleSubmit()} />
    </FormContainer>
  );
}
