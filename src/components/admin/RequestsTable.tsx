'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface RequestRow {
  id: string
  org_id: string
  org_name: string
  message: string
  category: string
  priority: string
  status: string
  source: string
  assigned_to: string | null
  telegram_chat_id: number | null
  created_at: string
}

type Filter = 'all' | 'pending' | 'in_progress' | 'completed'

const FILTER_LABELS: Record<Filter, string> = {
  all: '전체',
  pending: '대기중',
  in_progress: '진행중',
  completed: '완료',
}

const SOURCE_COLOR: Record<string, string> = {
  telegram: 'bg-blue-100 text-blue-700',
  kakao: 'bg-yellow-100 text-yellow-700',
  wechat: 'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

const SOURCE_LABEL: Record<string, string> = {
  telegram: 'Telegram',
  kakao: 'KakaoTalk',
  wechat: 'WeChat',
  instagram: 'Instagram',
  other: '기타',
}

const PRIORITY_COLOR: Record<string, string> = {
  높음: 'bg-red-100 text-red-700',
  보통: 'bg-yellow-100 text-yellow-700',
  낮음: 'bg-green-100 text-green-700',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  in_progress: '진행중',
  completed: '완료',
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기중' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
]

export default function RequestsTable({ initial }: { initial: RequestRow[] }) {
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  // Group by org
  const groups = filtered.reduce<{ org_id: string; org_name: string; requests: RequestRow[] }[]>(
    (acc, row) => {
      const existing = acc.find((g) => g.org_id === row.org_id)
      if (existing) {
        existing.requests.push(row)
      } else {
        acc.push({ org_id: row.org_id, org_name: row.org_name, requests: [row] })
      }
      return acc
    },
    []
  )

  function toggleGroup(org_id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(org_id)) next.delete(org_id)
      else next.add(org_id)
      return next
    })
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      startTransition(() => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
      })
    }
  }

  async function updateAssignee(id: string, assigned_to: string) {
    await fetch(`/api/admin/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: rows.find((r) => r.id === id)?.status ?? 'pending', assigned_to }),
    })
    startTransition(() => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, assigned_to } : r)))
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-purple-900 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
            }`}
          >
            {FILTER_LABELS[f]}
            <span className={`ml-1.5 text-xs ${filter === f ? 'opacity-70' : 'text-gray-400'}`}>
              {f === 'all' ? rows.length : rows.filter((r) => r.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              해당하는 요청이 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-8" />
                    <th className="text-left px-4 py-3 font-medium text-gray-600">병원명</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">요청 수</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상태 현황</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">최근 접수일</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const isOpen = expanded.has(group.org_id)
                    const counts = {
                      pending: group.requests.filter((r) => r.status === 'pending').length,
                      in_progress: group.requests.filter((r) => r.status === 'in_progress').length,
                      completed: group.requests.filter((r) => r.status === 'completed').length,
                    }
                    const latest = group.requests.reduce((a, b) =>
                      new Date(a.created_at) > new Date(b.created_at) ? a : b
                    )

                    return (
                      <>
                        {/* Group header row */}
                        <tr
                          key={group.org_id}
                          onClick={() => toggleGroup(group.org_id)}
                          className="cursor-pointer hover:bg-purple-50/50 transition-colors border-b border-gray-100"
                        >
                          <td className="px-4 py-3 text-gray-400">
                            {isOpen
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />
                            }
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{group.org_name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {group.requests.length}건
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              {counts.pending > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  대기중 {counts.pending}
                                </span>
                              )}
                              {counts.in_progress > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  진행중 {counts.in_progress}
                                </span>
                              )}
                              {counts.completed > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  완료 {counts.completed}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(latest.created_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>

                        {/* Expanded child rows */}
                        {isOpen && (
                          <>
                            <tr className="bg-gray-50/80">
                              <td />
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">요청내용</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">출처</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">카테고리</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">우선순위</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">상태</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">담당자</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">접수일</th>
                            </tr>
                            {group.requests.map((row) => (
                              <tr key={row.id} className="bg-gray-50/40 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="pl-6 text-gray-300 py-3">└</td>
                                <td className="px-4 py-3 text-gray-600 max-w-xs">
                                  <p className="truncate" title={row.message}>{row.message}</p>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLOR[row.source] ?? SOURCE_COLOR.other}`}>
                                    {SOURCE_LABEL[row.source] ?? row.source}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Badge variant="outline" className="text-xs">{row.category}</Badge>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[row.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {row.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Select
                                    defaultValue={row.status}
                                    onValueChange={(val) => val && updateStatus(row.id, val)}
                                  >
                                    <SelectTrigger className={`h-7 text-xs w-24 border-0 ${STATUS_COLOR[row.status] ?? ''}`}>
                                      <SelectValue>{STATUS_LABEL[row.status] ?? row.status}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Input
                                    defaultValue={row.assigned_to ?? ''}
                                    placeholder="담당자"
                                    className="h-7 text-xs w-24 border-gray-200"
                                    onBlur={(e) => {
                                      const val = e.target.value.trim()
                                      if (val !== (row.assigned_to ?? '')) updateAssignee(row.id, val)
                                    }}
                                  />
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleDateString('ko-KR')}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
