'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  ShieldCheck,
  FileText,
  HelpCircle,
  Users,
  MessageSquare,
  Activity,
  LogOut,
  Coins,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Organization } from '@/types'

interface SidebarProps {
  org: Organization | null
  creditBalance: number
  role: string
}

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/dashboard/compliance', label: '광고 적합성 검사', icon: ShieldCheck },
  { href: '/dashboard/blog', label: '블로그 생성', icon: FileText },
  { href: '/dashboard/faq', label: 'FAQ 생성', icon: HelpCircle },
  { href: '/dashboard/competitor', label: '경쟁사 분석', icon: Users },
  { href: '/dashboard/messaging', label: '환자 메시지', icon: MessageSquare },
  { href: '/dashboard/monitoring', label: '모니터링', icon: Activity },
]

export default function Sidebar({ org, creditBalance, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('로그아웃 되었습니다')
    router.push('/login')
  }

  const planLabel = org?.plan_type === 'lite' ? '라이트' : org?.plan_type === 'pro' ? '프로' : '엔터프라이즈'
  const planColor = org?.plan_type === 'lite' ? 'bg-gray-100 text-gray-600' : org?.plan_type === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0F6E56] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">D</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">DNEW AI</p>
            <p className="text-xs text-muted-foreground">병원 마케팅 플랫폼</p>
          </div>
        </div>
      </div>

      {/* Hospital info */}
      {org && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-muted-foreground">병원</p>
          <p className="font-semibold text-sm text-gray-900 truncate">{org.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', planColor)}>
              {planLabel}
            </span>
            <span className="text-xs text-muted-foreground">{org.specialty}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-[#0F6E56] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600')} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3" />}
            </Link>
          )
        })}

        {role === 'superadmin' && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group mt-2 border-t pt-4',
              pathname.startsWith('/admin')
                ? 'bg-purple-600 text-white'
                : 'text-purple-600 hover:bg-purple-50'
            )}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span>관리자 패널</span>
          </Link>
        )}
      </nav>

      {/* Credits */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-gradient-to-r from-[#0F6E56]/10 to-[#0F6E56]/5 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[#0F6E56]" />
              <span className="text-xs font-medium text-gray-700">크레딧 잔액</span>
            </div>
            <span className="text-lg font-bold text-[#0F6E56]">{creditBalance.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#0F6E56] h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min((creditBalance / 2000) * 100, 100)}%` }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </aside>
  )
}
