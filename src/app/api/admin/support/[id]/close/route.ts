import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import bot from '@/lib/telegram/bot'

// POST /api/admin/support/[id]/close
// Admin closes a support chat and notifies the Telegram user
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: chat, error: chatError } = await supabase
    .from('support_chats')
    .select('id, case_number, telegram_chat_id, status')
    .eq('id', id)
    .single()

  if (chatError || !chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  if (chat.status !== 'open') {
    return NextResponse.json({ error: 'Chat is already closed' }, { status: 400 })
  }

  const { error: closeError } = await supabase
    .from('support_chats')
    .update({
      status: 'closed',
      closed_by: 'admin',
      closed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (closeError) {
    return NextResponse.json({ error: closeError.message }, { status: 500 })
  }

  // Notify Telegram user
  try {
    await bot.telegram.sendMessage(
      chat.telegram_chat_id,
      `✅ 상담원이 채팅을 종료했습니다. (${chat.case_number})\n\n도움이 필요하시면 /chat 을 입력해 새 채팅을 시작하세요.`
    )
  } catch (err) {
    console.error('[support/close] Telegram notify failed:', err)
  }

  return NextResponse.json({ ok: true })
}
