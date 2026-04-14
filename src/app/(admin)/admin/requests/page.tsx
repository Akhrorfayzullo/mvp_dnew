/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/lib/supabase/server'
import { MessageSquare } from 'lucide-react'
import RequestsTable, { type RequestRow } from '@/components/admin/RequestsTable'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const supabase = await createServiceClient()

  const { data: requests } = await supabase
    .from('requests')
    .select(`
      id,
      message,
      category,
      priority,
      status,
      assigned_to,
      telegram_chat_id,
      created_at,
      organizations ( name )
    `)
    .order('created_at', { ascending: false })

  const rows: RequestRow[] = ((requests as any[]) ?? []).map((r: any) => ({
    id: r.id,
    org_name: r.organizations?.name ?? r.organizations?.[0]?.name ?? '알 수 없음',
    message: r.message,
    category: r.category,
    priority: r.priority,
    status: r.status,
    assigned_to: r.assigned_to ?? null,
    telegram_chat_id: r.telegram_chat_id ?? null,
    created_at: r.created_at,
  }))

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
          <p className="text-sm text-muted-foreground">텔레그램으로 접수된 병원 요청사항</p>
        </div>
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
      <RequestsTable initial={rows} />
    </div>
  )
}
