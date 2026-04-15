import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/support/chats
// Returns all open support chats with unread message count
export async function GET() {
  const supabase = await createServiceClient()

  const { data: chats, error } = await supabase
    .from('support_chats')
    .select(`
      id,
      case_number,
      telegram_chat_id,
      org_id,
      status,
      created_at,
      organizations ( name )
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Count unread messages (from user, not yet read) per chat
  const chatIds = (chats ?? []).map((c) => c.id)

  const { data: unreadCounts } = chatIds.length
    ? await supabase
        .from('support_messages')
        .select('support_chat_id')
        .in('support_chat_id', chatIds)
        .eq('sender', 'user')
        .is('read_at', null)
    : { data: [] }

  const unreadMap = new Map<string, number>()
  for (const row of unreadCounts ?? []) {
    unreadMap.set(row.support_chat_id, (unreadMap.get(row.support_chat_id) ?? 0) + 1)
  }

  const result = (chats ?? []).map((c) => ({
    id: c.id,
    case_number: c.case_number,
    telegram_chat_id: c.telegram_chat_id,
    org_id: c.org_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    org_name: (c.organizations as any)?.name ?? null,
    status: c.status,
    created_at: c.created_at,
    unread_count: unreadMap.get(c.id) ?? 0,
  }))

  return NextResponse.json(result)
}
