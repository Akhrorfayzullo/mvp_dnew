import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (userData?.role !== 'superadmin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-purple-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="font-bold text-sm">D</span>
          </div>
          <span className="font-bold">DNEW AI 관리자 패널</span>
        </div>
        <a href="/dashboard" className="text-sm text-white/70 hover:text-white">대시보드로 이동 →</a>
      </div>
      {children}
    </div>
  )
}
