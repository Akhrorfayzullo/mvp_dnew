import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
}

// GET /api/admin/support/[id]/messages
// Returns all messages for a chat and marks user messages as read
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: messages, error } = await supabase
    .from('support_messages')
    .select('id, sender, content, read_at, created_at')
    .eq('support_chat_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS })
  }

  // Mark all unread user messages as read
  const unreadIds = (messages ?? [])
    .filter((m) => m.sender === 'user' && !m.read_at)
    .map((m) => m.id)

  if (unreadIds.length > 0) {
    await supabase
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
  }

  return NextResponse.json(messages ?? [], { headers: NO_STORE_HEADERS })
}
