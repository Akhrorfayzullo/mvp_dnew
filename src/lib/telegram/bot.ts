import { Telegraf, Markup } from 'telegraf'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import { claude, CLAUDE_MODEL } from '@/lib/claude/client'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

const SUPPORT_HANDLE = '@akhrorfayzullo'
const WEBSITE_URL = 'https://dnew.co.kr'
const MAX_ATTEMPTS = 3

// Service role client for DB writes (bypasses RLS)
const supabase = createSupabaseServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Anon client for auth.signInWithPassword
const supabaseAuth = createSupabaseServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COMMAND_LIST =
  `/start — 로그인 시작\n` +
  `/chat — 상담원과 채팅\n` +
  `/logout — 현재 계정 로그아웃\n` +
  `/contact — 담당자 연락처 보기\n` +
  `/help — 명령어 목록 보기`

// ── Session helpers ───────────────────────────────────────────────────────────

async function getSession(chatId: number) {
  const { data, error } = await supabase
    .from('telegram_sessions')
    .select('step, email, email_attempts, password_attempts')
    .eq('chat_id', chatId)
    .single()
  if (error) console.log(`[bot] getSession(${chatId}): no session (${error.code})`)
  return data
}

async function setSession(
  chatId: number,
  step: string,
  email?: string,
  emailAttempts?: number,
  passwordAttempts?: number
) {
  const { error } = await supabase.from('telegram_sessions').upsert(
    {
      chat_id: chatId,
      step,
      email: email ?? null,
      email_attempts: emailAttempts ?? 0,
      password_attempts: passwordAttempts ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' }
  )
  if (error) console.error(`[bot] setSession error:`, error.message)
}

async function clearSession(chatId: number) {
  const { error } = await supabase.from('telegram_sessions').delete().eq('chat_id', chatId)
  if (error) console.error(`[bot] clearSession error:`, error.message)
}

// ── Support chat helpers ──────────────────────────────────────────────────────

async function getOpenSupportChat(chatId: number) {
  const { data } = await supabase
    .from('support_chats')
    .select('id, case_number')
    .eq('telegram_chat_id', chatId)
    .eq('status', 'open')
    .single()
  return data
}

async function openSupportChat(chatId: number, orgId?: string) {
  const { data, error } = await supabase
    .from('support_chats')
    .insert({
      telegram_chat_id: chatId,
      org_id: orgId ?? null,
      status: 'open',
    })
    .select('id, case_number')
    .single()
  if (error) console.error(`[bot] openSupportChat error:`, error.message)
  return data
}

async function closeSupportChat(chatId: number, closedBy: 'user' | 'admin') {
  const { error } = await supabase
    .from('support_chats')
    .update({ status: 'closed', closed_by: closedBy, closed_at: new Date().toISOString() })
    .eq('telegram_chat_id', chatId)
    .eq('status', 'open')
  if (error) console.error(`[bot] closeSupportChat error:`, error.message)
}

async function saveSupportMessage(supportChatId: string, sender: 'user' | 'admin', content: string) {
  const { error } = await supabase
    .from('support_messages')
    .insert({ support_chat_id: supportChatId, sender, content })
  if (error) console.error(`[bot] saveSupportMessage error:`, error.message)
}

// ── Keyboards ─────────────────────────────────────────────────────────────────

function retryOrChatKeyboard(type: 'email' | 'password') {
  return Markup.inlineKeyboard([
    Markup.button.callback('🔄 다시 시도', `retry_${type}`),
    Markup.button.callback('💬 상담원과 채팅', 'start_support_chat'),
  ])
}

function endChatKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('🔚 채팅 종료', 'end_support_chat'),
  ])
}

async function sendContactInfo(ctx: { reply: (text: string) => Promise<unknown> }) {
  await ctx.reply(
    `담당자에게 직접 문의해 주세요:\n\n📱 Telegram: ${SUPPORT_HANDLE}\n🌐 웹사이트: ${WEBSITE_URL}`
  )
}

// ── Inline button handlers ────────────────────────────────────────────────────

bot.action('retry_email', async (ctx) => {
  const chatId = ctx.chat!.id
  await ctx.answerCbQuery()
  await setSession(chatId, 'awaiting_email', undefined, 0, 0)
  await ctx.reply('이메일 주소를 다시 입력해주세요:')
})

bot.action('retry_password', async (ctx) => {
  const chatId = ctx.chat!.id
  const session = await getSession(chatId)
  await ctx.answerCbQuery()
  await setSession(chatId, 'awaiting_password', session?.email ?? undefined, session?.email_attempts ?? 0, 0)
  await ctx.reply('비밀번호를 다시 입력해주세요:')
})

bot.action('contact_support', async (ctx) => {
  await ctx.answerCbQuery()
  await sendContactInfo(ctx)
})

bot.action('start_support_chat', async (ctx) => {
  const chatId = ctx.chat!.id
  await ctx.answerCbQuery()

  const existing = await getOpenSupportChat(chatId)
  if (existing) {
    await ctx.reply(
      `💬 이미 열린 채팅이 있습니다. (${existing.case_number})\n\n메시지를 입력하시면 상담원에게 전달됩니다.`,
      endChatKeyboard()
    )
    return
  }

  const chat = await openSupportChat(chatId)
  if (!chat) {
    await ctx.reply('채팅을 시작하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    return
  }

  await setSession(chatId, 'in_support_chat')
  await ctx.reply(
    `💬 상담원과 채팅이 시작되었습니다.\n\n📋 케이스 번호: *${chat.case_number}*\n\n메시지를 입력하시면 상담원에게 전달됩니다.\n채팅을 종료하려면 아래 버튼을 누르거나 /end 를 입력하세요.`,
    { parse_mode: 'Markdown', ...endChatKeyboard() }
  )
})

bot.action('end_support_chat', async (ctx) => {
  const chatId = ctx.chat!.id
  await ctx.answerCbQuery()
  await closeSupportChat(chatId, 'user')
  await clearSession(chatId)
  await ctx.reply(
    `✅ 채팅이 종료되었습니다. 문의해 주셔서 감사합니다!\n\n📋 *사용 가능한 명령어*\n${COMMAND_LIST}`,
    { parse_mode: 'Markdown' }
  )
})

// ── /start ────────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const chatId = ctx.chat.id
  console.log(`[bot] /start from chatId=${chatId}`)
  await clearSession(chatId)
  await setSession(chatId, 'awaiting_email')
  await ctx.reply(
    `안녕하세요! 👋\n\n저는 *DNEW 마케팅 광고 회사*의 공식 챗봇입니다.\n\n` +
    `📋 *사용 가능한 명령어*\n` +
    `${COMMAND_LIST}\n\n` +
    `병원 마케팅 요청을 보내시려면 먼저 인증이 필요합니다.\n\n📧 등록된 이메일 주소를 입력해주세요:`,
    { parse_mode: 'Markdown' }
  )
})

// ── /chat ─────────────────────────────────────────────────────────────────────

bot.command('chat', async (ctx) => {
  const chatId = ctx.chat.id
  console.log(`[bot] /chat from chatId=${chatId}`)

  const existing = await getOpenSupportChat(chatId)
  if (existing) {
    await ctx.reply(
      `💬 이미 열린 채팅이 있습니다. (${existing.case_number})\n\n메시지를 입력하시면 상담원에게 전달됩니다.`,
      endChatKeyboard()
    )
    return
  }

  // Find org if already verified
  const { data: verifiedOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .eq('telegram_verified', true)
    .single()

  const chat = await openSupportChat(chatId, verifiedOrg?.id)
  if (!chat) {
    await ctx.reply('채팅을 시작하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    return
  }

  await setSession(chatId, 'in_support_chat')
  await ctx.reply(
    `💬 상담원과 채팅이 시작되었습니다.\n\n📋 케이스 번호: *${chat.case_number}*\n\n메시지를 입력하시면 상담원에게 전달됩니다.\n채팅을 종료하려면 아래 버튼을 누르거나 /end 를 입력하세요.`,
    { parse_mode: 'Markdown', ...endChatKeyboard() }
  )
})

// ── /end ──────────────────────────────────────────────────────────────────────

bot.command('end', async (ctx) => {
  const chatId = ctx.chat.id
  console.log(`[bot] /end from chatId=${chatId}`)

  const existing = await getOpenSupportChat(chatId)
  if (!existing) {
    await ctx.reply('현재 진행 중인 채팅이 없습니다.')
    return
  }

  await closeSupportChat(chatId, 'user')
  await clearSession(chatId)
  await ctx.reply(
    `✅ 채팅이 종료되었습니다. 문의해 주셔서 감사합니다!\n\n📋 *사용 가능한 명령어*\n${COMMAND_LIST}`,
    { parse_mode: 'Markdown' }
  )
})

// ── /logout ───────────────────────────────────────────────────────────────────

bot.command('logout', async (ctx) => {
  const chatId = ctx.chat.id
  console.log(`[bot] /logout from chatId=${chatId}`)

  await supabase
    .from('organizations')
    .update({ telegram_chat_id: null, telegram_verified: false })
    .eq('telegram_chat_id', chatId)

  await clearSession(chatId)
  await ctx.reply(
    `✅ 로그아웃되었습니다.\n\n📋 *사용 가능한 명령어*\n${COMMAND_LIST}\n\n다른 병원 계정으로 로그인하려면 /start 를 입력해주세요.`,
    { parse_mode: 'Markdown' }
  )
})

// ── /contact ──────────────────────────────────────────────────────────────────

bot.command('contact', async (ctx) => {
  await ctx.reply(
    `📞 *DNEW 담당자 연락처*\n\n👤 Telegram: ${SUPPORT_HANDLE}\n🌐 웹사이트: ${WEBSITE_URL}\n\n문의사항이 있으시면 언제든지 연락해 주세요!`,
    { parse_mode: 'Markdown' }
  )
})

// ── /help ─────────────────────────────────────────────────────────────────────

bot.command('help', async (ctx) => {
  await ctx.reply(
    `📋 *사용 가능한 명령어*\n\n${COMMAND_LIST}\n\n로그인 후 메시지를 보내면 마케팅 요청이 접수됩니다.`,
    { parse_mode: 'Markdown' }
  )
})

// ── Text handler ──────────────────────────────────────────────────────────────

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id
  const text = ctx.message.text.trim()
  console.log(`[bot] message from chatId=${chatId}: "${text.slice(0, 40)}"`)

  // ── STEP A: Active support chat ───────────────────────────────────────────
  const session = await getSession(chatId)
  if (session?.step === 'in_support_chat') {
    const supportChat = await getOpenSupportChat(chatId)
    if (supportChat) {
      await saveSupportMessage(supportChat.id, 'user', text)
      console.log(`[bot] → support message saved for ${supportChat.case_number}`)
      await ctx.reply(
        `📨 메시지가 상담원에게 전달되었습니다. (${supportChat.case_number})\n\n채팅을 종료하려면 /end 를 입력하세요.`
      )
      return
    }
    // Support chat was closed externally (by admin), reset session
    await clearSession(chatId)
    await ctx.reply(
      `채팅이 종료되었습니다.\n\n📋 *사용 가능한 명령어*\n${COMMAND_LIST}`,
      { parse_mode: 'Markdown' }
    )
    return
  }

  // ── STEP B: Already verified org ─────────────────────────────────────────
  const { data: verifiedOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .eq('telegram_verified', true)
    .single()

  if (verifiedOrg) {
    console.log(`[bot] → routing to REQUEST HANDLER for org: ${verifiedOrg.name}`)
    try {
      const response = await claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `다음 병원 마케팅 요청을 분석하고 JSON으로만 응답하세요 (다른 텍스트 없이):
{"category": "카테고리", "priority": "높음|보통|낮음", "estimated_time": "예상시간"}

카테고리 목록: 블로그, SNS콘텐츠, 광고, FAQ, 문자/카카오, 경쟁분석, 기타

요청: ${text}`,
          },
        ],
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      let category = '기타'
      let priority = '보통'
      let estimatedTime = '1-2일'

      try {
        const parsed = JSON.parse(raw)
        category = parsed.category ?? category
        priority = parsed.priority ?? priority
        estimatedTime = parsed.estimated_time ?? estimatedTime
      } catch {
        // keep defaults
      }

      await supabase.from('requests').insert({
        org_id: verifiedOrg.id,
        telegram_chat_id: chatId,
        message: text,
        category,
        priority,
        estimated_time: estimatedTime,
        status: 'pending',
        source: 'telegram',
      })

      await ctx.reply(
        `✅ 요청이 접수되었습니다!\n\n📂 카테고리: ${category}\n⚡ 우선순위: ${priority}\n⏱ 예상 소요시간: ${estimatedTime}`
      )
    } catch (err) {
      console.error('[bot] request handling error:', err)
      await ctx.reply('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
    return
  }

  // ── STEP C: Read session ──────────────────────────────────────────────────
  const step = session?.step ?? 'awaiting_email'
  const emailAttempts = session?.email_attempts ?? 0
  const passwordAttempts = session?.password_attempts ?? 0
  console.log(`[bot] → step="${step}" emailAttempts=${emailAttempts} passwordAttempts=${passwordAttempts}`)

  // ── STEP D: awaiting_password ─────────────────────────────────────────────
  if (step === 'awaiting_password') {
    if (!session?.email) {
      await setSession(chatId, 'awaiting_email')
      await ctx.reply('세션 오류가 발생했습니다. 이메일을 다시 입력해주세요:')
      return
    }

    const { error: authErr } = await supabaseAuth.auth.signInWithPassword({
      email: session.email,
      password: text,
    })

    if (authErr) {
      const newAttempts = passwordAttempts + 1
      console.log(`[bot] wrong password attempt ${newAttempts}/${MAX_ATTEMPTS}`)
      await setSession(chatId, 'awaiting_password', session.email, emailAttempts, newAttempts)

      if (newAttempts >= MAX_ATTEMPTS) {
        await ctx.reply(
          `❌ 비밀번호를 ${MAX_ATTEMPTS}번 잘못 입력하셨습니다.\n\n어떻게 도와드릴까요?`,
          retryOrChatKeyboard('password')
        )
      } else {
        await ctx.reply(
          `❌ 비밀번호가 올바르지 않습니다. (${newAttempts}/${MAX_ATTEMPTS})\n\n다시 입력해주세요:`,
          retryOrChatKeyboard('password')
        )
      }
      return
    }

    // Password correct — save telegram info
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('email', session.email)
      .single()

    if (org) {
      await supabase
        .from('organizations')
        .update({ telegram_chat_id: chatId, telegram_verified: true })
        .eq('id', org.id)
      console.log(`[bot] org ${org.id} verified for chatId=${chatId}`)
    }

    await clearSession(chatId)
    await ctx.reply('✅ 인증이 완료되었습니다! 이제 마케팅 요청사항을 보내주세요.')
    return
  }

  // ── STEP E: awaiting_email ────────────────────────────────────────────────
  if (step === 'awaiting_email') {
    if (!EMAIL_REGEX.test(text)) {
      await ctx.reply(
        '이메일 형식이 올바르지 않습니다. 등록된 이메일 주소를 입력해주세요:',
        retryOrChatKeyboard('email')
      )
      return
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id, email')
      .eq('email', text)
      .single()

    if (!org) {
      const newAttempts = emailAttempts + 1
      console.log(`[bot] email not found, attempt ${newAttempts}/${MAX_ATTEMPTS}: ${text}`)
      await setSession(chatId, 'awaiting_email', undefined, newAttempts, 0)

      if (newAttempts >= MAX_ATTEMPTS) {
        await ctx.reply(
          `❌ 등록된 병원을 ${MAX_ATTEMPTS}번 찾지 못했습니다.\n\n아직 등록되지 않으셨나요? 🌐 ${WEBSITE_URL}\n\n또는 상담원과 직접 채팅하세요:`,
          retryOrChatKeyboard('email')
        )
      } else {
        await ctx.reply(
          `❌ 등록된 병원을 찾을 수 없습니다. (${newAttempts}/${MAX_ATTEMPTS})\n\n다시 시도하시거나 상담원과 채팅하세요:`,
          retryOrChatKeyboard('email')
        )
      }
      return
    }

    console.log(`[bot] email found, moving to awaiting_password`)
    await setSession(chatId, 'awaiting_password', text, emailAttempts, 0)
    await ctx.reply('✅ 이메일이 확인되었습니다. 비밀번호를 입력해주세요:')
    return
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  console.log(`[bot] unknown step="${step}", resetting`)
  await setSession(chatId, 'awaiting_email')
  await ctx.reply('먼저 이메일 주소를 입력하여 인증해주세요:')
})

export default bot
