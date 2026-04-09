'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Coins, AlertCircle } from 'lucide-react'

interface InsufficientCreditsModalProps {
  open: boolean
  onClose: () => void
}

export default function InsufficientCreditsModal({ open, onClose }: InsufficientCreditsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <DialogTitle className="text-center">크레딧이 부족합니다</DialogTitle>
          <DialogDescription className="text-center">
            이 기능을 사용하기 위한 크레딧이 부족합니다. 크레딧을 충전하거나 플랜을 업그레이드해주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button className="bg-[#0F6E56] hover:bg-[#0d5e48] w-full">
            <Coins className="w-4 h-4 mr-2" />
            크레딧 충전하기
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
