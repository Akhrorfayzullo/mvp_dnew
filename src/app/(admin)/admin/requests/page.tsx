import { createServiceClient } from '@/lib/supabase/server'
import { MessageSquare } from 'lucide-react'
import RequestsTable, { type RequestRow } from '@/components/admin/RequestsTable'

export const dynamic = 'force-dynamic'

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ org_id?: string }>
}) {
  const { org_id } = await searchParams
  const supabase = await createServiceClient()

  let query = supabase.from('requests').select('*, organizations(name)').order('created_at', { ascending: false })
  if (org_id) query = query.eq('org_id', org_id)

  const { data: requests } = await query

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows: RequestRow[] = (requests ?? []).map((r: any) => ({
    id: r.id,
    org_id: r.org_id,
    org_name: (r.organizations as any)?.name ?? '알 수 없음',
    message: r.message,
    category: r.category,
    priority: r.priority,
    status: r.status,
    source: r.source ?? 'telegram',
    assigned_to: r.assigned_to ?? null,
    telegram_chat_id: r.telegram_chat_id ?? null,
    created_at: r.created_at,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const counts = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    completed: rows.filter((r) => r.status === 'completed').length,
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            요청 관리
          </h1>
          <p className="text-sm text-muted-foreground">
            {org_id ? '선택된 병원의 요청사항' : '텔레그램으로 접수된 병원 요청사항'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {org_id && (
            <a href="/admin/requests" className="text-sm text-purple-600 hover:underline">
              ← 전체 요청 보기
            </a>
          )}
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
              <p className="text-xs text-muted-foreground">전체</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{counts.pending}</p>
              <p className="text-xs text-muted-foreground">대기중</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{counts.in_progress}</p>
              <p className="text-xs text-muted-foreground">진행중</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{counts.completed}</p>
              <p className="text-xs text-muted-foreground">완료</p>
            </div>
          </div>
        </div>
      </div>
      <RequestsTable initial={rows} />
    </div>
  )
}
