import { useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  UploadCloudIcon,
} from 'lucide-react'

export interface DropzoneProps {
  title: string
  hint: string
  optional?: boolean
  compact?: boolean
  uploadedFile?: string
  uploadedMeta?: string
  issues?: string[]
  busy?: boolean
  onFile: (file: File) => void
  onClear: () => void
}

export function Dropzone({
  title,
  hint,
  optional = false,
  compact = false,
  uploadedFile,
  uploadedMeta,
  issues,
  busy = false,
  onFile,
  onClear,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function pick() {
    inputRef.current?.click()
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onFile(file)
        event.target.value = ''
      }}
    />
  )

  if (issues && issues.length > 0) {
    return (
      <section className="rounded-lg border border-danger-25 bg-danger-10 p-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangleIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-danger"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">{title}</p>
            <ul className="mt-1 space-y-0.5">
              {issues.slice(0, 4).map((issue) => (
                <li key={issue} className="text-2xs text-[#C22F30]">
                  {issue}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-2xs text-neutral-500">
              Fix the columns listed above, then upload again. Nothing was uploaded.
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-danger-25 bg-white px-2 py-1 text-2xs font-medium text-[#C22F30] transition-colors duration-150 ease-out hover:bg-danger-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Dismiss
          </button>
        </div>
        {input}
      </section>
    )
  }

  if (uploadedFile) {
    return (
      <section className="rounded-lg border border-success-25 bg-success-10 p-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">{title}</p>
            <p className="mt-0.5 truncate text-2xs text-neutral-600">{uploadedFile}</p>
            {uploadedMeta ? (
              <p className="mt-1 text-2xs font-medium text-[#00753A]">{uploadedMeta}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-success-25 bg-white px-2 py-1 text-2xs font-medium text-[#00753A] transition-colors duration-150 ease-out hover:bg-success-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Replace
          </button>
        </div>
        {input}
      </section>
    )
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files?.[0]
        if (file) onFile(file)
      }}
      className={`rounded-lg border-2 border-dashed transition-colors duration-150 ease-out ${
        dragging ? 'border-accent bg-accent-10' : 'border-neutral-300 bg-white hover:border-brand-50'
      } ${compact ? 'p-3' : 'p-5'}`}
    >
      {input}
      <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col items-center text-center'}`}>
        <div
          className={`flex items-center justify-center rounded-md ${
            dragging ? 'bg-accent-25 text-accent' : 'bg-brand-10 text-brand'
          } ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}
        >
          {compact ? (
            <FileSpreadsheetIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UploadCloudIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className={compact ? 'min-w-0 flex-1 text-left' : 'mt-2.5'}>
          <p className="text-xs font-semibold text-ink">
            {title}
            {optional ? (
              <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-2xs font-medium text-neutral-500">
                Optional
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-2xs text-neutral-500">{hint}</p>
        </div>
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className={`rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-2xs font-medium text-ink transition-colors duration-150 ease-out hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 ${
            compact ? '' : 'mt-3'
          }`}
        >
          {busy ? 'Reading…' : 'Browse files'}
        </button>
      </div>
    </section>
  )
}
