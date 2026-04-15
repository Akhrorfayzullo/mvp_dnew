'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, X, Send, MessageSquareText, ChevronLeft } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupportChat {
  id: string
  case_number: string
  telegram_chat_id: number
  org_id: string | null
  org_name: string | null
  status: string
  created_at: string
  unread_count: number
}

interface SupportMessage {
  id: string
  sender: 'user' | 'admin'
  content: string
  read_at: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}초 전`
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SupportChatPanel() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [chats, setChats] = useState<SupportChat[]>([])
  const [activeChat, setActiveChat] = useState<SupportChat | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeChatRef = useRef<SupportChat | null>(null)
  const supabase = createClient()

  const totalUnread = chats.filter((c) => c.unread_count > 0).length

  // ── Fetch chats ─────────────────────────────────────────────────────────────

  const fetchChats = useCallback(async () => {
    const res = await fetch('/api/admin/support/chats')
    if (res.ok) {
      setChats(await res.json())
    } else {
      console.error('[SupportChat] fetchChats failed:', res.status, await res.text())
    }
  }, [])

  // ── Fetch messages for active chat (with loading spinner) ───────────────────

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true)
    const res = await fetch(`/api/admin/support/${chatId}/messages`)
    if (res.ok) {
      setMessages(await res.json())
      fetchChats()
    }
    setLoadingMessages(false)
  }, [fetchChats])

  // ── Silent poll — refresh messages without spinner ───────────────────────────

  const silentRefreshMessages = useCallback(async (chatId: string) => {
    const res = await fetch(`/api/admin/support/${chatId}/messages`)
    if (res.ok) {
      const fresh: SupportMessage[] = await res.json()
      setMessages((prev) => {
        // Only update if there are new messages to avoid unnecessary re-renders
        if (fresh.length !== prev.length) return fresh
        return prev
      })
    }
  }, [])

  // ── Keep ref in sync with activeChat state ──────────────────────────────────

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  // ── Scroll to bottom ────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Poll chats every 10s ─────────────────────────────────────────────────────

  useEffect(() => {
    fetchChats()
    const interval = setInterval(fetchChats, 10000)
    return () => clearInterval(interval)
  }, [fetchChats])

  // ── Poll messages every 3s when a chat is open (Realtime fallback) ───────────

  useEffect(() => {
    if (!activeChat) return
    const interval = setInterval(() => silentRefreshMessages(activeChat.id), 3000)
    return () => clearInterval(interval)
  }, [activeChat, silentRefreshMessages])

  // ── Supabase Realtime — stable subscription (never restarts) ────────────────

  useEffect(() => {
    const channel = supabase
      .channel('support_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        (payload) => {
          const msg = payload.new as SupportMessage & { support_chat_id: string }
          const current = activeChatRef.current
          if (current && msg.support_chat_id === current.id) {
            // Append to open chat and mark as read
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            fetch(`/api/admin/support/${current.id}/messages`)
          } else {
            // Different chat — bump unread count in list
            fetchChats()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_chats' },
        () => fetchChats()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_chats' },
        (payload) => {
          fetchChats()
          const current = activeChatRef.current
          if (current && payload.new.id === current.id && payload.new.status === 'closed') {
            setActiveChat(null)
            setMessages([])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchChats]) // activeChat removed — use ref instead to keep subscription stable

  // ── Open a chat ─────────────────────────────────────────────────────────────

  function openChat(chat: SupportChat) {
    setActiveChat(chat)
    // Optimistically clear unread count so bell and badge update instantly
    setChats((prev) => prev.map((c) => c.id === chat.id ? { ...c, unread_count: 0 } : c))
    fetchMessages(chat.id)
  }

  // ── Send message ────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!input.trim() || !activeChat || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')

    // Optimistic update
    const optimistic: SupportMessage = {
      id: `tmp-${Date.now()}`,
      sender: 'admin',
      content: text,
      read_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    const res = await fetch(`/api/admin/support/${activeChat.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    if (!res.ok) {
      // Rollback optimistic update
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(text)
    }

    setSending(false)
  }

  // ── Close chat ──────────────────────────────────────────────────────────────

  async function handleClose() {
    if (!activeChat || closing) return
    setClosing(true)
    const closedId = activeChat.id
    const res = await fetch(`/api/admin/support/${closedId}/close`, { method: 'POST' })
    if (res.ok) {
      setActiveChat(null)
      setMessages([])
      setChats((prev) => prev.filter((c) => c.id !== closedId))
    }
    setClosing(false)
    fetchChats()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        title="지원 채팅"
      >
        <Bell className="w-4 h-4" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Slide panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => { if (!activeChat) setPanelOpen(false) }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30" />

          {/* Panel */}
          <div
            className="relative z-50 w-80 bg-white shadow-2xl flex flex-col"
            style={{ height: '100dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Chat list view ── */}
            {!activeChat && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b bg-purple-900 text-white">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="w-4 h-4" />
                    <span className="font-semibold text-sm">지원 채팅</span>
                    {totalUnread > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {totalUnread}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setPanelOpen(false)} className="text-white/70 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y">
                  {chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                      <MessageSquareText className="w-8 h-8 opacity-30" />
                      <p className="text-sm">열린 채팅이 없습니다</p>
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => openChat(chat)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-purple-700">
                                {chat.case_number}
                              </span>
                              {chat.unread_count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                                  {chat.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-800 truncate mt-0.5">
                              {chat.org_name ?? '미인증 사용자'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(chat.created_at)}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${chat.unread_count > 0 ? 'bg-red-500' : 'bg-gray-300'}`} />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ── Chat detail view ── */}
            {activeChat && (
              <>
                <div className="flex items-center gap-2 px-3 py-3 border-b bg-purple-900 text-white flex-shrink-0">
                  <button
                    onClick={() => { setActiveChat(null); setMessages([]) }}
                    className="text-white/70 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold">{activeChat.case_number}</span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {activeChat.org_name ?? '미인증 사용자'}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={closing}
                    className="text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors flex-shrink-0"
                  >
                    {closing ? '종료 중...' : '채팅 종료'}
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 mt-4">메시지가 없습니다.</p>
                  ) : null}
                  {!loadingMessages && messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                          msg.sender === 'admin'
                            ? 'bg-purple-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.sender === 'admin' ? 'text-white/60' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t px-3 py-2 flex gap-2 flex-shrink-0">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
                    rows={2}
                    className="flex-1 text-sm resize-none border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="self-end bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg p-2 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
