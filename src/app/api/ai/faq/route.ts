import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { connectToDatabase } from '@/lib/mongodb/client'
import { Content } from '@/lib/mongodb/models'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a Korean hospital FAQ writer. Generate 5 FAQ Q&A pairs for the given treatment, compliant with 의료법 제56조. Include 개인차 disclaimers. Also generate JSON-LD schema markup.

Return ONLY this exact JSON, no markdown:
{
  "faqs": [
    { "question": "<Korean question>", "answer": "<Korean answer>" }
  ],
  "jsonld": "<complete Schema.org FAQPage JSON-LD as a string>"
}`

function parseJSON(text: string) {
  const stripped = text.trim()
  const block = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(block ? block[1].trim() : stripped)
}

export async function POST(req: NextRequest) {
  const { treatment, specialty, org_id } = await req.json()

  if (!treatment?.trim()) {
    return NextResponse.json({ error: '시술명을 선택해주세요' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `시술명: ${treatment}\n진료과: ${specialty || '의원'}\n\n위 시술에 대한 FAQ 5개와 JSON-LD 스키마를 생성해주세요.`,
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
        org_id, type: 'faq', title: `${treatment} FAQ`,
        body: result.faqs.map((f: { question: string; answer: string }) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n'),
        status: 'draft', metadata: result,
      })
    } catch (err) { console.error('[faq] MongoDB failed (non-fatal):', err) }
  }

  // Credits (non-blocking)
  let newCreditBalance: number | null = null
  if (org_id) {
    try {
      const supabase = await createClient()
      const { data: org } = await supabase.from('organizations').select('credit_balance').eq('id', org_id).single()
      if (org && org.credit_balance >= 5) {
        const bal = org.credit_balance - 5
        await supabase.from('organizations').update({ credit_balance: bal }).eq('id', org_id)
        await supabase.from('credit_transactions').insert({ org_id, amount: -5, type: 'usage', description: 'FAQ 생성' })
        newCreditBalance = bal
      }
    } catch (err) { console.error('[faq] Credits failed (non-fatal):', err) }
  }

  return NextResponse.json({ ...result, ...(newCreditBalance !== null ? { newCreditBalance } : {}) })
}
