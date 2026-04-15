-- Support Chat Tables
-- Enables real-time chat between Telegram users and SuperAdmin

-- ── support_chats ─────────────────────────────────────────────────────────────
-- One row per chat session (case). Each case gets a sequential case number.

CREATE SEQUENCE IF NOT EXISTS support_chat_case_seq START 1;

CREATE TABLE IF NOT EXISTS support_chats (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number      TEXT NOT NULL UNIQUE DEFAULT ('TG-' || LPAD(nextval('support_chat_case_seq')::TEXT, 4, '0')),
  telegram_chat_id BIGINT NOT NULL,
  org_id           UUID REFERENCES organizations(id) ON DELETE SET NULL,  -- NULL for unregistered users
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by        TEXT CHECK (closed_by IN ('user', 'admin')),           -- who ended the chat
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ
);

-- ── support_messages ──────────────────────────────────────────────────────────
-- One row per message within a chat session.

CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  support_chat_id UUID NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  content         TEXT NOT NULL,
  read_at         TIMESTAMPTZ,   -- NULL = unread
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_chats_status         ON support_chats(status);
CREATE INDEX IF NOT EXISTS idx_support_chats_telegram       ON support_chats(telegram_chat_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_support_chats_open_per_telegram
  ON support_chats(telegram_chat_id)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_support_messages_chat_id     ON support_messages(support_chat_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread      ON support_messages(support_chat_id, read_at) WHERE read_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- SuperAdmin accesses these via service role (bypasses RLS).
-- No direct client-side access needed, so we just enable RLS with no permissive policies.

ALTER TABLE support_chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime on both tables so the admin panel gets live updates.

ALTER PUBLICATION supabase_realtime ADD TABLE support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
