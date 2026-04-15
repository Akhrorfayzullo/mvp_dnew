'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export interface HospitalRow {
  id: string
  name: string
  specialty: string
  plan_type: string
  credit_balance: number
  email: string | null
  telegram_verified: boolean
  created_at: string
}

const PLAN_COLOR: Record<string, string> = {
  lite: 'bg-gray-100 text-gray-600',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
}
const PLAN_LABEL: Record<string, string> = {
  lite: '라이트',
  pro: '프로',
  enterprise: '엔터프라이즈',
}

const SPECIALTIES = ['피부과', '치과', '안과', '성형외과', '정형외과', '기타']

const DEFAULT_FORM = {
  name: '',
  specialty: '기타',
  email: '',
  password: '',
  plan_type: 'lite',
  credit_balance: '500',
  phone: '',
  address: '',
}

export default function HospitalManager({ initial }: { initial: HospitalRow[] }) {
  const router = useRouter()
  const [hospitals, setHospitals] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HospitalRow | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [, startTransition] = useTransition()

  function field(key: keyof typeof DEFAULT_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/hospitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        credit_balance: parseInt(form.credit_balance) || 500,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다.')
      return
    }

    setSuccess('✅ 병원이 성공적으로 추가되었습니다.')
    setForm(DEFAULT_FORM)
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function handleDelete() {
    if (!deleteTarget) return

    const res = await fetch(`/api/admin/hospitals/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setHospitals((prev) => prev.filter((h) => h.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => { setShowForm(true); setError(''); setSuccess('') }} className="bg-purple-900 hover:bg-purple-800 gap-2">
          <Plus className="w-4 h-4" />
          새 병원 추가
        </Button>
      </div>

      {/* Hospital list */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {hospitals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              등록된 병원이 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">병원명</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">진료과목</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">플랜</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">크레딧</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">텔레그램</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">등록일</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {hospitals.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                      <td className="px-4 py-3 text-gray-600">{h.specialty}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{h.email ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLOR[h.plan_type] ?? PLAN_COLOR.lite}`}>
                          {PLAN_LABEL[h.plan_type] ?? h.plan_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{h.credit_balance.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${h.telegram_verified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}
                        >
                          {h.telegram_verified ? '인증됨' : '미인증'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(h.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(h)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 병원 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name">병원명 *</Label>
                <Input id="name" value={form.name} onChange={(e) => field('name', e.target.value)} required placeholder="서울피부과의원" />
              </div>

              <div className="space-y-1.5">
                <Label>진료과목</Label>
                <Select value={form.specialty} onValueChange={(v) => v && field('specialty', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>플랜</Label>
                <Select value={form.plan_type} onValueChange={(v) => v && field('plan_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lite">라이트</SelectItem>
                    <SelectItem value="pro">프로</SelectItem>
                    <SelectItem value="enterprise">엔터프라이즈</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="email">이메일 *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => field('email', e.target.value)} required placeholder="hospital@example.com" />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="password">비밀번호 * (8자 이상)</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => field('password', e.target.value)} required minLength={8} placeholder="••••••••" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credits">초기 크레딧</Label>
                <Input id="credits" type="number" min="0" value={form.credit_balance} onChange={(e) => field('credit_balance', e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">전화번호</Label>
                <Input id="phone" value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="02-1234-5678" />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="address">주소</Label>
                <Input id="address" value={form.address} onChange={(e) => field('address', e.target.value)} placeholder="서울특별시 강남구..." />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>취소</Button>
              <Button type="submit" className="bg-purple-900 hover:bg-purple-800">병원 추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>병원 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>을(를) 삭제하시겠습니까?
            <br />
            <span className="text-red-600 text-xs mt-1 block">이 작업은 되돌릴 수 없습니다. 관련 사용자 계정도 함께 삭제됩니다.</span>
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
