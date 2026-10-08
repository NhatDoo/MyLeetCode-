import { useRef, useState, type FormEvent } from 'react'
import { createProblem } from '../lib/adminApi'
import { localize, type Locale } from '../lib/i18n'

type AdminPageProps = {
  accessToken: string
  locale: Locale
  onProblemCreated: (problemId: string) => Promise<void>
  onOpenProblem: (problemId: string) => void
}

const spreadsheetTemplate = 'input,expected,isHidden\n"[2,7,11,15], 9","[0,1]",true\n"[3,2,4], 6","[1,2]",true\n'

export function AdminPage({ accessToken, locale, onProblemCreated, onOpenProblem }: AdminPageProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState('EASY')
  const [tags, setTags] = useState('')
  const [topics, setTopics] = useState('')
  const [problemImage, setProblemImage] = useState<File | null>(null)
  const [testcaseFile, setTestcaseFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const file = new Blob([spreadsheetTemplate], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'testcases-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setDifficulty('EASY')
    setTags('')
    setTopics('')
    setProblemImage(null)
    setTestcaseFile(null)
    if (imageInput.current) imageInput.current.value = ''
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setCreatedId('')
    if (!testcaseFile) {
      setError(localize(locale, 'Choose a spreadsheet with at least one testcase.', 'Hãy chọn file bảng tính có ít nhất một testcase.'))
      return
    }
    if (testcaseFile.size > 5 * 1024 * 1024) {
      setError(localize(locale, 'The spreadsheet must be 5 MB or smaller.', 'File bảng tính phải nhỏ hơn hoặc bằng 5 MB.'))
      return
    }
    if (problemImage && problemImage.size > 5 * 1024 * 1024) {
      setError(localize(locale, 'The problem image must be 5 MB or smaller.', 'Ảnh bài tập phải nhỏ hơn hoặc bằng 5 MB.'))
      return
    }

    const formData = new FormData()
    formData.append('title', title.trim())
    formData.append('description', description.trim())
    formData.append('difficulty', difficulty)
    formData.append('tags', tags)
    formData.append('topics', topics)
    formData.append('testcasesFile', testcaseFile)
    if (problemImage) formData.append('problemImage', problemImage)
    setIsSaving(true)
    try {
      const created = await createProblem(accessToken, formData)
      await onProblemCreated(created.id)
      setCreatedId(created.id)
      resetForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : localize(locale, 'Could not create the problem.', 'Không thể tạo bài tập.'))
    } finally {
      setIsSaving(false)
    }
  }

  return <main className="portal-main admin-main" id="admin">
    <div className="portal-heading"><div><p className="eyebrow">{localize(locale, 'Problem management', 'Quản lý bài tập')}</p><h1>{localize(locale, 'Admin', 'Quản trị')}</h1><p>{localize(locale, 'Create a problem and import its testcases from a spreadsheet.', 'Tạo bài tập và nhập testcase từ file bảng tính.')}</p></div><button className="template-button" type="button" onClick={downloadTemplate}>↓ {localize(locale, 'Download CSV template', 'Tải file CSV mẫu')}</button></div>
    <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
      <section className="admin-form-section"><div className="admin-section-heading"><span>01</span><div><h2>{localize(locale, 'Problem details', 'Thông tin bài tập')}</h2><p>{localize(locale, 'The title and description appear in the practice workspace.', 'Tiêu đề và mô tả sẽ hiển thị trong khu vực luyện tập.')}</p></div></div>
        <label className="admin-field">{localize(locale, 'Title', 'Tiêu đề')}<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder={localize(locale, 'e.g. Two Sum', 'Ví dụ: Two Sum')} /></label>
        <div className="admin-field-grid"><label className="admin-field">{localize(locale, 'Difficulty', 'Độ khó')}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="EASY">{localize(locale, 'Easy', 'Dễ')}</option><option value="MEDIUM">{localize(locale, 'Medium', 'Trung bình')}</option><option value="HARD">{localize(locale, 'Hard', 'Khó')}</option></select></label><label className="admin-field">{localize(locale, 'Tags', 'Thẻ')}<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={localize(locale, 'Array, Hash Table', 'Array, Hash Table')} /></label></div>
        <label className="admin-field">{localize(locale, 'Topics', 'Chủ đề')}<input value={topics} onChange={(event) => setTopics(event.target.value)} placeholder={localize(locale, 'Algorithms, Data Structures', 'Thuật toán, Cấu trúc dữ liệu')} /></label>
        <label className="admin-field">{localize(locale, 'Description', 'Mô tả')}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} required placeholder={localize(locale, 'Describe the problem statement and constraints.', 'Nhập đề bài và các ràng buộc.')} /></label>
        <label className="admin-field admin-image-field">{localize(locale, 'Problem image', 'Ảnh minh họa bài tập')}<input ref={imageInput} type="file" accept="image/*" onChange={(event) => setProblemImage(event.target.files?.[0] ?? null)} /><small>{problemImage ? `${problemImage.name} · ${(problemImage.size / 1024).toFixed(1)} KB` : localize(locale, 'Optional image · PNG, JPG, WebP · 5 MB', 'Không bắt buộc · PNG, JPG, WebP · 5 MB')}</small></label>
      </section>
      <section className="admin-form-section testcase-import-section"><div className="admin-section-heading"><span>02</span><div><h2>{localize(locale, 'Testcase results', 'Kết quả testcase')}</h2><p>{localize(locale, 'Import input and expected output rows from Excel or CSV.', 'Nhập từng cặp đầu vào và kết quả mong đợi từ Excel hoặc CSV.')}</p></div></div>
        <div className="spreadsheet-columns"><code>input</code><span>→</span><code>expected</code><span className="spreadsheet-optional">isHidden</span></div>
        <label className={testcaseFile ? 'spreadsheet-drop has-file' : 'spreadsheet-drop'}><input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setTestcaseFile(event.target.files?.[0] ?? null)} /><span className="spreadsheet-icon">⇧</span><strong>{testcaseFile?.name ?? localize(locale, 'Choose an Excel or CSV file', 'Chọn file Excel hoặc CSV')}</strong><small>{testcaseFile ? `${(testcaseFile.size / 1024).toFixed(1)} KB` : '.xlsx, .xls, .csv · 5 MB'}</small></label>
      </section>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {createdId && <div className="admin-success" role="status"><span>✓</span><div><strong>{localize(locale, 'Problem created', 'Đã tạo bài tập')}</strong><p>{localize(locale, 'The problem and its testcases are ready.', 'Bài tập và testcase đã được lưu.')}</p></div><button type="button" onClick={() => onOpenProblem(createdId)}>{localize(locale, 'Open problem', 'Mở bài tập')} →</button></div>}
      <div className="admin-submit-row"><span>{localize(locale, 'Testcases are hidden from the public problem statement by default.', 'Testcase mặc định được ẩn khỏi đề bài công khai.')}</span><button className="portal-primary" type="submit" disabled={isSaving}>{isSaving ? localize(locale, 'Creating...', 'Đang tạo...') : localize(locale, 'Create problem', 'Tạo bài tập')}</button></div>
    </form>
  </main>
}