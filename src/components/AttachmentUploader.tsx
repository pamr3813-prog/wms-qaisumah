import { useRef, useState } from 'react'
import { FileText, Paperclip, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Attachment } from '@/types'
import { useLang } from '@/lib/i18n'
import { fmtSize } from '@/lib/format'

const uid = () => Math.random().toString(36).slice(2, 10)

export function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        id: uid(),
        name: file.name,
        dataUrl: String(reader.result),
        size: file.size,
        mime: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: '',
      })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface Props {
  attachments: Attachment[]
  onChange: (list: Attachment[]) => void
  label?: string
  hint?: string
}

/** مرفقات (إيصالات / مستندات) تُحفظ بنظام base64 */
export function AttachmentUploader({ attachments, onChange, label, hint }: Props) {
  const { t } = useLang()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const list: Attachment[] = []
      for (const f of Array.from(files)) {
        if (f.size > 3 * 1024 * 1024) continue // حد 3 م.ب لكل ملف
        list.push(await fileToAttachment(f))
      }
      onChange([...attachments, ...list])
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        <Paperclip className="me-2 size-4" />
        {busy ? t('v.uploading') : label ?? t('v.attachLabel')}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm"
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="flex-1 truncate">{a.name}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(a.size)}</span>
              {a.dataUrl && (
                <a href={a.dataUrl} download={a.name} className="text-muted-foreground hover:text-primary">
                  <Download className="size-4" />
                </a>
              )}
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** عرض مرفقات للقراءة فقط */
export function AttachmentList({ attachments = [] }: { attachments?: Attachment[] }) {
  const { t } = useLang()
  if (!attachments.length) return <span className="text-muted-foreground text-sm">—</span>
  return (
    <ul className="space-y-1">
      {attachments.map((a) => (
        <li key={a.id} className="flex items-center gap-2 text-sm">
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="flex-1 truncate">{a.name}</span>
          {a.dataUrl && (
            <a href={a.dataUrl} download={a.name} className="text-xs text-primary hover:underline">
              {t('v.download')}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
