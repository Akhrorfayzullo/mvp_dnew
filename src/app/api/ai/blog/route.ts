import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { connectToDatabase } from '@/lib/mongodb/client'
import { Content } from '@/lib/mongodb/models'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a Korean hospital marketing writer. Write a Naver blog post compliant with 의료법 제56조. No guarantees, no comparisons, include 개인차 disclaimers. SEO-optimized.

Return ONLY this exact JSON, no markdown:
{
  "title": "<SEO title in Korean>",
  "content": "<full blog post in Korean, 400-500 chars>",
  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
  "compliance_note": "<1 Korean sentence confirming compliance>"
}`

function parseJSON(text: string) {
  const stripped = text.trim()
  const block = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(block ? block[1].trim() : stripped)
}

export async function POST(req: NextRequest) {
  const { keyword, specialty, topic, org_id } = await req.json()

  if (!keyword?.trim()) {
    return NextResponse.json({ error: '키워드를 입력해주세요' }, { status: 400 })
  }

  // Claude — always returns
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `키워드: ${keyword}\n진료과: ${specialty || '일반'}\n주제: ${topic || keyword}에 대한 병원 블로그 포스트를 작성해주세요.`,
    }],
  })

  const raw = message.content[0]
  if (raw.type !== 'text') return NextResponse.json({ error: 'Unexpected Claude response' }, { status: 500 })
  const result = parseJSON(raw.text)

  // MongoDB (non-blocking)
  if (org_id) {
    try {
      await connectToDatabase()
      await Content.create({
        org_id, type: 'blog_post', title: result.title, body: result.content, status: 'draft', metadata: result,
      })
    } catch (err) { console.error('[blog] MongoDB failed (non-fatal):', err) }
  }

  // Credits (non-blocking)
  let newCreditBalance: number | null = null
  if (org_id) {
    try {
      const supabase = await createClient()
      const { data: org } = await supabase.from('organizations').select('credit_balance').eq('id', org_id).single()
      if (org && org.credit_balance >= 10) {
        const bal = org.credit_balance - 10
        await supabase.from('organizations').update({ credit_balance: bal }).eq('id', org_id)
        await supabase.from('credit_transactions').insert({ org_id, amount: -10, type: 'usage', description: '블로그 포스트 생성' })
        newCreditBalance = bal
      }
    } catch (err) { console.error('[blog] Credits failed (non-fatal):', err) }
  }

  return NextResponse.json({ ...result, ...(newCreditBalance !== null ? { newCreditBalance } : {}) })
}
