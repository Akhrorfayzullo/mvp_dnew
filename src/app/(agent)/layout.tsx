import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'agent' && userData?.role !== 'superadmin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-orange-600 text-white px-6 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <span className="font-bold text-sm">A</span>
        </div>
        <span className="font-bold">에이전트 포털</span>
      </div>
      {children}
    </div>
  )
}
