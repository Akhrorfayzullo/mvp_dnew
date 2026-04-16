'use client'

import { useEffect, useState } from 'react'

/* ─── Types ─────────────────────────────────── */
type DayState = 'open' | 'morning' | 'afternoon' | 'closed' | null
type Template  = 'calendar' | 'badge' | 'card' | 'poster'
type ThemeKey  = 'blue' | 'teal' | 'warm' | 'dark' | 'navy' | 'green'
type BadgeColorKey = 'teal' | 'blue' | 'red' | 'dark'

interface DayRecord { state: DayState; label: string | null }
interface SpecialDay { id: string; date: string; name: string; badge: string; hours: string; note: string }

interface Props {
  hospitalName: string
  db: Record<string, DayRecord>
  open: boolean
  onClose: () => void
  defaultStart: string
  defaultEnd: string
}

/* ─── Constants ─────────────────────────────── */
const SCFG = {
  open:      { text: '정상진료', color: '#1E8A5E', bg: '#DDFAED' },
  morning:   { text: '오전진료', color: '#1D58D0', bg: '#E4EEFF' },
  afternoon: { text: '오후진료', color: '#B85C00', bg: '#FFF0D4' },
  closed:    { text: '휴  무',   color: '#C41F2E', bg: '#FFE4E7' },
}

const THEMES: Record<ThemeKey, { a: string; b: string; name: string }> = {
  blue:  { a: '#1B5FA8', b: '#1473C8', name: '블루' },
  teal:  { a: '#0E7E66', b: '#12A07E', name: '틸 그린' },
  warm:  { a: '#B82020', b: '#D12828', name: '웜 레드' },
  dark:  { a: '#1A2540', b: '#253060', name: '다크 네이비' },
  navy:  { a: '#0F1B4C', b: '#1E3A8A', name: '네이비' },
  green: { a: '#166534', b: '#16A34A', name: '딥 그린' },
}

const BADGE_COLORS: Record<BadgeColorKey, { border: string; topBg: string; name: string }> = {
  teal: { border: '#1E8A5E', topBg: '#1E8A5E', name: '틸 그린' },
  blue: { border: '#1B5FA8', topBg: '#1B5FA8', name: '블루' },
  red:  { border: '#C41F2E', topBg: '#C41F2E', name: '레드' },
  dark: { border: '#1A2540', topBg: '#1A2540', name: '다크' },
}

const TEMPLATE_META: Record<Template, { label: string; desc: string; icon: string }> = {
  calendar: { icon: '📅', label: '캘린더형',    desc: '월별 진료일정 달력' },
  badge:    { icon: '🔴', label: '휴진 배지',   desc: '원형 휴진 안내 이미지' },
  card:     { icon: '🗂️', label: '공휴일 카드', desc: '공휴일 진료시간 안내' },
  poster:   { icon: '📋', label: '포스터형',    desc: '진료 안내 전체 포스터' },
}

/* ─── Helpers ───────────────────────────────── */
function fmtKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function parseYMD(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function getMonths(s: Date, e: Date) {
  const res: { y: number; m: number }[] = []
  let c = new Date(s.getFullYear(), s.getMonth(), 1)
  while (c <= e) {
    res.push({ y: c.getFullYear(), m: c.getMonth() })
    c = new Date(c.getFullYear(), c.getMonth() + 1, 1)
  }
  return res
}
function formatDateKo(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = ['일','월','화','수','목','금','토'][dt.getDay()]
  return `${m}월 ${d}일 (${dow})`
}
function formatDateShort(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = ['일','월','화','수','목','금','토'][dt.getDay()]
  return `${m}/${d}(${dow})`
}
function genId() { return Math.random().toString(36).slice(2) }

/* ─── Template HTML builders ────────────────── */

// TEMPLATE 1: Calendar (existing design)
function buildCalendarHTML(
  hName: string, title: string, notice: string,
  theme: { a: string; b: string },
  sDate: Date, eDate: Date, db: Record<string, DayRecord>
) {
  const months = getMonths(sDate, eDate)
  const periodTxt = months.length > 1
    ? `${months[0].y}년 ${months[0].m + 1}월 ~ ${months[months.length-1].y}년 ${months[months.length-1].m+1}월`
    : `${months[0].y}년 ${months[0].m + 1}월`
  const layout = months.length > 1 ? 'display:flex;gap:20px;align-items:flex-start;' : ''
  const legendHTML = Object.entries(SCFG).map(([, sc]) => `
    <span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:10px;font-weight:700;color:#555">
      <span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${sc.color}"></span>
      ${sc.text.trim()}
    </span>`).join('')
  const calendarsHTML = months.map(({ y, m }) => buildMonthBlock(y, m, sDate, eDate, db)).join('')

  return `
  <div style="width:800px;background:#fff;font-family:'Noto Sans KR',sans-serif;border:3px solid ${theme.a};border-radius:16px;overflow:hidden;box-sizing:border-box">
    <div style="background:linear-gradient(120deg,${theme.a} 0%,${theme.b} 100%);padding:22px 30px;color:#fff;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;opacity:.8;margin-bottom:5px">🏥 ${hName}</div>
        <div style="font-size:28px;font-weight:900">${title}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;opacity:.75;margin-bottom:5px">표시 기간</div>
        <div style="font-size:13px;font-weight:700;background:rgba(255,255,255,.2);padding:6px 16px;border-radius:20px">${periodTxt}</div>
      </div>
    </div>
    <div style="padding:20px 24px 14px;${layout}">${calendarsHTML}</div>
    <div style="padding:10px 24px;border-top:1px solid #E2E8F0;background:#F8F9FB;display:flex;align-items:center;flex-wrap:wrap">${legendHTML}</div>
    ${notice ? `<div style="padding:12px 24px;border-top:1px solid #BDDAF5;background:#EBF3FF;font-size:12.5px;font-weight:600;color:#1450A0;display:flex;align-items:center;gap:8px"><span style="font-size:16px">📢</span>${notice}</div>` : ''}
  </div>`
}

function buildMonthBlock(y: number, m: number, sDate: Date, eDate: Date, db: Record<string, DayRecord>) {
  const firstDow = new Date(y, m, 1).getDay()
  const totalDays = new Date(y, m + 1, 0).getDate()
  const cells: ({ d: number; rec: DayRecord; inRange: boolean; dow: number } | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(y, m, d)
    const key = fmtKey(y, m + 1, d)
    cells.push({ d, rec: db[key] ?? { state: null, label: null }, inRange: date >= sDate && date <= eDate, dow: (firstDow + d - 1) % 7 })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  let rows = ''
  for (let r = 0; r < cells.length; r += 7) {
    const rowCells = cells.slice(r, r + 7)
    // Skip entire row if no cell in this week is within the range
    if (!rowCells.some(c => c && c.inRange)) continue
    const tds = rowCells.map((c) => {
      if (!c || !c.inRange) return `<td style="padding:4px;min-height:42px"></td>`
      const { d, rec, dow } = c
      const sc = rec.state ? SCFG[rec.state] : null
      const numColor = dow === 0 ? '#C41F2E' : dow === 6 ? '#1D58D0' : '#1A2332'
      return `<td style="text-align:center;padding:3px 2px;vertical-align:top">
        <div style="background:${sc ? sc.bg : 'transparent'};border-radius:6px;padding:3px 1px;min-height:42px">
          <div style="font-size:12px;font-weight:700;color:${numColor}">${d}</div>
          ${sc ? `<div style="font-size:8.5px;font-weight:800;color:${sc.color}">${sc.text.trim()}</div>` : ''}
          ${rec.label ? `<div style="font-size:8px;color:#888;font-weight:600">${rec.label}</div>` : ''}
        </div></td>`
    }).join('')
    rows += `<tr>${tds}</tr>`
  }
  const dowHdr = ['일','월','화','수','목','금','토'].map((d, i) =>
    `<th style="font-size:10px;font-weight:700;padding:5px 0;text-align:center;color:${i===0?'#C41F2E':i===6?'#1D58D0':'#8899AA'}">${d}</th>`
  ).join('')
  return `<div style="flex:1;min-width:0">
    <div style="font-size:15px;font-weight:800;color:#1A2332;text-align:center;margin-bottom:8px">${y}년 ${m+1}월</div>
    <table style="width:100%;border-collapse:separate;border-spacing:2px 0"><thead><tr>${dowHdr}</tr></thead><tbody>${rows}</tbody></table>
  </div>`
}

// TEMPLATE 2: Badge (circular)
function buildBadgeHTML(hName: string, startDate: string, endDate: string, type: string, message: string, colorKey: BadgeColorKey) {
  const bc = BADGE_COLORS[colorKey]
  const dateRange = startDate === endDate
    ? formatDateShort(startDate)
    : `${formatDateShort(startDate)} ~ ${formatDateShort(endDate)}`
  const isClose = type === '휴진' || type === '임시휴진'

  return `
  <div style="width:500px;height:500px;background:linear-gradient(180deg,${bc.topBg} 45%,#9CA3AF 100%);display:flex;align-items:center;justify-content:center;font-family:'Noto Sans KR',sans-serif;box-sizing:border-box">
    <div style="width:452px;height:452px;border-radius:50%;background:white;border:11px solid ${bc.border};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px rgba(255,255,255,.35),inset 0 0 0 3px ${bc.border}22">
      <div style="text-align:center;padding:28px">
        <div style="font-size:14px;color:#666;margin-bottom:10px;font-weight:500">🏥 ${hName}</div>
        <div style="font-size:${startDate === endDate ? '28' : '22'}px;font-weight:900;color:#1A2332;line-height:1.3;margin-bottom:14px">${dateRange}</div>
        <div style="font-size:${isClose ? '62' : '36'}px;font-weight:900;color:${isClose ? '#C41F2E' : bc.border};line-height:1;margin-bottom:16px">${type}</div>
        <div style="width:56px;height:2px;background:#E2E8F0;margin:0 auto 14px"></div>
        <div style="font-size:13px;color:#94A3B8;line-height:1.75;white-space:pre-line;font-weight:500">${message}</div>
      </div>
    </div>
  </div>`
}

// TEMPLATE 3: Holiday card
function buildCardHTML(hName: string, title: string, days: SpecialDay[], phone: string, emergencyNote: string, themeKey: ThemeKey) {
  const theme = THEMES[themeKey]
  const rowsHTML = days.map(d => `
  <div style="border-bottom:1px solid #E2E8F0">
    <div style="background:#1E293B;padding:12px 24px;color:white">
      <span style="font-size:16px;font-weight:800">${formatDateKo(d.date)}${d.name ? ' ' + d.name : ''}</span>
    </div>
    <div style="padding:16px 24px 14px;background:#F8FAFC">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${d.note ? '8' : '0'}px">
        ${d.badge ? `<span style="background:#DBEAFE;color:#1D4ED8;font-size:12px;font-weight:800;padding:5px 13px;border-radius:5px;border:1.5px solid #93C5FD">${d.badge}</span>` : ''}
        <span style="font-size:26px;font-weight:900;color:#1A2332">${d.hours}</span>
      </div>
      ${d.note ? `<div style="font-size:12px;color:#94A3B8">${d.note}</div>` : ''}
    </div>
  </div>`).join('')

  return `
  <div style="width:800px;background:#fff;font-family:'Noto Sans KR',sans-serif;border-radius:14px;overflow:hidden;border:2.5px solid ${theme.a};box-sizing:border-box">
    <div style="background:linear-gradient(120deg,${theme.a} 0%,${theme.b} 100%);padding:22px 28px;color:white">
      <div style="font-size:12px;opacity:.75;margin-bottom:6px">🏥 ${hName}</div>
      <div style="font-size:26px;font-weight:900">${title}</div>
    </div>
    ${rowsHTML}
    ${phone ? `
    <div style="background:${theme.a};padding:14px 24px;color:white;display:flex;align-items:center;gap:16px">
      <span style="font-size:22px;font-weight:900;letter-spacing:1px">${phone}</span>
      ${emergencyNote ? `<span style="font-size:12px;opacity:.8">${emergencyNote}</span>` : ''}
    </div>` : ''}
  </div>`
}

// TEMPLATE 4: Poster
function buildPosterHTML(hName: string, title: string, subtitle: string, days: SpecialDay[], phone: string, emergencyNote: string, themeKey: ThemeKey) {
  const theme = THEMES[themeKey]
  const blocksHTML = days.map(d => `
  <div style="margin:0 20px 12px;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0">
    <div style="background:#1E293B;padding:13px 18px;color:white">
      <span style="font-size:17px;font-weight:800">${formatDateKo(d.date)}${d.name ? ' ' + d.name : ''}</span>
    </div>
    <div style="padding:15px 18px;background:white">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:${d.note ? '8' : '0'}px">
        ${d.badge ? `<span style="background:#FEF08A;color:#713F12;font-size:12px;font-weight:900;padding:5px 13px;border-radius:5px">${d.badge}</span>` : ''}
        <span style="font-size:28px;font-weight:900;color:#1A2332">${d.hours}</span>
      </div>
      ${d.note ? `<div style="font-size:12px;color:#94A3B8;background:#F8FAFC;padding:7px 11px;border-radius:5px">${d.note}</div>` : ''}
    </div>
  </div>`).join('')

  return `
  <div style="width:600px;background:#fff;font-family:'Noto Sans KR',sans-serif;border-radius:14px;overflow:hidden;box-sizing:border-box">
    <div style="background:linear-gradient(135deg,${theme.a} 0%,${theme.b} 100%);padding:36px 32px;text-align:center;color:white">
      <div style="font-size:14px;opacity:.75;margin-bottom:10px">🏥 ${hName}</div>
      <div style="font-size:44px;font-weight:900;line-height:1.1;letter-spacing:-.02em">${title}</div>
      ${subtitle ? `<div style="font-size:15px;opacity:.82;margin-top:10px">${subtitle}</div>` : ''}
    </div>
    <div style="height:16px"></div>
    ${blocksHTML}
    <div style="height:${phone ? '0' : '16'}px"></div>
    ${phone ? `
    <div style="margin-top:4px;background:#1E293B;padding:18px 24px;color:white;display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:24px;font-weight:900;letter-spacing:1.5px;color:#FEF08A">${phone}</span>
      ${emergencyNote ? `<span style="font-size:12px;opacity:.7">${emergencyNote}</span>` : ''}
    </div>` : ''}
  </div>`
}

/* ════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════ */
export default function HospitalImageExport({ hospitalName, db, open, onClose, defaultStart, defaultEnd }: Props) {
  const [template,  setTemplate]  = useState<Template>('calendar')
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null)
  const [status,    setStatus]    = useState('이미지를 생성하려면 아래 버튼을 누르세요.')

  // ── Calendar template ──
  const [calStart,  setCalStart]  = useState(defaultStart)
  const [calEnd,    setCalEnd]    = useState(defaultEnd)
  const [calTitle,  setCalTitle]  = useState('진료 안내')
  const [calStyle,  setCalStyle]  = useState<ThemeKey>('blue')
  const [calNotice, setCalNotice] = useState('')

  // ── Badge template ──
  const [badgeStart, setBadgeStart] = useState(defaultStart)
  const [badgeEnd,   setBadgeEnd]   = useState(defaultEnd)
  const [badgeType,  setBadgeType]  = useState('휴진')
  const [badgeMsg,   setBadgeMsg]   = useState('위 날짜에 휴진하오니\n내원에 참고 부탁드립니다.')
  const [badgeColor, setBadgeColor] = useState<BadgeColorKey>('teal')

  // ── Card & Poster shared ──
  const [specialDays,   setSpecialDays]   = useState<SpecialDay[]>([])
  const [phone,         setPhone]         = useState('')
  const [emergencyNote, setEmergencyNote] = useState('응급 진료 365일 연중무휴')

  // ── Card template ──
  const [cardTitle, setCardTitle] = useState('진료안내')
  const [cardTheme, setCardTheme] = useState<ThemeKey>('blue')

  // ── Poster template ──
  const [posterTitle,    setPosterTitle]    = useState('진료안내')
  const [posterSubtitle, setPosterSubtitle] = useState('진료일정을 미리 안내 드립니다.')
  const [posterTheme,    setPosterTheme]    = useState<ThemeKey>('dark')

  // Reset preview when template changes
  useEffect(() => { setImgDataUrl(null); setStatus('이미지를 생성하려면 아래 버튼을 누르세요.') }, [template])

  // Auto-populate special days from DB labeled days when switching to card/poster
  useEffect(() => {
    if (template !== 'card' && template !== 'poster') return
    if (specialDays.length > 0) return
    const labeled = Object.entries(db)
      .filter(([, r]) => r.label)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, r]) => ({
        id:    genId(),
        date,
        name:  r.label!,
        badge: r.state === 'closed' ? '휴진' : r.state === 'morning' ? '오전진료' : '공휴일진료',
        hours: r.state === 'closed' ? '휴진' : r.state === 'morning' ? 'AM 09:00 ~ PM 01:00' : 'AM 09:00 ~ PM 06:00',
        note:  '',
      }))
    setSpecialDays(labeled.length > 0 ? labeled : [{ id: genId(), date: defaultStart, name: '', badge: '공휴일진료', hours: 'AM 09:00 ~ PM 06:00', note: '' }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template])

  /* ── Special day helpers ── */
  function addDay() {
    setSpecialDays(p => [...p, { id: genId(), date: defaultStart, name: '', badge: '공휴일진료', hours: 'AM 09:00 ~ PM 06:00', note: '' }])
  }
  function updateDay(id: string, field: keyof SpecialDay, val: string) {
    setSpecialDays(p => p.map(d => d.id === id ? { ...d, [field]: val } : d))
  }
  function removeDay(id: string) {
    setSpecialDays(p => p.filter(d => d.id !== id))
  }

  /* ── Load html2canvas ── */
  async function loadHtml2Canvas() {
    if ((window as unknown as Record<string, unknown>).html2canvas) return
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      s.onload  = () => resolve()
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  /* ── Generate image ── */
  async function generate() {
    setStatus('⏳ 이미지 생성 중...')
    setImgDataUrl(null)

    let html = ''
    try {
      if (template === 'calendar') {
        if (!calStart || !calEnd) { alert('캘린더 표시 기간을 설정하세요.'); setStatus(''); return }
        const sDate = parseYMD(calStart), eDate = parseYMD(calEnd)
        if (sDate > eDate) { alert('시작일이 종료일보다 늦습니다.'); setStatus(''); return }
        html = buildCalendarHTML(hospitalName, calTitle, calNotice, THEMES[calStyle], sDate, eDate, db)

      } else if (template === 'badge') {
        if (!badgeStart) { alert('날짜를 입력하세요.'); setStatus(''); return }
        html = buildBadgeHTML(hospitalName, badgeStart, badgeEnd || badgeStart, badgeType, badgeMsg, badgeColor)

      } else if (template === 'card') {
        if (specialDays.length === 0) { alert('날짜를 하나 이상 추가하세요.'); setStatus(''); return }
        html = buildCardHTML(hospitalName, cardTitle, specialDays, phone, emergencyNote, cardTheme)

      } else if (template === 'poster') {
        if (specialDays.length === 0) { alert('날짜를 하나 이상 추가하세요.'); setStatus(''); return }
        html = buildPosterHTML(hospitalName, posterTitle, posterSubtitle, specialDays, phone, emergencyNote, posterTheme)
      }

      const tpl = document.createElement('div')
      tpl.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none'
      tpl.innerHTML = html
      document.body.appendChild(tpl)

      await loadHtml2Canvas()
      await new Promise(r => setTimeout(r, 350))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await (window as any).html2canvas(tpl, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      document.body.removeChild(tpl)
      setImgDataUrl(canvas.toDataURL('image/png'))
      setStatus('✅ 완료! 이미지를 클릭하거나 다운로드 버튼을 누르세요.')
    } catch {
      if (document.body.contains(document.querySelector('[style*="-9999px"]'))) {
        document.body.removeChild(document.querySelector('[style*="-9999px"]')!)
      }
      setStatus('❌ 생성 실패. 다시 시도해 주세요.')
    }
  }

  function download() {
    if (!imgDataUrl) { alert('먼저 이미지를 생성하세요.'); return }
    const label = template === 'calendar' ? calTitle : template === 'badge' ? badgeType : template === 'card' ? cardTitle : posterTitle
    const a = document.createElement('a')
    a.download = `${hospitalName}_${label}.png`
    a.href = imgDataUrl
    a.click()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[min(760px,97vw)] max-h-[94vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-extrabold text-gray-800">🖼️ 팝업 이미지 생성</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Template selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2">템플릿 선택</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(TEMPLATE_META) as [Template, typeof TEMPLATE_META[Template]][]).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setTemplate(key)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition ${
                    template === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="text-xl">{meta.icon}</span>
                  <span className="text-xs font-bold">{meta.label}</span>
                  <span className="text-[10px] text-gray-400 leading-tight">{meta.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* ── CALENDAR inputs ── */}
          {template === 'calendar' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">캘린더 표시 기간</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={calStart} onChange={e => setCalStart(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    <span className="text-gray-400 text-xs font-bold">~</span>
                    <input type="date" value={calEnd}   onChange={e => setCalEnd(e.target.value)}   className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">이미지 제목</label>
                  <input type="text" value={calTitle} onChange={e => setCalTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">색상 테마</label>
                  <select value={calStyle} onChange={e => setCalStyle(e.target.value as ThemeKey)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([k, t]) => (
                      <option key={k} value={k}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">하단 안내 문구 (선택)</label>
                  <input type="text" value={calNotice} onChange={e => setCalNotice(e.target.value)} placeholder="예) 응급 진료 365일 24시간 운영" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* ── BADGE inputs ── */}
          {template === 'badge' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">날짜 (시작)</label>
                  <input type="date" value={badgeStart} onChange={e => setBadgeStart(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">날짜 (종료, 단일이면 같은 날)</label>
                  <input type="date" value={badgeEnd} onChange={e => setBadgeEnd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">안내 유형</label>
                  <select value={badgeType} onChange={e => setBadgeType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    {['휴진','임시휴진','정기휴진','공휴일진료','오전진료'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">배지 색상</label>
                  <select value={badgeColor} onChange={e => setBadgeColor(e.target.value as BadgeColorKey)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    {(Object.entries(BADGE_COLORS) as [BadgeColorKey, typeof BADGE_COLORS[BadgeColorKey]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">안내 메시지</label>
                <textarea value={badgeMsg} onChange={e => setBadgeMsg(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
              </div>
            </div>
          )}

          {/* ── CARD inputs ── */}
          {template === 'card' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">제목</label>
                  <input type="text" value={cardTitle} onChange={e => setCardTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">색상 테마</label>
                  <select value={cardTheme} onChange={e => setCardTheme(e.target.value as ThemeKey)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <SpecialDaysEditor days={specialDays} onAdd={addDay} onUpdate={updateDay} onRemove={removeDay} />
              <PhoneEditor phone={phone} setPhone={setPhone} emergencyNote={emergencyNote} setEmergencyNote={setEmergencyNote} />
            </div>
          )}

          {/* ── POSTER inputs ── */}
          {template === 'poster' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">포스터 제목</label>
                  <input type="text" value={posterTitle} onChange={e => setPosterTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">색상 테마</label>
                  <select value={posterTheme} onChange={e => setPosterTheme(e.target.value as ThemeKey)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">부제목 (선택)</label>
                <input type="text" value={posterSubtitle} onChange={e => setPosterSubtitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
              </div>
              <SpecialDaysEditor days={specialDays} onAdd={addDay} onUpdate={updateDay} onRemove={removeDay} />
              <PhoneEditor phone={phone} setPhone={setPhone} emergencyNote={emergencyNote} setEmergencyNote={setEmergencyNote} />
            </div>
          )}

          {/* Status + Preview */}
          <p className="text-xs text-center text-gray-400">{status}</p>
          {imgDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgDataUrl}
              onClick={download}
              className="block w-full rounded-xl border border-gray-200 cursor-pointer shadow-sm"
              title="클릭하여 다운로드"
              alt="생성된 이미지 미리보기"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50">
          <button onClick={onClose}  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-100 transition">닫기</button>
          <button onClick={generate} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition">🔄 이미지 생성</button>
          <button onClick={download} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition">⬇️ PNG 다운로드</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─────────────────────────── */
function SpecialDaysEditor({ days, onAdd, onUpdate, onRemove }: {
  days: SpecialDay[]
  onAdd: () => void
  onUpdate: (id: string, field: keyof SpecialDay, val: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-gray-400">특별 진료일 목록</label>
        <button onClick={onAdd} className="text-xs font-bold text-blue-600 hover:underline">+ 날짜 추가</button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {days.map(d => (
          <div key={d.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">날짜</label>
                <input type="date" value={d.date} onChange={e => onUpdate(d.id, 'date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">이름 (예: 선거일)</label>
                <input type="text" value={d.name} onChange={e => onUpdate(d.id, 'name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">배지 라벨</label>
                <input type="text" value={d.badge} onChange={e => onUpdate(d.id, 'badge', e.target.value)} placeholder="예: 공휴일진료" className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">진료 시간</label>
                <input type="text" value={d.hours} onChange={e => onUpdate(d.id, 'hours', e.target.value)} placeholder="AM 09:00 ~ PM 06:00" className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">비고</label>
                <input type="text" value={d.note} onChange={e => onUpdate(d.id, 'note', e.target.value)} placeholder="예: 점심 1~2시" className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => onRemove(d.id)} className="text-[10px] text-red-400 hover:text-red-600 font-bold">삭제</button>
            </div>
          </div>
        ))}
        {days.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-400">날짜를 추가하세요</div>
        )}
      </div>
    </div>
  )
}

function PhoneEditor({ phone, setPhone, emergencyNote, setEmergencyNote }: {
  phone: string; setPhone: (v: string) => void
  emergencyNote: string; setEmergencyNote: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-bold text-gray-400 mb-1.5">전화번호 (하단 표시)</label>
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="예: 031-512-1119" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-400 mb-1.5">응급 안내 문구</label>
        <input type="text" value={emergencyNote} onChange={e => setEmergencyNote(e.target.value)} placeholder="예: 응급 진료 365일 연중무휴" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
      </div>
    </div>
  )
}
