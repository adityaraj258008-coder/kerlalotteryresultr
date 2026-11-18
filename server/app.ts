import 'dotenv/config';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  db,
  formatINR,
  generateCertificateRef,
  getSessionSecret,
  hashPassword,
  inferPrizePosition,
  initDatabase,
  maskMobileNumber,
  normalizeIndianMobile,
  verifyPassword,
} from './db.ts';
import {
  deleteAppointmentFromSupabase,
  deletePrizeFromSupabase,
  deleteWinnerFromSupabase,
  getSupabaseStatus,
  hydrateFromSupabase,
  pushAllToSupabase,
  syncAppointmentToSupabase,
  syncPrizeToSupabase,
  syncWinnerToSupabase,
} from './supabase.ts';

initDatabase();

const SESSION_SECRET = getSessionSecret();
const COOKIE_NAME = 'klr_admin_session';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  adminId: number;
  username: string;
  exp: number;
}

interface AuthedRequest extends Request {
  admin?: SessionPayload;
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.admin = payload;
  next();
}

function sanitizePrizeRow(row: Record<string, unknown>) {
  let tickets: string[] = [];
  try {
    tickets = JSON.parse(String(row.winning_tickets || '[]'));
    if (!Array.isArray(tickets)) tickets = [];
  } catch {
    tickets = [];
  }
  return {
    id: Number(row.id),
    sort_order: Number(row.sort_order),
    prize_name: String(row.prize_name),
    prize_amount: String(row.prize_amount),
    winning_tickets: tickets.map((t) => String(t)),
    highlighted_ticket: row.highlighted_ticket ? String(row.highlighted_ticket) : null,
    lottery_name: String(row.lottery_name),
    draw_date: String(row.draw_date),
    is_sample: Number(row.is_sample),
    updated_at: String(row.updated_at),
  };
}

async function syncWinnerTicketToPrizeTier(
  prizePosition: string,
  ticketNumber: string,
  lotteryName: string,
  drawDate: string,
  isVerified: number
): Promise<void> {
  const posLower = prizePosition.trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM prize_categories ORDER BY sort_order ASC').all() as Record<
    string,
    unknown
  >[];
  const target = rows.find((r) => {
    const pName = String(r.prize_name || '').trim().toLowerCase();
    return pName === posLower || pName.startsWith(posLower) || posLower.startsWith(pName);
  });
  if (!target) return;

  let tickets: string[] = [];
  try {
    tickets = JSON.parse(String(target.winning_tickets || '[]'));
    if (!Array.isArray(tickets)) tickets = [];
  } catch {
    tickets = [];
  }

  const upperTicket = ticketNumber.trim().toUpperCase();
  const isSingleTicketTier =
    posLower.startsWith('1st') || posLower.startsWith('2nd') || posLower.startsWith('3rd');

  let cleaned: string[];
  if (isVerified === 1 && Number(target.is_sample) === 1 && isSingleTicketTier) {
    cleaned = [upperTicket];
  } else {
    cleaned =
      isVerified === 1
        ? tickets.filter((t) => !String(t).toUpperCase().startsWith('SAMPLE-'))
        : [...tickets];
    if (!cleaned.some((t) => t.toUpperCase() === upperTicket)) {
      cleaned.unshift(upperTicket);
    }
  }

  const nextLottery =
    isVerified === 1 && String(target.lottery_name || '').includes('Sample')
      ? lotteryName
      : String(target.lottery_name);

  db.prepare(
    `UPDATE prize_categories
     SET winning_tickets = ?, lottery_name = ?, draw_date = ?, is_sample = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    JSON.stringify(cleaned),
    nextLottery,
    drawDate || String(target.draw_date),
    isVerified === 1 ? 0 : Number(target.is_sample),
    Number(target.id)
  );

  const syncedRow = db
    .prepare('SELECT * FROM prize_categories WHERE id = ?')
    .get(Number(target.id)) as Record<string, unknown> | undefined;
  if (syncedRow) {
    await syncPrizeToSupabase(sanitizePrizeRow(syncedRow));
  }
}

function toPublicWinner(row: Record<string, unknown>) {
  const rawMobile = String(row.mobile_number || '');
  return {
    id: Number(row.id),
    winner_name: String(row.winner_name),
    masked_mobile: maskMobileNumber(rawMobile),
    ticket_number: String(row.ticket_number),
    lottery_name: String(row.lottery_name),
    prize_position: String(row.prize_position),
    winning_amount: Number(row.winning_amount),
    winning_amount_formatted: String(row.winning_amount_formatted),
    draw_date: String(row.draw_date),
    seller_info: String(row.seller_info),
    certificate_ref: String(row.certificate_ref),
    is_verified: Number(row.is_verified),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toAdminWinner(row: Record<string, unknown>) {
  const rawMobile = String(row.mobile_number || '');
  return {
    ...toPublicWinner(row),
    mobile_number: rawMobile,
  };
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Normalize Netlify Function prefix when invoked via /.netlify/functions/api/*
  app.use((req, _res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const rest = req.url.slice('/.netlify/functions/api'.length);
      req.url = `/api${rest.startsWith('/') ? rest : `/${rest}`}`;
    }
    next();
  });

  // Ensure serverless cold starts hydrate SQLite from Supabase on first API request
  app.use('/api', async (_req, _res, next) => {
    await hydrateFromSupabase(db);
    next();
  });

  // Public API routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/public/stats', (_req, res) => {
    const verifiedWinners = db
      .prepare('SELECT COUNT(*) as count FROM winner_records WHERE is_verified = 1')
      .get() as { count: number };
    const prizeCategories = db
      .prepare('SELECT COUNT(*) as count FROM prize_categories')
      .get() as { count: number };
    const verifiedPrizeRows = db
      .prepare('SELECT COUNT(*) as count FROM prize_categories WHERE is_sample = 0')
      .get() as { count: number };
    const drawDates = db
      .prepare(
        `SELECT COUNT(DISTINCT draw_date) as count FROM (
          SELECT draw_date FROM winner_records
          UNION
          SELECT draw_date FROM prize_categories
        )`
      )
      .get() as { count: number };
    const totalUpdated = db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM winner_records) + (SELECT COUNT(*) FROM prize_categories) as total`
      )
      .get() as { total: number };
    const latest = db
      .prepare(
        `SELECT MAX(updated_at) as lastUpdated FROM (
          SELECT updated_at FROM winner_records
          UNION ALL
          SELECT updated_at FROM prize_categories
        )`
      )
      .get() as { lastUpdated: string | null };

    res.json({
      lotteryResultsCount: verifiedWinners.count + verifiedPrizeRows.count,
      prizeCategoriesCount: prizeCategories.count,
      previousDrawsCount: drawDates.count,
      updatedRecordsCount: totalUpdated.total,
      lastUpdated: latest.lastUpdated,
    });
  });

  app.get('/api/public/prizes', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM prize_categories ORDER BY sort_order ASC, id ASC')
      .all() as Record<string, unknown>[];
    res.json({ prizes: rows.map(sanitizePrizeRow) });
  });

  app.get('/api/public/check-result', (req, res) => {
    const rawMobile = String(req.query.mobile || '');
    const normalized = normalizeIndianMobile(rawMobile);
    if (!normalized) {
      res.status(400).json({
        found: false,
        error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      });
      return;
    }

    const matches = db
      .prepare(
        'SELECT * FROM winner_records WHERE mobile_number = ? ORDER BY draw_date DESC, id DESC'
      )
      .all(normalized) as Record<string, unknown>[];

    if (matches.length === 0) {
      res.json({
        found: false,
        message: 'No verified winning record found for this mobile number.',
      });
      return;
    }

    const publicResults = matches.map(toPublicWinner);
    res.json({
      found: true,
      result: publicResults[0],
      allMatches: publicResults,
    });
  });

  app.get('/api/public/winners', (_req, res) => {
    const rows = db
      .prepare(
        'SELECT * FROM winner_records WHERE is_verified = 1 ORDER BY draw_date DESC, id DESC LIMIT 12'
      )
      .all() as Record<string, unknown>[];
    res.json({ winners: rows.map(toPublicWinner) });
  });

  app.get('/api/public/reviews', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM visitor_reviews ORDER BY id DESC LIMIT 24')
      .all();
    res.json({ reviews: rows });
  });

  app.post('/api/public/reviews', (req, res) => {
    const author_name = String(req.body?.author_name || '').trim().slice(0, 60);
    const city = String(req.body?.city || '').trim().slice(0, 50) || 'Kerala';
    const rating = Math.min(5, Math.max(1, Number(req.body?.rating) || 5));
    const comment = String(req.body?.comment || '').trim().slice(0, 400);

    if (author_name.length < 2 || comment.length < 5) {
      res.status(400).json({ error: 'Please provide your name and a short feedback message.' });
      return;
    }

    const info = db
      .prepare(
        'INSERT INTO visitor_reviews (author_name, city, rating, comment) VALUES (?, ?, ?, ?)'
      )
      .run(author_name, city, rating, comment);

    const created = db
      .prepare('SELECT * FROM visitor_reviews WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ review: created });
  });

  // Admin Authentication
  app.post('/api/admin/login', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const adminRow = db
      .prepare('SELECT id, username, password_hash, salt FROM admins WHERE username = ?')
      .get(username) as
      | { id: number; username: string; password_hash: string; salt: string }
      | undefined;

    if (!adminRow || !verifyPassword(password, adminRow.password_hash, adminRow.salt)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const token = signToken({
      adminId: adminRow.id,
      username: adminRow.username,
      exp: Date.now() + TOKEN_TTL_MS,
    });

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${Math.floor(
        TOKEN_TTL_MS / 1000
      )}; SameSite=Lax${isHttps ? '; Secure' : ''}`
    );

    res.json({
      authenticated: true,
      username: adminRow.username,
      token,
    });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
    );
    res.json({ ok: true });
  });

  app.get('/api/admin/me', requireAdmin, (req: AuthedRequest, res) => {
    res.json({ authenticated: true, username: req.admin?.username });
  });

  app.post('/api/admin/change-password', requireAdmin, (req: AuthedRequest, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const adminRow = db
      .prepare('SELECT id, password_hash, salt FROM admins WHERE id = ?')
      .get(req.admin!.adminId) as
      | { id: number; password_hash: string; salt: string }
      | undefined;

    if (!adminRow || !verifyPassword(currentPassword, adminRow.password_hash, adminRow.salt)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?').run(
      hash,
      salt,
      adminRow.id
    );
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  // Protected Admin Winner CRUD
  app.get('/api/admin/winners', requireAdmin, (req, res) => {
    const search = String(req.query.search || '').trim();
    let rows: Record<string, unknown>[];
    if (search) {
      const like = `%${search}%`;
      rows = db
        .prepare(
          `SELECT * FROM winner_records
           WHERE winner_name LIKE ? OR mobile_number LIKE ? OR ticket_number LIKE ? OR lottery_name LIKE ? OR certificate_ref LIKE ?
           ORDER BY id DESC`
        )
        .all(like, like, like, like, like) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare('SELECT * FROM winner_records ORDER BY id DESC')
        .all() as Record<string, unknown>[];
    }
    res.json({ winners: rows.map(toAdminWinner) });
  });

  app.post('/api/admin/winners', requireAdmin, async (req, res) => {
    const winner_name = String(req.body?.winner_name || '').trim();
    const normalizedMobile = normalizeIndianMobile(String(req.body?.mobile_number || ''));
    const ticket_number = String(req.body?.ticket_number || '').trim().toUpperCase();
    const lottery_name = String(req.body?.lottery_name || '').trim() || 'Kerala Lottery';
    const draw_date =
      String(req.body?.draw_date || '').trim() || new Date().toISOString().slice(0, 10);

    const rawAmount = Number(String(req.body?.winning_amount ?? '0').replace(/[^0-9.]/g, ''));
    const winning_amount = Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0;

    if (!winner_name) {
      res.status(400).json({ error: 'Winner name is required.' });
      return;
    }
    if (!normalizedMobile) {
      res.status(400).json({ error: 'A valid 10-digit Indian mobile number is required.' });
      return;
    }
    if (!ticket_number) {
      res.status(400).json({ error: 'Ticket number is required.' });
      return;
    }
    if (winning_amount <= 0) {
      res.status(400).json({ error: 'Winning amount must be greater than 0.' });
      return;
    }

    const prize_position =
      String(req.body?.prize_position || '').trim() || inferPrizePosition(winning_amount);
    const winning_amount_formatted = formatINR(winning_amount);
    const seller_info =
      String(req.body?.seller_info || '').trim() ||
      `Verified Portal Record · ${lottery_name} Agency`;
    const certificate_ref =
      String(req.body?.certificate_ref || '').trim().toUpperCase() ||
      generateCertificateRef(ticket_number, draw_date);
    const is_verified = req.body?.is_verified === 0 || req.body?.is_verified === false ? 0 : 1;

    try {
      const info = db
        .prepare(
          `INSERT INTO winner_records
           (winner_name, mobile_number, ticket_number, lottery_name, prize_position, winning_amount, winning_amount_formatted, draw_date, seller_info, certificate_ref, is_verified)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          winner_name,
          normalizedMobile,
          ticket_number,
          lottery_name,
          prize_position,
          winning_amount,
          winning_amount_formatted,
          draw_date,
          seller_info,
          certificate_ref,
          is_verified
        );

      await syncWinnerTicketToPrizeTier(
        prize_position,
        ticket_number,
        lottery_name,
        draw_date,
        is_verified
      );

      const created = db
        .prepare('SELECT * FROM winner_records WHERE id = ?')
        .get(info.lastInsertRowid) as Record<string, unknown>;
      await syncWinnerToSupabase(created);
      res.status(201).json({ winner: toAdminWinner(created) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create record';
      res.status(400).json({
        error: message.includes('UNIQUE') ? 'Certificate reference already exists.' : message,
      });
    }
  });

  app.put('/api/admin/winners/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM winner_records WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Winner record not found.' });
      return;
    }

    const winner_name = String(req.body?.winner_name ?? existing.winner_name).trim();
    const normalizedMobile = normalizeIndianMobile(
      String(req.body?.mobile_number ?? existing.mobile_number)
    );
    const ticket_number = String(req.body?.ticket_number ?? existing.ticket_number)
      .trim()
      .toUpperCase();
    const lottery_name = String(req.body?.lottery_name ?? existing.lottery_name).trim();
    const draw_date = String(req.body?.draw_date ?? existing.draw_date).trim();
    const rawAmount = Number(
      String(req.body?.winning_amount ?? existing.winning_amount).replace(/[^0-9.]/g, '')
    );
    const winning_amount = Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0;

    if (!winner_name || !normalizedMobile || !ticket_number || winning_amount <= 0) {
      res.status(400).json({ error: 'Valid name, 10-digit mobile, ticket number, and amount are required.' });
      return;
    }

    const prize_position =
      String(req.body?.prize_position ?? existing.prize_position).trim() ||
      inferPrizePosition(winning_amount);
    const winning_amount_formatted = formatINR(winning_amount);
    const seller_info =
      String(req.body?.seller_info ?? existing.seller_info).trim() ||
      `Verified Portal Record · ${lottery_name} Agency`;
    const certificate_ref =
      String(req.body?.certificate_ref ?? existing.certificate_ref)
        .trim()
        .toUpperCase() || generateCertificateRef(ticket_number, draw_date);
    const is_verified = req.body?.is_verified === 0 || req.body?.is_verified === false ? 0 : 1;

    try {
      db.prepare(
        `UPDATE winner_records
         SET winner_name = ?, mobile_number = ?, ticket_number = ?, lottery_name = ?, prize_position = ?, winning_amount = ?, winning_amount_formatted = ?, draw_date = ?, seller_info = ?, certificate_ref = ?, is_verified = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        winner_name,
        normalizedMobile,
        ticket_number,
        lottery_name,
        prize_position,
        winning_amount,
        winning_amount_formatted,
        draw_date,
        seller_info,
        certificate_ref,
        is_verified,
        id
      );

      await syncWinnerTicketToPrizeTier(
        prize_position,
        ticket_number,
        lottery_name,
        draw_date,
        is_verified
      );

      const updated = db
        .prepare('SELECT * FROM winner_records WHERE id = ?')
        .get(id) as Record<string, unknown>;
      await syncWinnerToSupabase(updated);
      res.json({ winner: toAdminWinner(updated) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update record';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/admin/winners/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM winner_records WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }
    await deleteWinnerFromSupabase(id);
    res.json({ ok: true });
  });

  // Protected Admin Prize Categories CRUD
  app.get('/api/admin/prizes', requireAdmin, (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM prize_categories ORDER BY sort_order ASC, id ASC')
      .all() as Record<string, unknown>[];
    res.json({ prizes: rows.map(sanitizePrizeRow) });
  });

  app.post('/api/admin/prizes', requireAdmin, async (req, res) => {
    const sort_order = Number(req.body?.sort_order) || 1;
    const prize_name = String(req.body?.prize_name || '').trim();
    const prize_amount = String(req.body?.prize_amount || '').trim();
    const lottery_name = String(req.body?.lottery_name || '').trim();
    const draw_date =
      String(req.body?.draw_date || '').trim() || new Date().toISOString().slice(0, 10);
    const is_sample = req.body?.is_sample ? 1 : 0;

    let tickets: string[] = [];
    if (Array.isArray(req.body?.winning_tickets)) {
      tickets = req.body.winning_tickets.map((t: unknown) => String(t).trim()).filter(Boolean);
    } else if (typeof req.body?.winning_tickets === 'string') {
      tickets = req.body.winning_tickets
        .split(/[\n,]+/)
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    if (!prize_name || !prize_amount || !lottery_name) {
      res.status(400).json({ error: 'Prize name, amount, and lottery name are required.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO prize_categories (sort_order, prize_name, prize_amount, winning_tickets, lottery_name, draw_date, is_sample)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sort_order,
        prize_name,
        prize_amount,
        JSON.stringify(tickets),
        lottery_name,
        draw_date,
        is_sample
      );

    const created = db
      .prepare('SELECT * FROM prize_categories WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;
    const sanitized = sanitizePrizeRow(created);
    await syncPrizeToSupabase(sanitized);
    res.status(201).json({ prize: sanitized });
  });

  app.put('/api/admin/prizes/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM prize_categories WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Prize category not found.' });
      return;
    }

    const sort_order = Number(req.body?.sort_order ?? existing.sort_order) || 1;
    const prize_name = String(req.body?.prize_name ?? existing.prize_name).trim();
    const prize_amount = String(req.body?.prize_amount ?? existing.prize_amount).trim();
    const lottery_name = String(req.body?.lottery_name ?? existing.lottery_name).trim();
    const draw_date = String(req.body?.draw_date ?? existing.draw_date).trim();
    const is_sample = req.body?.is_sample === true || req.body?.is_sample === 1 ? 1 : 0;

    let tickets: string[] = [];
    if (Array.isArray(req.body?.winning_tickets)) {
      tickets = req.body.winning_tickets.map((t: unknown) => String(t).trim()).filter(Boolean);
    } else if (typeof req.body?.winning_tickets === 'string') {
      tickets = req.body.winning_tickets
        .split(/[\n,]+/)
        .map((t: string) => t.trim())
        .filter(Boolean);
    } else {
      try {
        tickets = JSON.parse(String(existing.winning_tickets || '[]'));
      } catch {
        tickets = [];
      }
    }

    db.prepare(
      `UPDATE prize_categories
       SET sort_order = ?, prize_name = ?, prize_amount = ?, winning_tickets = ?, lottery_name = ?, draw_date = ?, is_sample = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      sort_order,
      prize_name,
      prize_amount,
      JSON.stringify(tickets),
      lottery_name,
      draw_date,
      is_sample,
      id
    );

    const updated = db
      .prepare('SELECT * FROM prize_categories WHERE id = ?')
      .get(id) as Record<string, unknown>;
    const sanitized = sanitizePrizeRow(updated);
    await syncPrizeToSupabase(sanitized);
    res.json({ prize: sanitized });
  });

  app.post('/api/admin/prizes/:id/highlight', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const ticket = req.body?.ticket ? String(req.body.ticket).trim().toUpperCase() : null;
    const existing = db.prepare('SELECT * FROM prize_categories WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Prize category not found.' });
      return;
    }
    const current = existing.highlighted_ticket ? String(existing.highlighted_ticket).toUpperCase() : null;
    const nextTicket = ticket && current === ticket ? null : ticket;
    db.prepare(
      `UPDATE prize_categories SET highlighted_ticket = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nextTicket, id);
    const updated = db
      .prepare('SELECT * FROM prize_categories WHERE id = ?')
      .get(id) as Record<string, unknown>;
    const sanitized = sanitizePrizeRow(updated);
    await syncPrizeToSupabase(sanitized);
    res.json({ prize: sanitized });
  });

  app.delete('/api/admin/prizes/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM prize_categories WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Prize category not found.' });
      return;
    }
    await deletePrizeFromSupabase(id);
    res.json({ ok: true });
  });

  // Public Booking / Appointment Submission (saves to SQLite + Supabase)
  app.post('/api/public/appointments', async (req, res) => {
    const full_name = String(req.body?.full_name || '').trim().slice(0, 80);
    const normalizedMobile = normalizeIndianMobile(String(req.body?.mobile_number || ''));
    const email = String(req.body?.email || '').trim().slice(0, 120);
    const appointment_date =
      String(req.body?.appointment_date || '').trim() || new Date().toISOString().slice(0, 10);
    const purpose = String(req.body?.purpose || '').trim().slice(0, 120) || 'Result Verification Inquiry';
    const notes = String(req.body?.notes || '').trim().slice(0, 500);

    if (full_name.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!normalizedMobile) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO appointments (full_name, mobile_number, email, appointment_date, purpose, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Confirmed')`
      )
      .run(full_name, normalizedMobile, email, appointment_date, purpose, notes);

    const created = db
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;

    const syncedToSupabase = await syncAppointmentToSupabase(created);

    res.status(201).json({
      appointment: created,
      syncedToSupabase,
    });
  });

  // Protected Admin Appointments CRUD
  app.get('/api/admin/appointments', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM appointments ORDER BY id DESC').all();
    res.json({ appointments: rows });
  });

  app.patch('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!status) {
      res.status(400).json({ error: 'Status is required.' });
      return;
    }
    const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    await syncAppointmentToSupabase(updated);
    res.json({ appointment: updated });
  });

  app.delete('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    await deleteAppointmentFromSupabase(id);
    res.json({ ok: true });
  });

  // Protected Admin Supabase Status & Bulk Sync
  app.get('/api/admin/supabase/status', requireAdmin, async (_req, res) => {
    const status = await getSupabaseStatus();
    res.json(status);
  });

  app.post('/api/admin/supabase/sync', requireAdmin, async (_req, res) => {
    const winners = db.prepare('SELECT * FROM winner_records ORDER BY id ASC').all() as Record<
      string,
      unknown
    >[];
    const prizeRows = db
      .prepare('SELECT * FROM prize_categories ORDER BY sort_order ASC, id ASC')
      .all() as Record<string, unknown>[];
    const prizes = prizeRows.map(sanitizePrizeRow);
    const appointments = db.prepare('SELECT * FROM appointments ORDER BY id ASC').all() as Record<
      string,
      unknown
    >[];

    const result = await pushAllToSupabase(winners, prizes, appointments);
    const status = await getSupabaseStatus();
    res.json({ ...result, status });
  });

  return app;
}
