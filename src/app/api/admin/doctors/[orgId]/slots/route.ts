import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/doctors/[orgId]/slots?year=2026&month=4
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createServiceClient()
  const { orgId } = params
  const url = new URL(req.url)
  const year  = url.searchParams.get('year')
  const month = url.searchParams.get('month')

  let query = supabase
    .from('hospital_doctor_slots')
    .select('doctor_id, date, time_slot')
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

  return NextResponse.json(
    { slots: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

// POST /api/admin/doctors/[orgId]/slots
// Body: { upserts: { doctor_id, date, time_slot }[] }
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createServiceClient()
  const { orgId } = params
  const body = await req.json()
  const upserts: { doctor_id: string; date: string; time_slot: string }[] =
    body.upserts ?? []

  if (upserts.length === 0)
    return NextResponse.json({ ok: true, count: 0 })

  const rows = upserts.map((u) => ({
    doctor_id: u.doctor_id,
    org_id:    orgId,
    date:      u.date,
    time_slot: u.time_slot,
  }))

  const { error } = await supabase
    .from('hospital_doctor_slots')
    .upsert(rows, { onConflict: 'doctor_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: rows.length })
}
