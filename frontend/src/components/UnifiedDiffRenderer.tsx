import { useMemo } from "react";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";
import type { JSX } from "react/jsx-runtime";
import diffTextDefault from "./diff.patch?raw";

import DiffContainer from "./ui/DiffContainer";
import DiffFileCard from "./ui/DiffFileCard";
import DiffFileHeader from "./ui/DiffFileHeader";
import DiffFileBody from "./ui/DiffFileBody";
import EmptyStateText from "./ui/EmptyStateText";

type Props = { diffText: string };

export default function UnifiedDiffRenderer({ diffText }: Props): JSX.Element {
  const files = useMemo(() => {
    try {
      return parseDiff(diffText || diffTextDefault);
    } catch (err) {
      console.error("parseDiff error", err);
      return [];
    }
  }, [diffText]);

  if (!files || files.length === 0) {
    return <EmptyStateText text="No diff available" />;
  }

  return (
    <DiffContainer>
      {files.map((file: any) => (
        <DiffFileCard key={file.newPath || file.oldPath}>
          <DiffFileHeader path={file.newPath || file.oldPath} status={file.status} />
          <DiffFileBody>
            <Diff viewType="split" diffType={file.type || "modify"} hunks={file.hunks}>
              {(hunks: any) => hunks.map((h: any) => <Hunk key={h.content} hunk={h} />)}
            </Diff>
          </DiffFileBody>
        </DiffFileCard>
      ))}
    </DiffContainer>
  );
}
