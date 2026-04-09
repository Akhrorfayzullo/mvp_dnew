import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { connectToDatabase } from '@/lib/mongodb/client'
import { Content } from '@/lib/mongodb/models'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a Korean hospital marketing analyst. Generate realistic competitor analysis.

Return ONLY this exact JSON, no markdown:
{
  "keyword": "<keyword>",
  "competitors": [
    {
      "name": "<Korean clinic name>",
      "rank": <1-10>,
      "rating": <3.5-5.0>,
      "reviews": <50-500>,
      "strength": "<Korean 10 words>",
      "weakness": "<Korean 10 words>"
    }
  ],
  "insights": "<Korean 2-3 sentences>",
  "opportunity": "<Korean 1 concrete opportunity>"
}
Include exactly 4 competitors.`

function parseJSON(text: string) {
  const stripped = text.trim()
  const block = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(block ? block[1].trim() : stripped)
}

export async function POST(req: NextRequest) {
  const { keyword, org_id } = await req.json()

  if (!keyword?.trim()) {
    return NextResponse.json({ error: '키워드를 입력해주세요' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `검색 키워드: "${keyword}"\n경쟁사 4곳을 분석해주세요.`,
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
        org_id, type: 'competitor_analysis', title: `경쟁사 분석: ${keyword}`,
        body: result.insights, status: 'draft', metadata: result,
      })
    } catch (err) { console.error('[competitor] MongoDB failed (non-fatal):', err) }
  }

  // Credits (non-blocking)
  let newCreditBalance: number | null = null
  if (org_id) {
    try {
      const supabase = await createClient()
      const { data: org } = await supabase.from('organizations').select('credit_balance').eq('id', org_id).single()
      if (org && org.credit_balance >= 15) {
        const bal = org.credit_balance - 15
        await supabase.from('organizations').update({ credit_balance: bal }).eq('id', org_id)
        await supabase.from('credit_transactions').insert({ org_id, amount: -15, type: 'usage', description: '경쟁사 분석' })
        newCreditBalance = bal
      }
    } catch (err) { console.error('[competitor] Credits failed (non-fatal):', err) }
  }

  return NextResponse.json({ ...result, ...(newCreditBalance !== null ? { newCreditBalance } : {}) })
}
