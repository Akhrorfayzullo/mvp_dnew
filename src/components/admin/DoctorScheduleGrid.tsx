'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* ─── Types ─────────────────────────────────── */
interface Doctor {
  id: string
  org_id: string
  name: string
  short_name: string
  color: string
  bg_color: string
  bdr_color: string
  sort_order: number
  start_date: string
  end_date: string | null
  regular_off_days: string
}

interface Slot {
  doctor_id: string
  date: string
  time_slot: string
}

interface Props {
  orgId: string
}

/* ─── Constants ─────────────────────────────── */
const TIME_OPTS = [
  { v: 'off',         label: '휴진',                 type: 'off',     dot: '#94A3B8' },
  { v: '09:00~19:00', label: '09:00 ~ 19:00',         type: 'regular', dot: '#059669' },
  { v: '09:00~20:00', label: '09:00 ~ 20:00 야간',    type: 'night',   dot: '#2563EB' },
  { v: '09:00~14:00', label: '09:00 ~ 14:00 오전',    type: 'morning', dot: '#B45309' },
  { v: '08:00~19:00', label: '08:00 ~ 19:00',         type: 'early',   dot: '#065F46' },
  { v: '08:00~20:00', label: '08:00 ~ 20:00 야간',    type: 'ent',     dot: '#1E40AF' },
]

const DKR = ['월','화','수','목','금','토','일']

const DOCTOR_PALETTE = [
  { color: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE' },
  { color: '#059669', bg: '#F0FDF4', bdr: '#BBF7D0' },
  { color: '#B45309', bg: '#FFFBEB', bdr: '#FDE68A' },
  { color: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' },
  { color: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' },
  { color: '#0891B2', bg: '#ECFEFF', bdr: '#A5F3FC' },
]

function fd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function dim(y: number, m: number) { return new Date(y, m, 0).getDate() }
function dowOf(date: string) { return (new Date(date + 'T00:00:00').getDay() + 6) % 7 }
function fdow(y: number, m: number) { return (new Date(y, m - 1, 1).getDay() + 6) % 7 }
function tt(v: string) {
  if (!v || v === 'off') return 'off'
  if (v === '09:00~19:00') return 'regular'
  if (v === '09:00~20:00') return 'night'
  if (v === '09:00~14:00') return 'morning'
  if (v === '08:00~19:00') return 'early'
  if (v === '08:00~20:00') return 'ent'
  return 'custom'
}

function buildWeeks(y: number, m: number) {
  const D = dim(y, m), off = fdow(y, m)
  const weeks: { day: number; dow: number }[][] = []
  let day = 1, col = off
  while (day <= D) {
    const wk: { day: number; dow: number }[] = []
    while (col < 7 && day <= D) { wk.push({ day, dow: col }); day++; col++ }
    weeks.push(wk); col = 0
  }
  return weeks
}

const CELL_BG: Record<string, string> = {
  off:      'bg-gray-50 text-gray-400',
  regular:  'bg-green-50 text-green-700',
  night:    'bg-blue-50 text-blue-800',
  morning:  'bg-amber-50 text-amber-700',
  early:    'bg-emerald-50 text-emerald-800',
  ent:      'bg-indigo-50 text-indigo-800',
  custom:   'bg-violet-50 text-violet-700',
  inactive: 'bg-gray-50 text-gray-300',
}

function regularOffMap(doc: Doctor): Set<number> {
  const s = new Set<number>()
  doc.regular_off_days.split(',').forEach((v) => {
    const n = parseInt(v)
    if (!isNaN(n) && n >= 0 && n <= 6) s.add(n)
  })
  return s
}

function isDoctorActiveOn(doc: Doctor, date: string) {
  const start = doc.start_date || '1900-01-01'
  const end   = doc.end_date
  return date >= start && (!end || date <= end)
}

function inputWindow() {
  const today = new Date()
  // Allow editing from the 1st of the current month so staff can correct any day this month
  const start = fd(today.getFullYear(), today.getMonth() + 1, 1)
  const end3m = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
  const end = fd(end3m.getFullYear(), end3m.getMonth() + 1, end3m.getDate())
  return { start, end }
}

/* ════════════════════════════════════════════════════════ */
export default function DoctorScheduleGrid({ orgId }: Props) {
  const today = new Date()
  const todayStr = fd(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const { start: inputStart, end: inputEnd } = inputWindow()

  const [curY, setCurY] = useState(today.getFullYear())
  const [curM, setCurM] = useState(today.getMonth() + 1)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [slots, setSlots] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)

  // Per-cell saving
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  // Inline doctor manager
  const [editDoctors, setEditDoctors] = useState<Doctor[]>([])
  const [mgSaving, setMgSaving] = useState(false)
  const [mgError, setMgError] = useState<string | null>(null)
  const [mgExpanded, setMgExpanded] = useState(true)

  // Per-cell dropdown
  const [ddVisible, setDdVisible] = useState(false)
  const [ddPos, setDdPos] = useState({ x: 0, y: 0 })
  const [ddTarget, setDdTarget] = useState<{ date: string; doctorId: string } | null>(null)
  const [customTime, setCustomTime] = useState('')

  // Bulk-week dropdown
  const [bulkDd, setBulkDd] = useState<{ dates: string[]; label: string; pos: { x: number; y: number } } | null>(null)

  // Week modal
  const [weekOpen, setWeekOpen] = useState(false)
  const [weekDates, setWeekDates] = useState<string[]>([])
  const [weekLabel, setWeekLabel] = useState('')
  const weekContentRef = useRef<HTMLDivElement>(null)

  // Month view modal
  const [mvOpen, setMvOpen] = useState(false)
  const [mvY, setMvY] = useState(curY)
  const [mvM, setMvM] = useState(curM)
  const mvContentRef = useRef<HTMLDivElement>(null)

  const [downloading, setDownloading] = useState(false)
  const loadIdRef = useRef(0)

  /* ── Load ── */
  const loadData = useCallback(async (y: number, m: number) => {
    const myId = ++loadIdRef.current
    setLoading(true)
    setSaveError(null)
    try {
      const [docsRes, slotsRes] = await Promise.all([
        fetch(`/api/admin/doctors/${orgId}`, { cache: 'no-store' }),
        fetch(`/api/admin/doctors/${orgId}/slots?year=${y}&month=${m}`, { cache: 'no-store' }),
      ])
      if (!docsRes.ok) throw new Error(`의사 정보 로딩 실패 (${docsRes.status})`)
      const docsJson  = await docsRes.json()
      if (docsJson.error) throw new Error(docsJson.error)

      const slotsJson = slotsRes.ok ? await slotsRes.json() : { slots: [], error: `일정 로딩 실패 (${slotsRes.status})` }
      if (myId !== loadIdRef.current) return

      const docs = docsJson.doctors ?? []
      setDoctors(docs)
      setEditDoctors(docs.map((d: Doctor) => ({ ...d })))

      if (slotsJson.error) setSaveError(`일정 로딩 오류: ${slotsJson.error}`)

      const rawSlots: Slot[] = slotsJson.slots ?? []
      const map: Record<string, Record<string, string>> = {}
      rawSlots.forEach((s) => {
        if (!map[s.date]) map[s.date] = {}
        map[s.date][s.doctor_id] = s.time_slot
      })
      setSlots(map)
    } catch (err) {
      if (myId === loadIdRef.current)
        setSaveError(err instanceof Error ? err.message : '데이터 로딩 중 오류가 발생했습니다.')
    } finally {
      if (myId === loadIdRef.current) setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadData(curY, curM) }, [loadData, curY, curM])

  function navMonth(d: number) {
    let nm = curM + d, ny = curY
    if (nm > 12) { nm = 1; ny++ }
    if (nm < 1)  { nm = 12; ny-- }
    setCurM(nm); setCurY(ny)
  }

  function getSlot(date: string, doctorId: string) {
    if (slots[date]?.[doctorId] !== undefined) return slots[date][doctorId]
    const doc = doctors.find((d) => d.id === doctorId)
    if (!doc) return 'off'
    return regularOffMap(doc).has(dowOf(date)) ? 'off' : '09:00~19:00'
  }

  function isEditable(date: string, doc: Doctor) {
    return date >= inputStart && date <= inputEnd && isDoctorActiveOn(doc, date)
  }

  /* ── Slot save ── */
  async function saveSlot(date: string, doctorId: string, timeSlot: string) {
    const cellKey = `${date}__${doctorId}`
    const prevValue = slots[date]?.[doctorId]
    setSlots((prev) => {
      const next = { ...prev }
      if (!next[date]) next[date] = {}
      next[date] = { ...next[date], [doctorId]: timeSlot }
      return next
    })
    setDdVisible(false)
    setSavingCells((prev) => new Set(prev).add(cellKey))
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/doctors/${orgId}/slots`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upserts: [{ doctor_id: doctorId, date, time_slot: timeSlot }] }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `저장 실패 (${res.status})`)
      setLastSaved(new Date())
    } catch (err) {
      setSlots((prev) => {
        const next = { ...prev }
        if (prevValue !== undefined) {
          if (!next[date]) next[date] = {}
          next[date] = { ...next[date], [doctorId]: prevValue }
        } else {
          if (next[date]) { const d = { ...next[date] }; delete d[doctorId]; next[date] = d }
        }
        return next
      })
      setSaveError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSavingCells((prev) => { const s = new Set(prev); s.delete(cellKey); return s })
    }
  }

  /* ── Save all ── */
  async function saveAllSlots() {
    if (bulkSaving || doctors.length === 0) return
    setBulkSaving(true); setSaveError(null)
    try {
      const totalDays = dim(curY, curM)
      const upserts: { doctor_id: string; date: string; time_slot: string }[] = []
      for (let d = 1; d <= totalDays; d++) {
        const date = fd(curY, curM, d)
        for (const doc of doctors) upserts.push({ doctor_id: doc.id, date, time_slot: getSlot(date, doc.id) })
      }
      for (let i = 0; i < upserts.length; i += 200) {
        const chunk = upserts.slice(i, i + 200)
        const res = await fetch(`/api/admin/doctors/${orgId}/slots`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upserts: chunk }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? `저장 실패 (${res.status})`)
      }
      setLastSaved(new Date())
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '전체 저장 중 오류가 발생했습니다.')
    } finally { setBulkSaving(false) }
  }

  /* ── Fill all off ── */
  function fillAllOff() {
    if (!confirm('현재 월의 모든 입력 가능한 일정을 휴진으로 변경하시겠습니까?')) return
    const totalDays = dim(curY, curM)
    setSlots((prev) => {
      const next = { ...prev }
      for (let d = 1; d <= totalDays; d++) {
        const date = fd(curY, curM, d)
        if (!next[date]) next[date] = {}
        next[date] = { ...next[date] }
        for (const doc of doctors) {
          if (isEditable(date, doc)) next[date][doc.id] = 'off'
        }
      }
      return next
    })
  }

  /* ── Bulk-week apply ── */
  function openBulkDd(e: React.MouseEvent, dates: string[], label: string) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const W = window.innerWidth, H = window.innerHeight
    let l = rect.left, t = rect.bottom + 4
    if (l + 220 > W - 8) l = W - 228
    if (t + 280 > H - 8) t = Math.max(8, rect.top - 284)
    setBulkDd({ dates, label, pos: { x: l, y: t } })
    setDdVisible(false)
  }

  async function applyWeekBulk(dates: string[], timeSlot: string | null) {
    setBulkDd(null)
    const editable: { date: string; doctorId: string; value: string }[] = []
    dates.forEach((date) => {
      doctors.forEach((doc) => {
        if (!isEditable(date, doc)) return
        const value = timeSlot === null
          ? (regularOffMap(doc).has(dowOf(date)) ? 'off' : '09:00~19:00')
          : timeSlot
        editable.push({ date, doctorId: doc.id, value })
      })
    })
    if (editable.length === 0) return

    setSlots((prev) => {
      const next = { ...prev }
      editable.forEach(({ date, doctorId, value }) => {
        if (!next[date]) next[date] = {}
        next[date] = { ...next[date], [doctorId]: value }
      })
      return next
    })

    try {
      const res = await fetch(`/api/admin/doctors/${orgId}/slots`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upserts: editable.map(({ date, doctorId, value }) => ({ doctor_id: doctorId, date, time_slot: value })) }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? '일괄 저장 실패')
      setLastSaved(new Date())
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '일괄 저장 오류')
    }
  }

  /* ── Dropdown ── */
  function openDD(e: React.MouseEvent, date: string, doctorId: string) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const W = window.innerWidth, H = window.innerHeight
    let l = rect.left, t = rect.bottom + 4
    if (l + 210 > W - 8) l = W - 218
    if (t + 400 > H - 8) t = Math.max(8, rect.top - 404)
    setDdPos({ x: l, y: t }); setDdTarget({ date, doctorId }); setCustomTime(''); setDdVisible(true)
  }

  /* ── Doctor manager (inline) ── */
  function updateEditDoc(idx: number, field: keyof Doctor, value: string | null) {
    setEditDoctors((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      if (field === 'name') {
        next[idx].short_name = (value as string).replace(/\s*원장\s*$/, '').trim() || (value as string)
      }
      return next
    })
  }

  function toggleOffDay(idx: number, dow: number) {
    setEditDoctors((prev) => {
      const next = [...prev]
      const days = new Set(regularOffMap(next[idx]))
      if (days.has(dow)) days.delete(dow); else days.add(dow)
      next[idx] = { ...next[idx], regular_off_days: Array.from(days).sort().join(',') }
      return next
    })
  }

  function addEditDoc() {
    const palette = DOCTOR_PALETTE[editDoctors.length % DOCTOR_PALETTE.length]
    setEditDoctors((prev) => [...prev, {
      id: `__new_${Date.now()}`, org_id: orgId,
      name: '새 원장', short_name: '새원장',
      color: palette.color, bg_color: palette.bg, bdr_color: palette.bdr,
      sort_order: prev.length, start_date: inputStart, end_date: null, regular_off_days: '',
    }])
  }

  function removeEditDoc(idx: number) {
    setEditDoctors((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveDoctors() {
    if (mgSaving) return
    const invalid = editDoctors.find((d) => !d.name.trim())
    if (invalid) { setMgError('이름을 입력하세요.'); return }
    setMgSaving(true); setMgError(null)
    try {
      const payload = editDoctors.map((d, i) => ({
        ...(d.id.startsWith('__new_') ? {} : { id: d.id }),
        name: d.name.trim(),
        short_name: d.short_name || d.name.replace(/\s*원장\s*$/, '').trim(),
        color: d.color, bg_color: d.bg_color, bdr_color: d.bdr_color,
        sort_order: i,
        start_date: d.start_date || '1900-01-01',
        end_date: d.end_date || null,
        regular_off_days: d.regular_off_days,
      }))
      const res = await fetch(`/api/admin/doctors/${orgId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctors: payload }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `저장 실패 (${res.status})`)
      setDoctors(json.doctors ?? editDoctors)
      setEditDoctors((json.doctors ?? editDoctors).map((d: Doctor) => ({ ...d })))
    } catch (err) {
      setMgError(err instanceof Error ? err.message : '저장 중 오류')
    } finally { setMgSaving(false) }
  }

  /* ── Modals ── */
  function openWeekModal(dates: string[], label: string) { setWeekDates(dates); setWeekLabel(label); setWeekOpen(true) }
  function openMV() { setMvY(curY); setMvM(curM); setMvOpen(true) }
  function navMV(d: number) {
    let nm = mvM + d, ny = mvY
    if (nm > 12) { nm = 1; ny++ }
    if (nm < 1)  { nm = 12; ny-- }
    setMvM(nm); setMvY(ny)
  }

  async function downloadPNG(ref: React.RefObject<HTMLDivElement>, filename: string) {
    if (!ref.current || downloading) return
    setDownloading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
          s.onload = () => resolve(); s.onerror = reject
          document.head.appendChild(s)
        })
      }
      await new Promise(r => setTimeout(r, 120))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await (window as any).html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const a = document.createElement('a')
      a.download = filename; a.href = canvas.toDataURL('image/png'); a.click()
    } finally { setDownloading(false) }
  }

  const weeks = buildWeeks(curY, curM)

  /* ── Cell ── */
  function CellPill({ date, doc }: { date: string; doc: Doctor }) {
    const active = isDoctorActiveOn(doc, date)
    const editable = isEditable(date, doc)
    const v = getSlot(date, doc.id)
    const tp = !active ? 'inactive' : tt(v)
    const isSaving = savingCells.has(`${date}__${doc.id}`)
    const pts = v !== 'off' ? v.split('~') : []

    return (
      <div
        onClick={(e) => editable && !isSaving && openDD(e, date, doc.id)}
        className={`relative flex flex-col items-center justify-center w-full h-full min-h-[46px] px-1 py-1 text-[11px] font-semibold select-none
          ${CELL_BG[tp]}
          ${editable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}
          ${isSaving ? 'opacity-50' : ''}`}
      >
        {isSaving && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </span>
        )}
        {!active ? (
          <span className="text-[10px] text-gray-300">{date < (doc.start_date || '1900-01-01') ? '근무전' : '종료'}</span>
        ) : date > inputEnd ? (
          <span className="text-[10px] text-gray-300">기간외</span>
        ) : v === 'off' ? (
          <span className="text-gray-400">휴진</span>
        ) : (
          <>
            <span className="leading-none">{pts[0]}</span>
            <span className="leading-none text-[10px] opacity-75">~{pts[1]}</span>
          </>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div className="space-y-3">

      {/* ══ DOCTOR MANAGER (inline) ══════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/80">
          <button onClick={() => setMgExpanded(!mgExpanded)}
            className="flex items-center gap-2 text-sm font-extrabold text-gray-800 hover:text-blue-600 transition">
            <span>👨‍⚕️ 원장님 진료일정 관리</span>
            <span className="text-gray-400 text-xs">{mgExpanded ? '▲' : '▼'}</span>
          </button>
          {mgExpanded && (
            <div className="flex items-center gap-2">
              {mgError && <span className="text-xs text-red-600 font-medium">{mgError}</span>}
              <button onClick={addEditDoc} className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-lg hover:bg-gray-100 transition">
                + 원장 추가
              </button>
              <button onClick={saveDoctors} disabled={mgSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-60">
                {mgSaving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />저장 중</> : '💾 저장'}
              </button>
            </div>
          )}
        </div>

        {/* Doctor table */}
        {mgExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold text-[11px]">
                  <th className="px-4 py-2 text-left w-14">원장 ID</th>
                  <th className="px-3 py-2 text-left w-36">원장명</th>
                  <th className="px-3 py-2 text-left w-32">근무 시작일</th>
                  <th className="px-3 py-2 text-left w-32">근무 종료일</th>
                  <th className="px-3 py-2 text-left">정기휴진일</th>
                  <th className="px-3 py-2 text-center w-12">색상</th>
                  <th className="px-3 py-2 text-center w-12">삭제</th>
                </tr>
              </thead>
              <tbody>
                {editDoctors.map((doc, idx) => (
                  <tr key={doc.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition">
                    {/* ID pill */}
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ background: doc.bg_color, color: doc.color, border: `1px solid ${doc.bdr_color}` }}>
                        {doc.id.startsWith('__new_') ? 'new' : `d${idx + 1}`}
                      </span>
                    </td>
                    {/* Name */}
                    <td className="px-3 py-2">
                      <input value={doc.name} onChange={(e) => updateEditDoc(idx, 'name', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 font-semibold"
                        style={{ color: doc.color }} />
                    </td>
                    {/* Start date */}
                    <td className="px-3 py-2">
                      <input type="date" value={doc.start_date || '1900-01-01'}
                        onChange={(e) => updateEditDoc(idx, 'start_date', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-blue-400" />
                    </td>
                    {/* End date */}
                    <td className="px-3 py-2">
                      <input type="date" value={doc.end_date || ''}
                        onChange={(e) => updateEditDoc(idx, 'end_date', e.target.value || null)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-blue-400" />
                    </td>
                    {/* Regular off days */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DKR.map((d, dow) => {
                          const isOff = regularOffMap(doc).has(dow)
                          const isSat = dow === 5, isSun = dow === 6
                          return (
                            <label key={dow} className="flex items-center gap-0.5 cursor-pointer select-none">
                              <input type="checkbox" checked={isOff}
                                onChange={() => toggleOffDay(idx, dow)}
                                className="w-3.5 h-3.5 cursor-pointer" />
                              <span className={`text-[11px] font-semibold ${isSat ? 'text-blue-500' : isSun ? 'text-red-500' : 'text-gray-600'}`}>{d}</span>
                            </label>
                          )
                        })}
                      </div>
                    </td>
                    {/* Color */}
                    <td className="px-3 py-2 text-center">
                      <input type="color" value={doc.color}
                        onChange={(e) => {
                          const c = e.target.value
                          setEditDoctors((prev) => {
                            const next = [...prev]
                            next[idx] = { ...next[idx], color: c }
                            return next
                          })
                        }}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5" />
                    </td>
                    {/* Delete */}
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removeEditDoc(idx)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 text-xs font-bold flex items-center justify-center mx-auto transition">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {editDoctors.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400 text-sm">원장을 추가해주세요.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ SCHEDULE SECTION ══════════════════════════════ */}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <button onClick={() => navMonth(-1)} className="px-3 py-2 text-gray-500 hover:bg-gray-50 text-sm transition">이전달</button>
          <span className="px-4 py-2 font-bold text-sm min-w-[110px] text-center border-x border-gray-100">{curY}년 {curM}월</span>
          <button onClick={() => navMonth(1)} className="px-3 py-2 text-gray-500 hover:bg-gray-50 text-sm transition">다음달</button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-gray-400">입력: {inputStart} ~ {inputEnd}</span>
{lastSaved && !bulkSaving && (
            <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨
            </span>
          )}
          <button onClick={fillAllOff}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition">
            전체 휴진
          </button>
          <button onClick={saveAllSlots} disabled={bulkSaving || doctors.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition disabled:opacity-60">
            {bulkSaving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />저장 중…</> : '💾 전체 저장'}
          </button>
          <button onClick={openMV} className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition">
            📅 {curM}월 전체보기
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
        <span className="text-gray-400 font-bold">범례</span>
        {TIME_OPTS.map((o) => (
          <div key={o.v} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: o.dot }} />
            <span style={{ color: o.dot }} className="font-medium">{o.label}</span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          <span>⚠️</span><span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {/* ══ GRID ════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse min-w-max w-full text-[11px]">
            <tbody>
              {/* Week header */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <td className="sticky left-0 z-20 bg-gray-50 w-[140px] min-w-[140px] border-r-2 border-gray-200 px-3 py-2 text-[11px] font-bold text-gray-400">
                  원장 / 날짜
                </td>
                {weeks.map((wk, wi) => {
                  const dates = wk.map(({ day }) => fd(curY, curM, day))
                  const f = wk[0], l = wk[wk.length - 1]
                  const lbl = `${curM}/${f.day} ~ ${curM}/${l.day}`
                  const hasEditable = dates.some((d) => doctors.some((doc) => isEditable(d, doc)))
                  return (
                    <td key={wi} colSpan={wk.length} className="text-center px-1 py-1 border-r border-gray-100">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          onClick={(e) => hasEditable && openBulkDd(e, dates, lbl)}
                          title={hasEditable ? '일괄 적용' : '편집 불가 주차'}
                          className={`text-[10px] font-semibold whitespace-nowrap px-2 py-0.5 rounded transition
                            ${hasEditable
                              ? 'text-blue-600 hover:bg-blue-50 cursor-pointer'
                              : 'text-gray-300 cursor-default'}`}>
                          {lbl}
                        </button>
                        <button
                          onClick={() => openWeekModal(dates, lbl)}
                          title="주간 진료표 보기"
                          className="text-[11px] text-gray-400 hover:text-blue-500 px-0.5 transition">
                          📅
                        </button>
                      </div>
                    </td>
                  )
                })}
              </tr>

              {/* Day names */}
              <tr className="bg-gray-50 border-b border-gray-100">
                <td className="sticky left-0 z-20 bg-gray-50 border-r-2 border-gray-200" />
                {weeks.map((wk) => wk.map(({ dow }, i) => {
                  const c = dow === 5 ? 'text-blue-600' : dow === 6 ? 'text-red-500' : 'text-gray-400'
                  return (
                    <td key={`dn-${dow}-${i}`}
                      className={`text-center px-1 py-1 text-[10px] font-bold tracking-widest w-[68px] min-w-[68px] border-r border-gray-100 ${c}`}>
                      {DKR[dow]}
                    </td>
                  )
                }))}
              </tr>

              {/* Date numbers */}
              <tr className="border-b-2 border-gray-200">
                <td className="sticky left-0 z-20 bg-gray-50 border-r-2 border-gray-200" />
                {weeks.map((wk) => wk.map(({ day, dow }) => {
                  const ds = fd(curY, curM, day)
                  const isToday = ds === todayStr
                  const c = isToday ? 'bg-blue-600 text-white font-bold' : dow === 5 ? 'text-blue-600 bg-blue-50' : dow === 6 ? 'text-red-500 bg-red-50' : 'text-gray-700 bg-gray-50'
                  return (
                    <td key={ds} className={`text-center px-1 py-1.5 text-[13px] font-bold border-r border-gray-100 ${c}`}>
                      {day}
                    </td>
                  )
                }))}
              </tr>

              {/* Doctor rows */}
              {doctors.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="sticky left-0 z-10 border-r-2 border-gray-200 px-3 py-0 h-[52px]"
                    style={{ background: doc.bg_color }}>
                    <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: doc.color }}>
                      {doc.name}
                    </span>
                  </td>
                  {weeks.map((wk) => wk.map(({ day }) => {
                    const ds = fd(curY, curM, day)
                    return (
                      <td key={ds} className="p-0 border-r border-gray-100 h-[52px]">
                        <CellPill date={ds} doc={doc} />
                      </td>
                    )
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Dropdown ── */}
      {ddVisible && ddTarget && (
        <div className="fixed z-[999] bg-white border border-gray-200 rounded-xl shadow-2xl min-w-[210px] p-1.5 max-h-[min(420px,calc(100vh-24px))] overflow-y-auto"
          style={{ left: ddPos.x, top: ddPos.y }}
          onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-gray-400">
            {doctors.find(d => d.id === ddTarget.doctorId)?.name} · {ddTarget.date.slice(5).replace('-','/')}
          </div>
          <div className="h-px bg-gray-100 mb-1" />
          {TIME_OPTS.map((o) => {
            const cur = getSlot(ddTarget.date, ddTarget.doctorId)
            const sel = cur === o.v
            return (
              <div key={o.v} onClick={() => saveSlot(ddTarget.date, ddTarget.doctorId, o.v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] cursor-pointer hover:bg-gray-50 transition ${sel ? 'font-bold bg-gray-50' : 'font-medium'}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.dot }} />
                <span className="flex-1">{o.label}</span>
                {sel && <span className="text-blue-600 text-[10px]">선택</span>}
              </div>
            )
          })}
          <div className="h-px bg-gray-100 my-1" />
          <div className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
            <div className="text-[10px] font-bold text-gray-400 mb-1">직접 입력</div>
            <div className="flex gap-1">
              <input type="text" value={customTime} onChange={(e) => setCustomTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customTime.trim() && ddTarget) {
                    saveSlot(ddTarget.date, ddTarget.doctorId, customTime.trim()); setCustomTime('')
                  }
                }}
                placeholder="09:00~18:00"
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-blue-400 min-w-0" />
              <button onClick={() => { if (customTime.trim() && ddTarget) { saveSlot(ddTarget.date, ddTarget.doctorId, customTime.trim()); setCustomTime('') } }}
                className="px-2 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Week Modal ── */}
      {weekOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setWeekOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[min(940px,95vw)] max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-extrabold">📅 {weekLabel} 주간 진료표</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadPNG(weekContentRef, `주간진료표_${weekLabel}.png`)} disabled={downloading}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                  {downloading ? '⏳' : '⬇️'} PNG 저장
                </button>
                <button onClick={() => setWeekOpen(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition">✕</button>
              </div>
            </div>
            <div className="overflow-auto p-6" ref={weekContentRef}>
              <div className="flex flex-wrap gap-2 mb-4">
                {doctors.map((d) => (
                  <div key={d.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-[11px] font-semibold"
                    style={{ background: d.bg_color, borderColor: d.bdr_color, color: d.color }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />{d.name}
                  </div>
                ))}
              </div>
              <table className="border-separate border-spacing-1 w-full">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-[11px] font-bold text-gray-400 w-36">의사</th>
                    {weekDates.map((ds) => {
                      const dow = dowOf(ds)
                      const isToday = ds === todayStr
                      const c = isToday ? 'bg-blue-600 text-white' : dow === 5 ? 'bg-blue-50 text-blue-600' : dow === 6 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                      return (
                        <th key={ds} className={`text-center px-2 py-2 rounded-lg text-[11px] font-bold min-w-[98px] ${c}`}>
                          <span className="block text-2xl font-bold leading-none mb-0.5">{new Date(ds + 'T00:00:00').getDate()}</span>
                          {DKR[dow]}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-3 py-2 rounded-xl text-[13px] font-bold" style={{ background: doc.bg_color, color: doc.color }}>{doc.name}</td>
                      {weekDates.map((ds) => {
                        const active = isDoctorActiveOn(doc, ds)
                        const v = getSlot(ds, doc.id)
                        const tp = !active ? 'inactive' : tt(v)
                        const pts = v !== 'off' ? v.split('~') : []
                        return (
                          <td key={ds} className="p-0.5">
                            <div className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-xl text-[11px] min-h-[60px] text-center font-semibold ${CELL_BG[tp]}`}>
                              {!active ? <span className="text-[10px]">{ds < (doc.start_date || '') ? '근무전' : '종료'}</span>
                                : v === 'off' ? '휴진'
                                : <><strong>{pts[0]}</strong><span>~{pts[1]}</span></>}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Month View Modal ── */}
      {mvOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setMvOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[min(1200px,98vw)] max-h-[94vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header (outside the PNG export area) */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => navMV(-1)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] font-semibold hover:bg-blue-600 hover:text-white transition">‹ 전월</button>
                <span className="text-base font-bold min-w-[120px] text-center">{mvY}년 {mvM}월</span>
                <button onClick={() => navMV(1)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] font-semibold hover:bg-blue-600 hover:text-white transition">다음달 ›</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadPNG(mvContentRef, `진료시간표_${mvY}년${mvM}월.png`)} disabled={downloading}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                  {downloading ? '⏳' : '⬇️'} PNG 저장
                </button>
                <button onClick={() => setMvOpen(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition">✕</button>
              </div>
            </div>

            {/* PNG-exported area */}
            <div className="overflow-auto flex-1" ref={mvContentRef}>
              <div className="p-6 bg-white min-w-[780px]">

                {/* Title */}
                <div className="text-center mb-5">
                  <h2 className="text-xl font-extrabold text-gray-800">{mvY}년 {mvM}월 진료시간표</h2>
                </div>

                {/* Doctor legend */}
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {doctors.map((d) => (
                    <div key={d.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold"
                      style={{ background: d.bg_color, borderColor: d.bdr_color, color: d.color }}>
                      {d.short_name} · {d.name}
                    </div>
                  ))}
                </div>

                {/* Weekly tables */}
                <div className="space-y-4">
                  {buildWeeks(mvY, mvM).map((wk, wi) => (
                    <div key={wi}>
                      {/* Week label */}
                      <div className="text-[11px] font-bold text-gray-400 mb-1 pl-1">
                        {wi + 1}주차 · {mvM}월 {wk[0].day}일 ~ {mvM}월 {wk[wk.length - 1].day}일
                      </div>
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr>
                            <th className="text-left px-3 py-2 bg-gray-100 text-gray-500 font-bold w-28 border border-gray-200">원장</th>
                            {wk.map(({ day, dow }) => {
                              const ds = fd(mvY, mvM, day)
                              const isToday = ds === todayStr
                              const bg = isToday ? 'bg-blue-600 text-white' : dow === 5 ? 'bg-blue-50 text-blue-700' : dow === 6 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'
                              return (
                                <th key={ds} className={`text-center px-2 py-1.5 font-bold border border-gray-200 min-w-[80px] ${bg}`}>
                                  <span className="block text-[18px] leading-none font-extrabold">{day}</span>
                                  <span className="text-[10px] font-semibold">{DKR[dow]}</span>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {doctors.map((doc, di) => (
                            <tr key={doc.id} className={di % 2 === 0 ? '' : 'bg-gray-50/40'}>
                              <td className="px-3 py-2 font-bold border border-gray-200 text-[12px]"
                                style={{ background: doc.bg_color, color: doc.color }}>
                                {doc.name}
                              </td>
                              {wk.map(({ day }) => {
                                const ds = fd(mvY, mvM, day)
                                const active = isDoctorActiveOn(doc, ds)
                                const v = getSlot(ds, doc.id)
                                const tp = !active ? 'inactive' : tt(v)
                                const pts = v !== 'off' ? v.split('~') : []
                                return (
                                  <td key={ds} className={`border border-gray-200 p-0`}>
                                    <div className={`flex flex-col items-center justify-center px-1 py-2 text-center font-semibold ${CELL_BG[tp]}`}>
                                      {!active
                                        ? <span className="text-[10px]">{ds < (doc.start_date || '') ? '근무전' : '종료'}</span>
                                        : v === 'off'
                                          ? <span className="text-[11px]">휴진</span>
                                          : <>
                                              <span className="text-[12px] font-bold leading-tight">{pts[0]}</span>
                                              <span className="text-[10px] leading-tight">~{pts[1]}</span>
                                            </>
                                      }
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* Footer legend */}
                <div className="mt-5 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
                    <span className="font-bold text-gray-500">범례:</span>
                    {TIME_OPTS.map((o) => (
                      <span key={o.v} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: o.dot }} />
                        <span style={{ color: o.dot }} className="font-medium">{o.label}</span>
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk-week dropdown ── */}
      {bulkDd && (
        <div className="fixed z-[999] bg-white border border-gray-200 rounded-xl shadow-2xl min-w-[200px] p-1.5"
          style={{ left: bulkDd.pos.x, top: bulkDd.pos.y }}
          onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-1.5 text-[11px] font-bold text-blue-600">
            {bulkDd.label} 일괄 적용
          </div>
          <div className="h-px bg-gray-100 mb-1" />
          {[
            { label: '정상진료',  value: '09:00~19:00', dot: '#059669' },
            { label: '오전진료',  value: '09:00~14:00', dot: '#B45309' },
            { label: '오후진료',  value: '09:00~20:00', dot: '#2563EB' },
            { label: '휴무',      value: 'off',          dot: '#94A3B8' },
          ].map((o) => (
            <div key={o.value}
              onClick={() => applyWeekBulk(bulkDd.dates, o.value)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer hover:bg-gray-50 transition">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.dot }} />
              {o.label}
            </div>
          ))}
          <div className="h-px bg-gray-100 my-1" />
          <div
            onClick={() => applyWeekBulk(bulkDd.dates, null)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-red-500 cursor-pointer hover:bg-red-50 transition">
            ✕ 초기화
          </div>
        </div>
      )}
      {bulkDd && <div className="fixed inset-0 z-[998]" onClick={() => setBulkDd(null)} />}

      {/* Click-away for cell dropdown */}
      {ddVisible && <div className="fixed inset-0 z-[998]" onClick={() => setDdVisible(false)} />}
    </div>
  )
}
