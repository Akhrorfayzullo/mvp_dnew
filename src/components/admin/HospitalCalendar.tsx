'use client'

import { useCallback, useEffect, useState } from 'react'
import HospitalImageExport from './HospitalImageExport'

/* ─── Types ─────────────────────────────────── */
type DayState = 'open' | 'morning' | 'afternoon' | 'closed' | null

interface DayRecord {
  state: DayState
  label: string | null
}

interface ScheduleDay {
  id: string
  org_id: string
  date: string
  state: DayState
  label: string | null
}

interface Props {
  orgId: string
  hospitalName: string
}

/* ─── Constants ─────────────────────────────── */
const STATES: DayState[] = ['open', 'morning', 'afternoon', 'closed']

const SCFG: Record<NonNullable<DayState>, { text: string; color: string; bg: string }> = {
  open:      { text: '정상진료', color: '#1E8A5E', bg: '#DDFAED' },
  morning:   { text: '오전진료', color: '#1D58D0', bg: '#E4EEFF' },
  afternoon: { text: '오후진료', color: '#B85C00', bg: '#FFF0D4' },
  closed:    { text: '휴  무',   color: '#C41F2E', bg: '#FFE4E7' },
}

const QUICK_LABELS = [
  '추석','추석연휴','설날','설날연휴','어린이날','개천절',
  '광복절','한글날','현충일','성탄절','개원기념일','임시휴진',
]

function fmtKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

/* ════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════ */
export default function HospitalCalendar({ orgId, hospitalName }: Props) {
  const today = new Date()
  const [curY, setCurY] = useState(today.getFullYear())
  const [curM, setCurM] = useState(today.getMonth())
  const [db, setDb] = useState<Record<string, DayRecord>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Context menu
  const [ctxVisible, setCtxVisible] = useState(false)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [ctxDate, setCtxDate] = useState<string | null>(null)

  // Label modal
  const [labelOpen, setLabelOpen] = useState(false)
  const [labelDate, setLabelDate] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')

  // Image export modal
  const [imgOpen, setImgOpen] = useState(false)

  // Range selection
  const [rangeMode,   setRangeMode]   = useState(false)
  const [rangeStart,  setRangeStart]  = useState<number | null>(null)   // day number
  const [rangeHover,  setRangeHover]  = useState<number | null>(null)   // day number (hover preview)
  const [rangePicker, setRangePicker] = useState<{ x: number; y: number; start: number; end: number } | null>(null)

  /* ── Load schedule from API ── */
  const loadMonth = useCallback(async (y: number, m: number) => {
    const res = await fetch(`/api/admin/schedule/${orgId}?year=${y}&month=${m + 1}`)
    const json = await res.json()
    if (!json.days) return

    if ((json.days as ScheduleDay[]).length === 0) {
      // No data yet → seed weekday defaults (Mon–Fri open, Sat–Sun closed)
      const totalDays = new Date(y, m + 1, 0).getDate()
      const firstDow  = new Date(y, m, 1).getDay()
      const defaults: Record<string, DayRecord> = {}
      for (let d = 1; d <= totalDays; d++) {
        const k   = fmtKey(y, m + 1, d)
        const dow = (firstDow + d - 1) % 7
        defaults[k] = { state: (dow === 0 || dow === 6) ? 'closed' : 'open', label: null }
      }
      setDb((prev) => ({ ...prev, ...defaults }))
      setIsDirty(true)   // defaults need to be saved
    } else {
      setDb((prev) => {
        const next = { ...prev }
        ;(json.days as ScheduleDay[]).forEach((row) => {
          next[row.date] = { state: row.state, label: row.label }
        })
        return next
      })
      setIsDirty(false)  // freshly loaded — nothing to save yet
    }
  }, [orgId])

  useEffect(() => { loadMonth(curY, curM) }, [loadMonth, curY, curM])

  /* ── Shared save helper ── */
  const apiSave = useCallback(async (body: object) => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/schedule/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `저장 실패 (${res.status})`)
      setLastSaved(new Date())
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 중 오류 발생')
    } finally {
      setSaving(false)
    }
  }, [orgId])

  /* ── Save all days in current month ── */
  const saveAll = useCallback(async (snapshot: Record<string, DayRecord>, y: number, m: number) => {
    const totalDays = new Date(y, m + 1, 0).getDate()
    const upserts: { date: string; state: DayState; label: string | null }[] = []
    const deletes: string[] = []
    for (let d = 1; d <= totalDays; d++) {
      const k = fmtKey(y, m + 1, d)
      const rec = snapshot[k]
      if (rec && (rec.state || rec.label)) {
        upserts.push({ date: k, state: rec.state ?? null, label: rec.label ?? null })
      } else {
        deletes.push(k)
      }
    }
    await apiSave({ upserts, deletes })
    setIsDirty(false)
  }, [apiSave])

  /* ── Navigation — auto-save dirty month before switching ── */
  async function goMonth(d: number) {
    if (isDirty) await saveAll(db, curY, curM)
    let nm = curM + d, ny = curY
    if (nm < 0) { nm = 11; ny-- }
    if (nm > 11) { nm = 0; ny++ }
    setCurM(nm); setCurY(ny)
  }

  /* ── Cycle state on click ── */
  function cycleState(key: string) {
    const cur = db[key]?.state ?? null
    const idx = STATES.indexOf(cur)
    const next: DayState = idx >= STATES.length - 1 ? null : STATES[idx + 1]
    const newRec: DayRecord | undefined = (next || db[key]?.label)
      ? { state: next, label: db[key]?.label ?? null }
      : undefined
    setDb((prev) => { const u = { ...prev }; if (newRec) u[key] = newRec; else delete u[key]; return u })
    setIsDirty(true)
  }

  /* ── Context menu ── */
  function showCtx(e: React.MouseEvent, key: string) {
    e.preventDefault()
    setCtxDate(key)
    setCtxPos({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 240) })
    setCtxVisible(true)
  }
  function hideCtx() { setCtxVisible(false); setCtxDate(null) }
  function ctxSet(state: DayState) {
    if (!ctxDate) return
    setDb((prev) => ({ ...prev, [ctxDate!]: { state, label: db[ctxDate!]?.label ?? null } }))
    setIsDirty(true)
    hideCtx()
  }
  function ctxClear() {
    if (!ctxDate) return
    setDb((prev) => { const n = { ...prev }; delete n[ctxDate!]; return n })
    setIsDirty(true)
    hideCtx()
  }

  /* ── Batch ── */
  function batchWeekday(dow: number, state: DayState) {
    const totalDays = new Date(curY, curM + 1, 0).getDate()
    const firstDow  = new Date(curY, curM, 1).getDay()
    const updates: Record<string, DayRecord> = {}
    for (let d = 1; d <= totalDays; d++) {
      if ((firstDow + d - 1) % 7 !== dow) continue
      const k     = fmtKey(curY, curM + 1, d)
      const label = db[k]?.label ?? null
      updates[k] = { state: state ?? null, label }
    }
    setDb((prev) => {
      const next = { ...prev, ...updates }
      Object.keys(updates).forEach((k) => { if (!next[k].state && !next[k].label) delete next[k] })
      return next
    })
    setIsDirty(true)
  }

  function batchAll(state: DayState) {
    const totalDays = new Date(curY, curM + 1, 0).getDate()
    const updates: Record<string, DayRecord> = {}
    const toDelete: string[] = []
    for (let d = 1; d <= totalDays; d++) {
      const k     = fmtKey(curY, curM + 1, d)
      const label = db[k]?.label ?? null
      if (state) {
        updates[k] = { state, label }
      } else if (label) {
        updates[k] = { state: null, label }
      } else {
        toDelete.push(k)
      }
    }
    setDb((prev) => {
      const next = { ...prev, ...updates }
      toDelete.forEach((k) => delete next[k])
      return next
    })
    setIsDirty(true)
  }

  /* ── Range apply ── */
  function applyRange(state: DayState) {
    if (!rangePicker) return
    const lo = Math.min(rangePicker.start, rangePicker.end)
    const hi = Math.max(rangePicker.start, rangePicker.end)
    const updates: Record<string, DayRecord> = {}
    const toDelete: string[] = []
    for (let d = lo; d <= hi; d++) {
      const k     = fmtKey(curY, curM + 1, d)
      const label = db[k]?.label ?? null
      if (state) {
        updates[k] = { state, label }
      } else if (label) {
        updates[k] = { state: null, label }
      } else {
        toDelete.push(k)
      }
    }
    setDb((prev) => {
      const next = { ...prev, ...updates }
      toDelete.forEach((k) => delete next[k])
      return next
    })
    setIsDirty(true)
    setRangePicker(null); setRangeStart(null); setRangeHover(null); setRangeMode(false)
  }
  function cancelRange() {
    setRangePicker(null); setRangeStart(null); setRangeHover(null); setRangeMode(false)
  }

  /* ── Label modal ── */
  function openLabelModal(key: string) {
    setLabelDate(key)
    setLabelInput(db[key]?.label ?? '')
    setLabelOpen(true)
    hideCtx()
  }
  function saveLabel() {
    if (!labelDate) return
    const v = labelInput.trim() || null
    const existingState = db[labelDate]?.state ?? null
    const newRec: DayRecord | null = (v || existingState)
      ? { state: existingState, label: v }
      : null
    setDb((prev) => {
      const next = { ...prev }
      if (newRec) next[labelDate!] = newRec
      else delete next[labelDate!]
      return next
    })
    setIsDirty(true)
    setLabelOpen(false)
  }



  /* ── Render calendar grid ── */
  const firstDow = new Date(curY, curM, 1).getDay()
  const totalDays = new Date(curY, curM + 1, 0).getDate()
  const todayKey = fmtKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const DOW_LABELS = ['일','월','화','수','목','금','토']

  const labelDateParsed = labelDate ? labelDate.split('-') : null

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
        {saving && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            저장 중...
          </span>
        )}
        {!saving && lastSaved && !isDirty && !saveError && (
          <span className="text-xs text-green-600 font-semibold">✓ 저장됨</span>
        )}
        {isDirty && !saving && (
          <span className="text-xs text-amber-500 font-semibold">● 저장 안됨</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => saveAll(db, curY, curM)}
            disabled={!isDirty || saving}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              isDirty && !saving
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            💾 저장
          </button>
          <button
            onClick={() => setImgOpen(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5"
          >
            🖼️ 이미지 생성
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
          <span>⚠️</span>
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 font-bold text-base leading-none">✕</button>
        </div>
      )}

      {/* Calendar card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button onClick={() => goMonth(-1)} className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center text-gray-600 transition">←</button>
          <h3 className="text-lg font-extrabold text-gray-800">{curY}년 {curM + 1}월</h3>
          <button onClick={() => goMonth(1)} className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center text-gray-600 transition">→</button>
        </div>

        {/* Batch bar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-400 mr-1">일괄 적용</span>
          {[
            { label: '🔴 일요일 전체 휴무', bg: '#FFE4E7', color: '#C41F2E', action: () => batchWeekday(0, 'closed') },
            { label: '🔴 토요일 전체 휴무', bg: '#FFE4E7', color: '#C41F2E', action: () => batchWeekday(6, 'closed') },
            { label: '🔵 토요일 오전진료',  bg: '#E4EEFF', color: '#1D58D0', action: () => batchWeekday(6, 'morning') },
            { label: '🟢 전체 정상진료',    bg: '#DDFAED', color: '#1E8A5E', action: () => batchAll('open') },
            { label: '✕ 이달 전체 초기화',  bg: '#F5E4E4', color: '#999',    action: () => batchAll(null) },
          ].map((b) => (
            <button key={b.label} onClick={b.action}
              style={{ background: b.bg, color: b.color }}
              className="text-[11px] font-bold px-3 py-1 rounded-md border-none cursor-pointer hover:brightness-95 transition">
              {b.label}
            </button>
          ))}
          <button
            onClick={() => { setRangeMode((v) => !v); setRangeStart(null); setRangeHover(null); setRangePicker(null) }}
            className={`text-[11px] font-bold px-3 py-1 rounded-md border-none cursor-pointer transition ml-auto ${
              rangeMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            📅 범위 선택{rangeMode ? ' ON' : ''}
          </button>
        </div>

        {/* Range mode hint */}
        {rangeMode && (
          <div className="flex items-center gap-2 px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-700">
            <span className="text-blue-500">ℹ️</span>
            {!rangeStart
              ? '시작 날짜를 클릭하세요.'
              : `${rangeStart}일 선택됨. 끝 날짜를 클릭하세요.`}
            <button onClick={cancelRange} className="ml-auto text-blue-400 hover:text-blue-700 font-bold">취소 ✕</button>
          </div>
        )}

        {/* DOW header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {DOW_LABELS.map((d, i) => (
            <div key={d} className={`text-center py-2 text-[11px] font-bold tracking-widest ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7" onClick={() => { hideCtx(); if (rangeMode && rangePicker) cancelRange() }}>
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`e-${i}`} className="min-h-[78px] border-r border-b border-gray-100 bg-gray-50/50" />
          ))}
          {Array.from({ length: totalDays }).map((_, idx) => {
            const d = idx + 1
            const dow = (firstDow + idx) % 7
            const key = fmtKey(curY, curM + 1, d)
            const rec = db[key]
            const isToday = key === todayKey
            const sc = rec?.state ? SCFG[rec.state] : null

            // Range highlight
            const inRangePreview = rangeMode && rangeStart !== null && rangeHover !== null && !rangePicker
              && d >= Math.min(rangeStart, rangeHover) && d <= Math.max(rangeStart, rangeHover)
            const isRangeStart = rangeMode && rangeStart === d

            return (
              <div
                key={key}
                data-state={rec?.state}
                onClick={(e) => {
                  e.stopPropagation()
                  if (rangeMode) {
                    if (!rangeStart) {
                      setRangeStart(d)
                    } else if (!rangePicker) {
                      setRangePicker({
                        x: Math.min(e.clientX, window.innerWidth - 230),
                        y: Math.min(e.clientY, window.innerHeight - 240),
                        start: rangeStart,
                        end: d,
                      })
                    }
                  } else {
                    cycleState(key)
                  }
                }}
                onMouseEnter={() => {
                  if (rangeMode && rangeStart && !rangePicker) setRangeHover(d)
                }}
                onContextMenu={(e) => { if (!rangeMode) showCtx(e, key) }}
                className={`min-h-[78px] border-r border-b border-gray-100 p-1.5 cursor-pointer transition-colors select-none relative
                  ${dow === 6 ? 'border-r-0' : ''}
                  ${inRangePreview ? 'bg-blue-100/70 ring-inset ring-1 ring-blue-300' : 'hover:bg-blue-50/60'}
                  ${isRangeStart  ? 'ring-inset ring-2 ring-blue-500' : ''}
                  ${!inRangePreview && rec?.state === 'open'      ? 'bg-green-50/30'  : ''}
                  ${!inRangePreview && rec?.state === 'morning'   ? 'bg-blue-50/30'   : ''}
                  ${!inRangePreview && rec?.state === 'afternoon' ? 'bg-amber-50/30'  : ''}
                  ${!inRangePreview && rec?.state === 'closed'    ? 'bg-red-50/40'    : ''}
                `}
              >
                <span className={`block text-center text-[13px] font-bold mb-1
                  ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                  {d}
                  {isToday && <span className="block w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto mt-0.5" />}
                </span>
                {sc && (
                  <span className="block text-center text-[10px] font-extrabold px-0.5 py-0.5 rounded-[5px] mb-0.5"
                    style={{ background: sc.bg, color: sc.color }}>
                    {sc.text}
                  </span>
                )}
                {rec?.label && (
                  <span className="block text-center text-[9px] font-semibold text-gray-400 leading-tight">{rec.label}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t border-gray-100 bg-gray-50">
          {Object.entries(SCFG).map(([key, sc]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <span className="w-3 h-3 rounded-[3px] inline-block" style={{ background: sc.color }} />
              {sc.text}
            </div>
          ))}
          <span className="ml-auto text-[11px] text-gray-300">우클릭 → 명절·특정일 라벨 설정</span>
        </div>
      </div>

      {/* ── Range Picker Popup ── */}
      {rangePicker && (
        <div
          className="fixed z-50 bg-white border border-blue-200 rounded-xl shadow-2xl p-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: rangePicker.x, top: rangePicker.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-bold text-blue-600 mb-2 text-center">
            {Math.min(rangePicker.start, rangePicker.end)}일 ~ {Math.max(rangePicker.start, rangePicker.end)}일 일괄 적용
          </p>
          {([['open','🟢','정상진료'],['morning','🔵','오전진료'],['afternoon','🟠','오후진료'],['closed','🔴','휴무']] as [DayState, string, string][]).map(([s, icon, label]) => (
            <div key={s} onClick={() => applyRange(s)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-50 text-gray-700">
              <span>{icon}</span>{label}
            </div>
          ))}
          <div className="h-px bg-gray-100 my-1" />
          <div onClick={() => applyRange(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-red-50 text-red-500">
            ✕ 초기화
          </div>
          <div onClick={cancelRange}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50 text-gray-400">
            취소
          </div>
        </div>
      )}

      {/* ── Context Menu ── */}
      {ctxVisible && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-1.5 min-w-[168px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: ctxPos.x, top: ctxPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {([['open','🟢','정상진료'],['morning','🔵','오전진료'],['afternoon','🟠','오후진료'],['closed','🔴','휴무']] as [DayState, string, string][]).map(([s, icon, label]) => (
            <div key={s} onClick={() => ctxSet(s)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-50 text-gray-700">
              <span>{icon}</span>{label}
            </div>
          ))}
          <div className="h-px bg-gray-100 my-1" />
          <div onClick={() => ctxDate && openLabelModal(ctxDate)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-50 text-gray-700">
            🏷️ 특정일 라벨 설정
          </div>
          <div onClick={ctxClear}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-red-50 text-red-600">
            ✕ 초기화
          </div>
        </div>
      )}

      {/* ── Label Modal ── */}
      {labelOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setLabelOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-[480px] max-w-[94vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-800 mb-1">🏷️ 특정일 라벨 설정</h3>
            {labelDateParsed && (
              <p className="text-xs text-gray-400 font-semibold mb-4">
                {labelDateParsed[0]}년 {parseInt(labelDateParsed[1])}월 {parseInt(labelDateParsed[2])}일
              </p>
            )}
            <input
              type="text" value={labelInput} onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
              placeholder="라벨 입력 (예: 추석, 설날, 개원기념일)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400"
              autoFocus
            />
            <div className="flex flex-wrap gap-2 mb-5">
              {QUICK_LABELS.map((l) => (
                <button key={l} onClick={() => setLabelInput(l)}
                  className="px-2.5 py-1 rounded-md border border-gray-200 text-xs font-bold text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition">
                  {l}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setLabelOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-100 transition">취소</button>
              <button onClick={saveLabel} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Export Modal (4 templates) ── */}
      <HospitalImageExport
        hospitalName={hospitalName}
        db={db}
        open={imgOpen}
        onClose={() => setImgOpen(false)}
        defaultStart={fmtKey(curY, curM + 1, 1)}
        defaultEnd={fmtKey(curY, curM + 1, new Date(curY, curM + 1, 0).getDate())}
      />

      <p className="text-xs text-gray-400 px-1">
        💡 날짜 클릭 → 상태 순환 (정상진료 → 오전 → 오후 → 휴무 → 초기화) &nbsp;|&nbsp;
        🖱️ 우클릭 → 상세 설정 &nbsp;|&nbsp;
        📅 범위 선택 → 시작일·끝일 클릭 후 상태 선택
      </p>
    </div>
  )
}
