'use client'

import { useState } from 'react'
import HospitalCalendar from './HospitalCalendar'
import DoctorScheduleGrid from './DoctorScheduleGrid'

interface Org {
  id: string
  name: string
  specialty: string
}

interface Props {
  orgs: Org[]
}

type Tab = 'calendar' | 'doctors'

export default function ScheduleManager({ orgs }: Props) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(orgs[0]?.id ?? '')
  const [tab, setTab] = useState<Tab>('calendar')

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId)

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="text-5xl mb-4">🏥</span>
        <p className="text-gray-500 font-semibold">등록된 병원이 없습니다.</p>
        <p className="text-sm text-gray-400 mt-1">먼저 병원을 등록해 주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hospital selector */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-bold text-gray-400 mb-1.5">병원 선택</label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-gray-50"
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                🏥 {org.name} {org.specialty ? `— ${org.specialty}` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedOrg && (
          <div className="flex items-center gap-2 text-sm text-gray-500 pb-0.5">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="font-medium">{selectedOrg.name}</span>
            {selectedOrg.specialty && <span className="text-gray-400">· {selectedOrg.specialty}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'calendar', label: '📅 월별 일정', desc: '병원 진료일 관리' },
          { id: 'doctors',  label: '👨‍⚕️ 의사 스케줄', desc: '의사별 시간표 관리' },
        ] as { id: Tab; label: string; desc: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — key forces remount on hospital change */}
      {selectedOrg && tab === 'calendar' && (
        <HospitalCalendar
          key={`cal-${selectedOrgId}`}
          orgId={selectedOrgId}
          hospitalName={selectedOrg.name}
        />
      )}
      {selectedOrg && tab === 'doctors' && (
        <DoctorScheduleGrid
          key={`doc-${selectedOrgId}`}
          orgId={selectedOrgId}
        />
      )}
    </div>
  )
}
