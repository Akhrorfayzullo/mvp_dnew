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

// ── Shared helpers ────────────────────────────────────────────────────────────

function retryOrContactKeyboard(type: 'email' | 'password') {
  return Markup.inlineKeyboard([
    Markup.button.callback('🔄 다시 시도', `retry_${type}`),
    Markup.button.callback('👤 담당자 문의', 'contact_support'),
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

// ── /start ────────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const chatId = ctx.chat.id
  console.log(`[bot] /start from chatId=${chatId}`)
  await clearSession(chatId)
  await setSession(chatId, 'awaiting_email')
  await ctx.reply(
    `안녕하세요! 👋\n\n저는 *DNEW 마케팅 광고 회사*의 공식 챗봇입니다.\n\n병원 마케팅 요청을 보내시려면 먼저 인증이 필요합니다.\n\n📧 등록된 이메일 주소를 입력해주세요:`,
    { parse_mode: 'Markdown' }
  )
})

// ── /logout ───────────────────────────────────────────────────────────────────

bot.command('logout', async (ctx) => {
  const chatId = ctx.chat.id
  console.log(`[bot] /logout from chatId=${chatId}`)

  // Unlink org from this telegram account
  await supabase
    .from('organizations')
    .update({ telegram_chat_id: null, telegram_verified: false })
    .eq('telegram_chat_id', chatId)

  await clearSession(chatId)
  await ctx.reply(
    `✅ 로그아웃되었습니다.\n\n다른 병원 계정으로 로그인하려면 /start 를 입력해주세요.`
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
    `📋 *사용 가능한 명령어*\n\n` +
    `/start — 로그인 시작\n` +
    `/logout — 현재 계정 로그아웃\n` +
    `/contact — 담당자 연락처 보기\n` +
    `/help — 명령어 목록 보기\n\n` +
    `로그인 후 메시지를 보내면 마케팅 요청이 접수됩니다.`,
    { parse_mode: 'Markdown' }
  )
})

// ── Text handler ──────────────────────────────────────────────────────────────

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id
  const text = ctx.message.text.trim()
  console.log(`[bot] message from chatId=${chatId}: "${text.slice(0, 40)}"`)

  // ── STEP A: Already verified org ─────────────────────────────────────────
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

  // ── STEP B: Read session ──────────────────────────────────────────────────
  const session = await getSession(chatId)
  const step = session?.step ?? 'awaiting_email'
  const emailAttempts = session?.email_attempts ?? 0
  const passwordAttempts = session?.password_attempts ?? 0
  console.log(`[bot] → step="${step}" emailAttempts=${emailAttempts} passwordAttempts=${passwordAttempts}`)

  // ── STEP C: awaiting_password ─────────────────────────────────────────────
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

      if (newAttempts >= MAX_ATTEMPTS) {
        await setSession(chatId, 'awaiting_password', session.email, emailAttempts, newAttempts)
        await ctx.reply(
          `❌ 비밀번호를 ${MAX_ATTEMPTS}번 잘못 입력하셨습니다.\n\n어떻게 도와드릴까요?`,
          retryOrContactKeyboard('password')
        )
      } else {
        await setSession(chatId, 'awaiting_password', session.email, emailAttempts, newAttempts)
        await ctx.reply(
          `❌ 비밀번호가 올바르지 않습니다. (${newAttempts}/${MAX_ATTEMPTS})\n\n다시 입력해주세요:`
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

  // ── STEP D: awaiting_email ────────────────────────────────────────────────
  if (step === 'awaiting_email') {
    if (!EMAIL_REGEX.test(text)) {
      await ctx.reply('이메일 형식이 올바르지 않습니다. 등록된 이메일 주소를 입력해주세요:')
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

      if (newAttempts >= MAX_ATTEMPTS) {
        await setSession(chatId, 'awaiting_email', undefined, newAttempts, 0)
        await ctx.reply(
          `❌ 등록된 병원을 ${MAX_ATTEMPTS}번 찾지 못했습니다.\n\n아직 등록되지 않으셨나요? 아래 링크에서 가입하실 수 있습니다:\n🌐 ${WEBSITE_URL}\n\n또는 담당자에게 문의하세요:`,
          retryOrContactKeyboard('email')
        )
      } else {
        await setSession(chatId, 'awaiting_email', undefined, newAttempts, 0)
        await ctx.reply(
          `❌ 등록된 병원을 찾을 수 없습니다. (${newAttempts}/${MAX_ATTEMPTS})\n\n다시 입력하시거나, 아직 가입하지 않으셨다면 ${WEBSITE_URL} 에서 등록해주세요.`
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
