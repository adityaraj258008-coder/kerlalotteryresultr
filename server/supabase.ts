import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();

let supabaseClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SUPABASE_SCHEMA_SQL = `-- Run this SQL once in your Supabase SQL Editor (Project: mhilrmauipkxdtrzbyvl)
-- Creates persistent tables for Kerala Lottery Result & Booking Appointments

CREATE TABLE IF NOT EXISTS public.winner_records (
  id BIGINT PRIMARY KEY,
  winner_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  ticket_number TEXT NOT NULL,
  lottery_name TEXT NOT NULL,
  prize_position TEXT NOT NULL,
  winning_amount BIGINT NOT NULL,
  winning_amount_formatted TEXT NOT NULL,
  draw_date TEXT NOT NULL,
  seller_info TEXT NOT NULL,
  certificate_ref TEXT NOT NULL UNIQUE,
  is_verified INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prize_categories (
  id BIGINT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 1,
  prize_name TEXT NOT NULL,
  prize_amount TEXT NOT NULL,
  winning_tickets JSONB NOT NULL DEFAULT '[]'::jsonb,
  highlighted_ticket TEXT DEFAULT NULL,
  lottery_name TEXT NOT NULL,
  draw_date TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id BIGINT PRIMARY KEY,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  appointment_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.winner_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow portal access winner_records" ON public.winner_records;
CREATE POLICY "Allow portal access winner_records" ON public.winner_records
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal access prize_categories" ON public.prize_categories;
CREATE POLICY "Allow portal access prize_categories" ON public.prize_categories
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal access appointments" ON public.appointments;
CREATE POLICY "Allow portal access appointments" ON public.appointments
  FOR ALL USING (true) WITH CHECK (true);
`;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseClient);
}

async function checkTableReady(table: string): Promise<{ ok: boolean; error: string | null }> {
  if (!supabaseClient) return { ok: false, error: 'Supabase not configured' };
  const { error } = await supabaseClient.from(table).select('id').limit(1);
  if (!error) return { ok: true, error: null };
  return { ok: false, error: error.message };
}

export async function getSupabaseStatus() {
  if (!supabaseClient) {
    return {
      configured: false,
      projectUrl: null,
      connected: false,
      tables: {
        winner_records: false,
        prize_categories: false,
        appointments: false,
      },
      lastError: 'SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set.',
      sqlSchema: SUPABASE_SCHEMA_SQL,
    };
  }

  const [w, p, a] = await Promise.all([
    checkTableReady('winner_records'),
    checkTableReady('prize_categories'),
    checkTableReady('appointments'),
  ]);

  const anyReady = w.ok || p.ok || a.ok;
  const firstErr = w.error || p.error || a.error || null;

  return {
    configured: true,
    projectUrl: SUPABASE_URL,
    connected: anyReady,
    tables: {
      winner_records: w.ok,
      prize_categories: p.ok,
      appointments: a.ok,
    },
    lastError: firstErr,
    sqlSchema: SUPABASE_SCHEMA_SQL,
  };
}

export async function syncWinnerToSupabase(row: Record<string, unknown>): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('winner_records').upsert({
      id: Number(row.id),
      winner_name: String(row.winner_name),
      mobile_number: String(row.mobile_number),
      ticket_number: String(row.ticket_number),
      lottery_name: String(row.lottery_name),
      prize_position: String(row.prize_position),
      winning_amount: Number(row.winning_amount),
      winning_amount_formatted: String(row.winning_amount_formatted),
      draw_date: String(row.draw_date),
      seller_info: String(row.seller_info),
      certificate_ref: String(row.certificate_ref),
      is_verified: Number(row.is_verified),
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Keep SQLite primary operational if table isn't initialized yet
  }
}

export async function deleteWinnerFromSupabase(id: number): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('winner_records').delete().eq('id', id);
  } catch {
    // Ignore if table not created yet
  }
}

export async function syncPrizeToSupabase(row: {
  id: number;
  sort_order: number;
  prize_name: string;
  prize_amount: string;
  winning_tickets: string[];
  highlighted_ticket?: string | null;
  lottery_name: string;
  draw_date: string;
  is_sample: number;
}): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('prize_categories').upsert({
      id: row.id,
      sort_order: row.sort_order,
      prize_name: row.prize_name,
      prize_amount: row.prize_amount,
      winning_tickets: row.winning_tickets,
      highlighted_ticket: row.highlighted_ticket ?? null,
      lottery_name: row.lottery_name,
      draw_date: row.draw_date,
      is_sample: row.is_sample,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Ignore if table not created yet
  }
}

export async function deletePrizeFromSupabase(id: number): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('prize_categories').delete().eq('id', id);
  } catch {
    // Ignore if table not created yet
  }
}

export async function syncAppointmentToSupabase(row: Record<string, unknown>): Promise<boolean> {
  if (!supabaseClient) return false;
  try {
    const { error } = await supabaseClient.from('appointments').upsert({
      id: Number(row.id),
      full_name: String(row.full_name),
      mobile_number: String(row.mobile_number),
      email: String(row.email || ''),
      appointment_date: String(row.appointment_date),
      purpose: String(row.purpose),
      notes: String(row.notes || ''),
      status: String(row.status || 'Confirmed'),
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteAppointmentFromSupabase(id: number): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('appointments').delete().eq('id', id);
  } catch {
    // Ignore if table not created yet
  }
}

export async function pushAllToSupabase(
  winners: Record<string, unknown>[],
  prizes: Array<{
    id: number;
    sort_order: number;
    prize_name: string;
    prize_amount: string;
    winning_tickets: string[];
    highlighted_ticket?: string | null;
    lottery_name: string;
    draw_date: string;
    is_sample: number;
  }>,
  appointments: Record<string, unknown>[]
): Promise<{ ok: boolean; synced: { winners: number; prizes: number; appointments: number }; error: string | null }> {
  if (!supabaseClient) {
    return { ok: false, synced: { winners: 0, prizes: 0, appointments: 0 }, error: 'Supabase not configured' };
  }

  let errMsg: string | null = null;
  let wCount = 0;
  let pCount = 0;
  let aCount = 0;

  if (winners.length > 0) {
    const payload = winners.map((row) => ({
      id: Number(row.id),
      winner_name: String(row.winner_name),
      mobile_number: String(row.mobile_number),
      ticket_number: String(row.ticket_number),
      lottery_name: String(row.lottery_name),
      prize_position: String(row.prize_position),
      winning_amount: Number(row.winning_amount),
      winning_amount_formatted: String(row.winning_amount_formatted),
      draw_date: String(row.draw_date),
      seller_info: String(row.seller_info),
      certificate_ref: String(row.certificate_ref),
      is_verified: Number(row.is_verified),
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseClient.from('winner_records').upsert(payload);
    if (error) errMsg = error.message;
    else wCount = payload.length;
  }

  if (prizes.length > 0) {
    const payload = prizes.map((p) => ({
      id: p.id,
      sort_order: p.sort_order,
      prize_name: p.prize_name,
      prize_amount: p.prize_amount,
      winning_tickets: p.winning_tickets,
      highlighted_ticket: p.highlighted_ticket ?? null,
      lottery_name: p.lottery_name,
      draw_date: p.draw_date,
      is_sample: p.is_sample,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseClient.from('prize_categories').upsert(payload);
    if (error && !errMsg) errMsg = error.message;
    else if (!error) pCount = payload.length;
  }

  if (appointments.length > 0) {
    const payload = appointments.map((row) => ({
      id: Number(row.id),
      full_name: String(row.full_name),
      mobile_number: String(row.mobile_number),
      email: String(row.email || ''),
      appointment_date: String(row.appointment_date),
      purpose: String(row.purpose),
      notes: String(row.notes || ''),
      status: String(row.status || 'Confirmed'),
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    }));
    const { error } = await supabaseClient.from('appointments').upsert(payload);
    if (error && !errMsg) errMsg = error.message;
    else if (!error) aCount = payload.length;
  }

  return {
    ok: !errMsg,
    synced: { winners: wCount, prizes: pCount, appointments: aCount },
    error: errMsg,
  };
}

let hydratedOnce = false;
let hydratingPromise: Promise<void> | null = null;

export async function hydrateFromSupabase(database: BetterSqliteDatabase): Promise<void> {
  if (!supabaseClient || hydratedOnce) return;
  if (hydratingPromise) return hydratingPromise;

  hydratingPromise = (async () => {
    try {
      const [wRes, pRes, aRes] = await Promise.all([
        supabaseClient!.from('winner_records').select('*'),
        supabaseClient!.from('prize_categories').select('*'),
        supabaseClient!.from('appointments').select('*'),
      ]);

      if (!wRes.error && Array.isArray(wRes.data)) {
        const upsertWinner = database.prepare(`
          INSERT INTO winner_records (
            id, winner_name, mobile_number, ticket_number, lottery_name,
            prize_position, winning_amount, winning_amount_formatted, draw_date,
            seller_info, certificate_ref, is_verified, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            winner_name = excluded.winner_name,
            mobile_number = excluded.mobile_number,
            ticket_number = excluded.ticket_number,
            lottery_name = excluded.lottery_name,
            prize_position = excluded.prize_position,
            winning_amount = excluded.winning_amount,
            winning_amount_formatted = excluded.winning_amount_formatted,
            draw_date = excluded.draw_date,
            seller_info = excluded.seller_info,
            certificate_ref = excluded.certificate_ref,
            is_verified = excluded.is_verified,
            updated_at = excluded.updated_at
        `);
        for (const row of wRes.data) {
          upsertWinner.run(
            Number(row.id),
            String(row.winner_name),
            String(row.mobile_number),
            String(row.ticket_number),
            String(row.lottery_name),
            String(row.prize_position),
            Number(row.winning_amount),
            String(row.winning_amount_formatted),
            String(row.draw_date),
            String(row.seller_info),
            String(row.certificate_ref),
            Number(row.is_verified ?? 1),
            String(row.created_at || new Date().toISOString()),
            String(row.updated_at || new Date().toISOString())
          );
        }
      }

      if (!pRes.error && Array.isArray(pRes.data) && pRes.data.length > 0) {
        const upsertPrize = database.prepare(`
          INSERT INTO prize_categories (
            id, sort_order, prize_name, prize_amount, winning_tickets,
            highlighted_ticket, lottery_name, draw_date, is_sample, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            sort_order = excluded.sort_order,
            prize_name = excluded.prize_name,
            prize_amount = excluded.prize_amount,
            winning_tickets = excluded.winning_tickets,
            highlighted_ticket = excluded.highlighted_ticket,
            lottery_name = excluded.lottery_name,
            draw_date = excluded.draw_date,
            is_sample = excluded.is_sample,
            updated_at = excluded.updated_at
        `);
        for (const row of pRes.data) {
          const ticketsJson = Array.isArray(row.winning_tickets)
            ? JSON.stringify(row.winning_tickets)
            : typeof row.winning_tickets === 'string'
              ? row.winning_tickets
              : '[]';
          upsertPrize.run(
            Number(row.id),
            Number(row.sort_order ?? 1),
            String(row.prize_name),
            String(row.prize_amount),
            ticketsJson,
            row.highlighted_ticket ? String(row.highlighted_ticket) : null,
            String(row.lottery_name),
            String(row.draw_date),
            Number(row.is_sample ?? 1),
            String(row.updated_at || new Date().toISOString())
          );
        }
      }

      if (!aRes.error && Array.isArray(aRes.data)) {
        const upsertApt = database.prepare(`
          INSERT INTO appointments (
            id, full_name, mobile_number, email, appointment_date,
            purpose, notes, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            full_name = excluded.full_name,
            mobile_number = excluded.mobile_number,
            email = excluded.email,
            appointment_date = excluded.appointment_date,
            purpose = excluded.purpose,
            notes = excluded.notes,
            status = excluded.status
        `);
        for (const row of aRes.data) {
          upsertApt.run(
            Number(row.id),
            String(row.full_name),
            String(row.mobile_number),
            String(row.email || ''),
            String(row.appointment_date),
            String(row.purpose),
            String(row.notes || ''),
            String(row.status || 'Confirmed'),
            String(row.created_at || new Date().toISOString())
          );
        }
      }

      hydratedOnce = true;
    } catch {
      // Ignore if Supabase tables are not yet initialized
    } finally {
      hydratingPromise = null;
    }
  })();

  return hydratingPromise;
}
