import { useMemo } from 'react'
import { Diff, Hunk, parseDiff } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import type { JSX } from 'react/jsx-runtime'
import diffTextDefault from './diff.patch?raw'


type Props = { diffText: string }

export default function UnifiedDiffRenderer({ diffText }: Props): JSX.Element {
  const files = useMemo(() => {
    try {
      return parseDiff(diffText || diffTextDefault)
    } catch (err) {
      console.error('parseDiff error', err)
      return []
    }
  }, [diffText])

  if (!files || files.length === 0) {
    return <div className="text-sm text-slate-500">No diff available</div>
  }

  return (
    <div className="space-y-6">
      {files.map((file: any) => (
        <div key={file.newPath || file.oldPath} className="border rounded bg-white">
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
            <div className="font-mono text-sm">{file.newPath || file.oldPath}</div>
            <div className="text-xs text-slate-500">{file.status || ''}</div>
          </div>

          <div className="p-4">
            <Diff viewType="split" diffType={file.type || 'modify'} hunks={file.hunks}>
              {(hunks: any) => hunks.map((h: any) => <Hunk key={h.content} hunk={h} />)}
            </Diff>
          </div>
        </div>
      ))}
    </div>
  )
}
