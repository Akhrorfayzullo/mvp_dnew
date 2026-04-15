import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import bot from '@/lib/telegram/bot'

// POST /api/admin/support/[id]/send
// Admin sends a message to the Telegram user in a support chat
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { message } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Fetch the chat to get telegram_chat_id and verify it's open
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

  // Save message to DB
  const { error: insertError } = await supabase
    .from('support_messages')
    .insert({
      support_chat_id: id,
      sender: 'admin',
      content: message.trim(),
      read_at: new Date().toISOString(), // admin messages are auto-read
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Send via Telegram bot
  try {
    await bot.telegram.sendMessage(
      chat.telegram_chat_id,
      `💬 *상담원* (${chat.case_number})\n\n${message.trim()}`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    console.error('[support/send] Telegram send failed:', err)
    // DB already saved — don't fail the request, just log
  }

  return NextResponse.json({ ok: true })
}
