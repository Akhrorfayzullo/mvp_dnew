-- ─────────────────────────────────────────────
-- Hospital Schedule Schema
-- ─────────────────────────────────────────────

-- 1. Doctors per hospital
CREATE TABLE IF NOT EXISTS hospital_doctors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  short_name        TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#2563EB',
  bg_color          TEXT NOT NULL DEFAULT '#EFF6FF',
  bdr_color         TEXT NOT NULL DEFAULT '#BFDBFE',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  start_date        DATE NOT NULL DEFAULT '1900-01-01',
  end_date          DATE,
  regular_off_days  TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add new columns to existing tables (safe to re-run)
ALTER TABLE hospital_doctors ADD COLUMN IF NOT EXISTS bdr_color        TEXT NOT NULL DEFAULT '#BFDBFE';
ALTER TABLE hospital_doctors ADD COLUMN IF NOT EXISTS start_date       DATE NOT NULL DEFAULT '1900-01-01';
ALTER TABLE hospital_doctors ADD COLUMN IF NOT EXISTS end_date         DATE;
ALTER TABLE hospital_doctors ADD COLUMN IF NOT EXISTS regular_off_days TEXT NOT NULL DEFAULT '';

-- 2. Clinic open/close calendar (per hospital, per day)
CREATE TABLE IF NOT EXISTS hospital_schedule_days (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  state      TEXT CHECK (state IN ('open','morning','afternoon','closed')),
  label      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, date)
);

-- 3. Per-doctor time slots
CREATE TABLE IF NOT EXISTS hospital_doctor_slots (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id  UUID NOT NULL REFERENCES hospital_doctors(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  time_slot  TEXT NOT NULL DEFAULT 'off',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, date)
);

-- ─── RLS ───────────────────────────────────────
ALTER TABLE hospital_doctors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_doctor_slots  ENABLE ROW LEVEL SECURITY;

-- Superadmin full access via service role (API uses service client — no RLS needed)
-- Hospital owners can read their own data
CREATE POLICY "Org members read doctors" ON hospital_doctors
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members read schedule days" ON hospital_schedule_days
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members read doctor slots" ON hospital_doctor_slots
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- ─── Migration: ensure unique constraint exists on slots (safe to re-run) ───
-- The CREATE TABLE above includes UNIQUE(doctor_id,date), but if the table was
-- created before this line was added the constraint may be missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'hospital_doctor_slots'::regclass
      AND contype = 'u'
      AND conname LIKE '%doctor_id%date%'
  ) THEN
    ALTER TABLE hospital_doctor_slots
      ADD CONSTRAINT hospital_doctor_slots_doctor_id_date_key UNIQUE (doctor_id, date);
  END IF;
END $$;
