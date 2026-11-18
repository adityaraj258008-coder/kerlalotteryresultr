import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IS_SERVERLESS = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);

function resolveDataDir(): string {
  if (!IS_SERVERLESS) {
    const localDir = path.resolve(process.cwd(), 'data');
    try {
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.accessSync(localDir, fs.constants.W_OK);
      return localDir;
    } catch {
      // Fall back to OS temp dir if workspace is read-only
    }
  }
  const tmpDir = path.join(os.tmpdir(), 'kerala-lottery-data');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'kerala_lottery.db');
const SECRET_PATH = path.join(DATA_DIR, '.session_secret');

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (IS_SERVERLESS) {
    // Derive a deterministic secret across serverless container instances when SESSION_SECRET env is unset
    const seed =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.ADMIN_PASSWORD ||
      'kerala-lottery-portal-serverless-secret';
    return crypto.createHash('sha256').update(seed).digest('hex');
  }
  if (fs.existsSync(SECRET_PATH)) {
    return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, { mode: 0o600 });
  return generated;
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function normalizeIndianMobile(input: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  let normalized = digits;
  if (normalized.length === 12 && normalized.startsWith('91')) {
    normalized = normalized.slice(2);
  } else if (normalized.length === 11 && normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function maskMobileNumber(mobile: string): string {
  if (!mobile || mobile.length < 6) return '**********';
  return `${mobile.slice(0, 4)}****${mobile.slice(-2)}`;
}

export function formatINR(amount: number): string {
  const safe = Math.max(0, Math.round(Number(amount) || 0));
  return `₹ ${safe.toLocaleString('en-IN')}`;
}

export function inferPrizePosition(amount: number): string {
  if (amount >= 200000000) return '1st Prize';
  if (amount >= 50000000) return '2nd Prize';
  if (amount >= 5000000) return '3rd Prize';
  if (amount >= 2000000) return '4th Prize';
  if (amount >= 500000) return '5th Prize';
  if (amount >= 50000) return '6th Prize';
  if (amount >= 5000) return '7th Prize';
  return 'Consolation Prize';
}

export function generateCertificateRef(ticketNumber: string, drawDate: string): string {
  const cleanDate = (drawDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const cleanTicket = (ticketNumber || 'KL').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
  const rand = crypto.randomInt(1000, 9999);
  return `KLR-${cleanDate}-${cleanTicket}-${rand}`;
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS winner_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      ticket_number TEXT NOT NULL,
      lottery_name TEXT NOT NULL,
      prize_position TEXT NOT NULL,
      winning_amount INTEGER NOT NULL,
      winning_amount_formatted TEXT NOT NULL,
      draw_date TEXT NOT NULL,
      seller_info TEXT NOT NULL,
      certificate_ref TEXT NOT NULL UNIQUE,
      is_verified INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_winner_mobile ON winner_records(mobile_number);
    CREATE INDEX IF NOT EXISTS idx_winner_ticket ON winner_records(ticket_number);

    CREATE TABLE IF NOT EXISTS prize_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      prize_name TEXT NOT NULL,
      prize_amount TEXT NOT NULL,
      winning_tickets TEXT NOT NULL DEFAULT '[]',
      highlighted_ticket TEXT DEFAULT NULL,
      lottery_name TEXT NOT NULL,
      draw_date TEXT NOT NULL,
      is_sample INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS visitor_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_name TEXT NOT NULL,
      city TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      appointment_date TEXT NOT NULL,
      purpose TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure highlighted_ticket column exists on older DBs
  const cols = db.prepare(`PRAGMA table_info(prize_categories)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'highlighted_ticket')) {
    db.exec(`ALTER TABLE prize_categories ADD COLUMN highlighted_ticket TEXT DEFAULT NULL`);
  }

  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };
  if (adminCount.count === 0) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'Ankushraj';
    const defaultPassword = process.env.ADMIN_PASSWORD || '@1@2@3@4@5';
    const { hash, salt } = hashPassword(defaultPassword);
    db.prepare('INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)').run(
      defaultUsername,
      hash,
      salt
    );
  }

  const existingPrizes = db.prepare('SELECT id, winning_tickets, is_sample FROM prize_categories').all() as Array<{
    id: number;
    winning_tickets: string;
    is_sample: number;
  }>;
  const hasOnlyOldTemplates =
    existingPrizes.length > 0 &&
    existingPrizes.every((p) => p.is_sample === 1 && p.winning_tickets.includes('SAMPLE-'));

  if (existingPrizes.length === 0 || hasOnlyOldTemplates) {
    if (hasOnlyOldTemplates) {
      db.prepare('DELETE FROM prize_categories').run();
    }
    const today = new Date().toISOString().slice(0, 10);
    const initialPrizes = [
      {
        sort_order: 1,
        prize_name: '1st Prize',
        prize_amount: 'Rs 30,00,00,000/-',
        winning_tickets: JSON.stringify(['KL770487']),
        lottery_name: 'Kerala Lottery (Sample Data)',
        draw_date: today,
        is_sample: 1,
      },
      {
        sort_order: 2,
        prize_name: '2nd Prize',
        prize_amount: 'Rs 10,00,00,000/-',
        winning_tickets: JSON.stringify(['KL126225']),
        lottery_name: 'Kerala Lottery (Sample Data)',
        draw_date: today,
        is_sample: 1,
      },
      {
        sort_order: 3,
        prize_name: '3rd Prize',
        prize_amount: 'Rs 75,00,000/-',
        winning_tickets: JSON.stringify(['KL872246']),
        lottery_name: 'Kerala Lottery (Sample Data)',
        draw_date: today,
        is_sample: 1,
      },
      {
        sort_order: 4,
        prize_name: '4th Prize',
        prize_amount: 'Rs 25,00,000/-',
        winning_tickets: JSON.stringify([
          'KL343962',
          'KL629903',
          'KL731262',
          'KL127824',
          'KL688508',
          'KL308496',
          'KL850800',
          'KL781453',
          'KL835392',
          'KL671412',
          'KL539898',
          'KL331148',
        ]),
        lottery_name: 'Kerala Lottery (Sample Data)',
        draw_date: today,
        is_sample: 1,
      },
      {
        sort_order: 5,
        prize_name: '5th Prize',
        prize_amount: 'Rs 12,00,000/-',
        winning_tickets: JSON.stringify([
          'KL897265',
          'KL106814',
          'KL895667',
          'KL944962',
          'KL267414',
          'KL832052',
          'KL543143',
          'KL456778',
          'KL391369',
          'KL263032',
          'KL325772',
          'KL900581',
          'KL452944',
          'KL207175',
          'KL197251',
          'KL498382',
        ]),
        lottery_name: 'Kerala Lottery (Sample Data)',
        draw_date: today,
        is_sample: 1,
      },
      {
        sort_order: 6,
        prize_name: '6th Prize',
        prize_amount: 'Rs 1,00,000/-',
        winning_tickets: JSON.stringify([
          'KL377370',
          'KL946335',
          'KL145561',
          'KL865179',
          'KL581741',
          'KL662275',
          'KL230889',
          'KL496922',
          'KL182627',
          'KL678856',
          'KL407419',
          'KL969693',
          'KL759176',
          'KL748564',
          'KL479201',
          'KL705397',
          'KL301629',
          'KL838797',
          'KL172933',
          'KL148050',
          'KL793384',
          'KL338968',
          'KL910620',
          'KL403445',
          'KL183667',
          'KL996865',
          'KL344098',
          'KL205907',
          'KL498591',
          'KL391476',
        ]),
        lottery_name: 'Kerala Lottery (Sample Data)',
        draw_date: today,
        is_sample: 1,
      },
    ];

    const insertPrize = db.prepare(`
      INSERT INTO prize_categories (sort_order, prize_name, prize_amount, winning_tickets, lottery_name, draw_date, is_sample)
      VALUES (@sort_order, @prize_name, @prize_amount, @winning_tickets, @lottery_name, @draw_date, @is_sample)
    `);
    const insertMany = db.transaction((rows: typeof initialPrizes) => {
      for (const row of rows) {
        insertPrize.run(row);
      }
    });
    insertMany(initialPrizes);
  }
}
