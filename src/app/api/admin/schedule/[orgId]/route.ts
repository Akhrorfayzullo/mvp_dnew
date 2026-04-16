import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/schedule/[orgId]?year=2026&month=4
export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createServiceClient()
  const { orgId } = params

  const url = new URL(_req.url)
  const year  = url.searchParams.get('year')
  const month = url.searchParams.get('month')

  let query = supabase
    .from('hospital_schedule_days')
    .select('*')
    .eq('org_id', orgId)
    .order('date', { ascending: true })

  if (year && month) {
    const y = parseInt(year)
    const m = parseInt(month)
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    query = query.gte('date', from).lte('date', to)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ days: data })
}

// POST /api/admin/schedule/[orgId]
// Body: { upserts: { date, state, label }[], deletes: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createServiceClient()
  const { orgId } = params
  const body = await req.json()
  const upserts: { date: string; state: string | null; label: string | null }[] =
    body.upserts ?? []
  const deletes: string[] = body.deletes ?? []

  if (upserts.length > 0) {
    const rows = upserts.map((u) => ({
      org_id: orgId,
      date:   u.date,
      state:  u.state ?? null,
      label:  u.label ?? null,
    }))
    const { error } = await supabase
      .from('hospital_schedule_days')
      .upsert(rows, { onConflict: 'org_id,date' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from('hospital_schedule_days')
      .delete()
      .eq('org_id', orgId)
      .in('date', deletes)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
