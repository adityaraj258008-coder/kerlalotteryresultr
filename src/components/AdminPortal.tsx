import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import type {
  AppointmentRecord,
  PrizeCategory,
  SupabaseStatus,
  WinnerRecord,
} from '../types';
import {
  downloadWinnerCertificatePNG,
  formatINRClient,
  generateCertRefClient,
  inferLotteryFromTicketClient,
  inferPrizePositionClient,
  normalizeIndianMobileClient,
} from '../utils/lotteryHelpers';
import { CertificateCard } from './CertificateCard';
import { KeralaPortalEmblem } from './KeralaArtwork';
import { WinningResultCard } from './WinningResultCard';

interface AdminPortalProps {
  onBackToSite: () => void;
}

const SESSION_KEY = 'klr_admin_token';

const LOTTERY_OPTIONS = [
  'Karunya Plus',
  'Sthree Sakthi',
  'Win-Win',
  'Fifty-Fifty',
  'Nirmal',
  'Karunya',
  'Akshaya',
  'Onam Bumper',
  'Vishu Bumper',
  'Christmas New Year Bumper',
];

export function AdminPortal({ onBackToSite }: AdminPortalProps) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminUsername, setAdminUsername] = useState<string>('');

  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<
    'winners' | 'prizes' | 'appointments' | 'supabase' | 'security'
  >('winners');

  // Winner Management State
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [winnerSearch, setWinnerSearch] = useState('');
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [editingWinnerId, setEditingWinnerId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [previewWinnerModal, setPreviewWinnerModal] = useState<WinnerRecord | null>(null);

  // Smart Auto-Fill Winner Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [wName, setWName] = useState('');
  const [wMobile, setWMobile] = useState('');
  const [wTicket, setWTicket] = useState('');
  const [wDate, setWDate] = useState(todayStr);
  const [wLottery, setWLottery] = useState('Karunya Plus');
  const [wAmount, setWAmount] = useState('');
  const [wPosition, setWPosition] = useState('');
  const [wSeller, setWSeller] = useState('');
  const [wCertRef, setWCertRef] = useState('');
  const [wVerified, setWVerified] = useState(true);

  // Track manual overrides so Smart Auto-Fill never fights manual edits
  const [manualPosition, setManualPosition] = useState(false);
  const [manualSeller, setManualSeller] = useState(false);
  const [manualCertRef, setManualCertRef] = useState(false);
  const [manualLottery, setManualLottery] = useState(false);

  const [winnerFormError, setWinnerFormError] = useState<string | null>(null);
  const [winnerFormSuccess, setWinnerFormSuccess] = useState<string | null>(null);
  const [winnerSaving, setWinnerSaving] = useState(false);
  const [livePreviewMode, setLivePreviewMode] = useState<'card' | 'certificate'>('card');

  // Prize Categories Management State
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<number | null>(null);
  const [pSortOrder, setPSortOrder] = useState('1');
  const [pName, setPName] = useState('');
  const [pAmount, setPAmount] = useState('');
  const [pTicketsText, setPTicketsText] = useState('');
  const [pLottery, setPLottery] = useState('Karunya Plus');
  const [pDate, setPDate] = useState(todayStr);
  const [pIsSample, setPIsSample] = useState(false);
  const [prizeFormMsg, setPrizeFormMsg] = useState<string | null>(null);
  const [prizeSaving, setPrizeSaving] = useState(false);

  // Appointments & Supabase Sync State
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [supabaseSyncMsg, setSupabaseSyncMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Security Tab State
  const [curPassword, setCurPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [secMessage, setSecMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        setToken(null);
        setAdminUsername('');
      }
      return res;
    },
    [token]
  );

  // Verify existing session on mount
  useEffect(() => {
    let active = true;
    async function verifySession() {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch('/api/admin/me', { headers });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setAdminUsername(data.username || 'Admin');
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          setToken(null);
        }
      } catch {
        // Ignore
      } finally {
        if (active) setCheckingAuth(false);
      }
    }
    verifySession();
    return () => {
      active = false;
    };
  }, [token]);

  const fetchAdminData = useCallback(
    async (searchQuery = '') => {
      if (!adminUsername) return;
      setWinnersLoading(true);
      setPrizesLoading(true);
      setAppointmentsLoading(true);
      setSupabaseLoading(true);
      try {
        const [wRes, pRes, aRes, sRes] = await Promise.all([
          authFetch(`/api/admin/winners?search=${encodeURIComponent(searchQuery)}`),
          authFetch('/api/admin/prizes'),
          authFetch('/api/admin/appointments'),
          authFetch('/api/admin/supabase/status'),
        ]);
        if (wRes.ok) {
          const wd = await wRes.json();
          setWinners(wd.winners || []);
        }
        if (pRes.ok) {
          const pd = await pRes.json();
          setPrizes(pd.prizes || []);
        }
        if (aRes.ok) {
          const ad = await aRes.json();
          setAppointments(ad.appointments || []);
        }
        if (sRes.ok) {
          const sd = (await sRes.json()) as SupabaseStatus;
          setSupabaseStatus(sd);
        }
      } finally {
        setWinnersLoading(false);
        setPrizesLoading(false);
        setAppointmentsLoading(false);
        setSupabaseLoading(false);
      }
    },
    [adminUsername, authFetch]
  );

  useEffect(() => {
    if (adminUsername) {
      fetchAdminData(winnerSearch);
    }
  }, [adminUsername, fetchAdminData, winnerSearch]);

  // Smart Auto-Fill Effect whenever core 6 inputs change or Ticket matches Today's Prizes
  useEffect(() => {
    const cleanTicket = wTicket.trim().toUpperCase();
    const matchedTier = cleanTicket
      ? prizes.find((p) =>
          p.winning_tickets.some((t) => t.trim().toUpperCase() === cleanTicket)
        )
      : undefined;

    if (matchedTier) {
      if (!manualPosition) {
        setWPosition(matchedTier.prize_name);
      }
      if (!manualLottery && !matchedTier.lottery_name.includes('Sample Template')) {
        setWLottery(matchedTier.lottery_name);
      }
      if (!wAmount) {
        const parsedDigits = matchedTier.prize_amount.replace(/[^0-9]/g, '');
        if (parsedDigits && Number(parsedDigits) > 0) {
          setWAmount(parsedDigits);
        }
      }
    } else {
      const numericAmount = Number(String(wAmount).replace(/[^0-9.]/g, '')) || 0;
      if (!manualPosition) {
        setWPosition(numericAmount > 0 ? inferPrizePositionClient(numericAmount) : '');
      }
      if (!manualLottery && cleanTicket.length >= 2) {
        const inferredLottery = inferLotteryFromTicketClient(cleanTicket);
        if (inferredLottery) setWLottery(inferredLottery);
      }
    }

    if (!manualSeller) {
      setWSeller(
        wLottery.trim() ? `Verified Portal Record · ${wLottery.trim()} Agency` : ''
      );
    }
    if (!manualCertRef) {
      if (cleanTicket) {
        setWCertRef(generateCertRefClient(cleanTicket, wDate));
      } else {
        setWCertRef('');
      }
    }
  }, [
    wAmount,
    wTicket,
    wDate,
    wLottery,
    prizes,
    manualPosition,
    manualSeller,
    manualCertRef,
    manualLottery,
  ]);

  const handlePickTierTicket = (prize: PrizeCategory, ticket: string) => {
    const upper = ticket.trim().toUpperCase();
    setWTicket(upper);
    setManualPosition(false);
    setWPosition(prize.prize_name);
    const digits = prize.prize_amount.replace(/[^0-9]/g, '');
    if (digits && Number(digits) > 0) {
      setWAmount(digits);
    }
    if (prize.draw_date) {
      setWDate(prize.draw_date);
    }
    if (prize.lottery_name && !prize.lottery_name.includes('Sample Template')) {
      setManualLottery(true);
      setWLottery(prize.lottery_name);
    }
  };

  const handleToggleHighlightTicket = async (prizeId: number, ticket: string) => {
    const res = await authFetch(`/api/admin/prizes/${prizeId}/highlight`, {
      method: 'POST',
      body: JSON.stringify({ ticket }),
    });
    if (res.ok) {
      const data = await res.json();
      setPrizes((prev) => prev.map((p) => (p.id === prizeId ? data.prize : p)));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Invalid credentials.');
        return;
      }
      if (data.token) {
        sessionStorage.setItem(SESSION_KEY, data.token);
        setToken(data.token);
      }
      setAdminUsername(data.username);
      setLoginPassword('');
    } catch {
      setLoginError('Network error while signing in.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await authFetch('/api/admin/logout', { method: 'POST' });
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
    setAdminUsername('');
  };

  const resetWinnerForm = () => {
    setEditingWinnerId(null);
    setWName('');
    setWMobile('');
    setWTicket('');
    setWDate(todayStr);
    setWLottery('Karunya Plus');
    setWAmount('');
    setWPosition('');
    setWSeller('');
    setWCertRef('');
    setWVerified(true);
    setManualPosition(false);
    setManualSeller(false);
    setManualCertRef(false);
    setManualLottery(false);
    setWinnerFormError(null);
  };

  const handleSaveWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    setWinnerFormError(null);
    setWinnerFormSuccess(null);

    const normalizedMobile = normalizeIndianMobileClient(wMobile);
    if (!normalizedMobile) {
      setWinnerFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const numericAmount = Number(String(wAmount).replace(/[^0-9.]/g, '')) || 0;
    if (numericAmount <= 0) {
      setWinnerFormError('Winning amount must be greater than zero.');
      return;
    }

    setWinnerSaving(true);
    try {
      const payload = {
        winner_name: wName.trim(),
        mobile_number: normalizedMobile,
        ticket_number: wTicket.trim().toUpperCase(),
        draw_date: wDate,
        lottery_name: wLottery.trim(),
        winning_amount: numericAmount,
        prize_position: wPosition.trim() || inferPrizePositionClient(numericAmount),
        seller_info: wSeller.trim() || `Verified Portal Record · ${wLottery.trim()} Agency`,
        certificate_ref:
          wCertRef.trim().toUpperCase() || generateCertRefClient(wTicket, wDate),
        is_verified: wVerified ? 1 : 0,
      };

      const url = editingWinnerId
        ? `/api/admin/winners/${editingWinnerId}`
        : '/api/admin/winners';
      const method = editingWinnerId ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setWinnerFormError(data.error || 'Failed to save winner record.');
        return;
      }

      setWinnerFormSuccess(
        editingWinnerId
          ? 'Winner record updated and published to the public result checker.'
          : 'Winner record saved! It is now live in the public result checker.'
      );
      resetWinnerForm();
      await fetchAdminData(winnerSearch);
    } catch {
      setWinnerFormError('Connection error while saving record.');
    } finally {
      setWinnerSaving(false);
    }
  };

  const startEditWinner = (w: WinnerRecord) => {
    setEditingWinnerId(w.id);
    setWName(w.winner_name);
    setWMobile(w.mobile_number || '');
    setWTicket(w.ticket_number);
    setWDate(w.draw_date);
    setWLottery(w.lottery_name);
    setWAmount(String(w.winning_amount));
    setWPosition(w.prize_position);
    setWSeller(w.seller_info);
    setWCertRef(w.certificate_ref);
    setWVerified(w.is_verified === 1);
    setManualPosition(true);
    setManualSeller(true);
    setManualCertRef(true);
    setManualLottery(true);
    setWinnerFormError(null);
    setWinnerFormSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteWinner = async (id: number) => {
    const res = await authFetch(`/api/admin/winners/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDeleteConfirmId(null);
      setWinners((prev) => prev.filter((w) => w.id !== id));
    }
  };

  // Prize Category Handlers
  const resetPrizeForm = () => {
    setEditingPrizeId(null);
    setPSortOrder(String(prizes.length + 1));
    setPName('');
    setPAmount('');
    setPTicketsText('');
    setPLottery('Karunya Plus');
    setPDate(todayStr);
    setPIsSample(false);
    setPrizeFormMsg(null);
  };

  const startEditPrize = (p: PrizeCategory) => {
    setEditingPrizeId(p.id);
    setPSortOrder(String(p.sort_order));
    setPName(p.prize_name);
    setPAmount(p.prize_amount);
    setPTicketsText(p.winning_tickets.join(', '));
    setPLottery(p.lottery_name.replace(' (Sample Template)', ''));
    setPDate(p.draw_date);
    setPIsSample(false); // Default to verified when admin edits
    setPrizeFormMsg(null);
  };

  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrizeFormMsg(null);
    setPrizeSaving(true);
    try {
      const payload = {
        sort_order: Number(pSortOrder) || 1,
        prize_name: pName.trim(),
        prize_amount: pAmount.trim(),
        winning_tickets: pTicketsText,
        lottery_name: pLottery.trim(),
        draw_date: pDate,
        is_sample: pIsSample ? 1 : 0,
      };
      const url = editingPrizeId
        ? `/api/admin/prizes/${editingPrizeId}`
        : '/api/admin/prizes';
      const method = editingPrizeId ? 'PUT' : 'POST';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setPrizeFormMsg(data.error || 'Failed to save prize category.');
        return;
      }
      setPrizeFormMsg(
        editingPrizeId ? 'Prize category updated.' : 'New prize category added.'
      );
      resetPrizeForm();
      await fetchAdminData(winnerSearch);
    } finally {
      setPrizeSaving(false);
    }
  };

  const handleDeletePrize = async (id: number) => {
    const res = await authFetch(`/api/admin/prizes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPrizes((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecMessage(null);
    const res = await authFetch('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: curPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSecMessage({ type: 'err', text: data.error || 'Could not update password.' });
      return;
    }
    setCurPassword('');
    setNewPassword('');
    setSecMessage({ type: 'ok', text: 'Admin password updated securely.' });
  };

  const handleUpdateAppointmentStatus = async (id: number, status: string) => {
    const res = await authFetch(`/api/admin/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setAppointments((prev) => prev.map((a) => (a.id === id ? data.appointment : a)));
    }
  };

  const handleDeleteAppointment = async (id: number) => {
    const res = await authFetch(`/api/admin/appointments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleRefreshSupabaseStatus = async () => {
    setSupabaseLoading(true);
    setSupabaseSyncMsg(null);
    try {
      const res = await authFetch('/api/admin/supabase/status');
      if (res.ok) {
        const sd = (await res.json()) as SupabaseStatus;
        setSupabaseStatus(sd);
      }
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleSyncSupabase = async () => {
    setSupabaseSyncing(true);
    setSupabaseSyncMsg(null);
    try {
      const res = await authFetch('/api/admin/supabase/sync', { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        setSupabaseStatus(data.status);
      }
      if (!res.ok || !data.ok || data.error) {
        setSupabaseSyncMsg({
          type: 'err',
          text:
            data.error ||
            'Could not sync all tables. Run the SQL Setup Script in Supabase first.',
        });
      } else {
        setSupabaseSyncMsg({
          type: 'ok',
          text: `Synced ${data.synced?.winners ?? 0} winners, ${
            data.synced?.prizes ?? 0
          } prize tiers, and ${data.synced?.appointments ?? 0} appointments to Supabase.`,
        });
      }
    } catch {
      setSupabaseSyncMsg({ type: 'err', text: 'Network error while syncing with Supabase.' });
    } finally {
      setSupabaseSyncing(false);
    }
  };

  const handleCopySql = async () => {
    if (!supabaseStatus?.sqlSchema) return;
    try {
      await navigator.clipboard.writeText(supabaseStatus.sqlSchema);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2200);
    } catch {
      // Fallback ignored
    }
  };

  // Build Live Preview Object for the Smart Auto-Fill Winner Form
  const numericPreviewAmount = Number(String(wAmount).replace(/[^0-9.]/g, '')) || 0;
  const previewRecord: WinnerRecord = {
    id: editingWinnerId || 0,
    winner_name: wName.trim() || 'Winner Name',
    mobile_number: wMobile.trim() || '9876543210',
    masked_mobile:
      normalizeIndianMobileClient(wMobile)
        ? `${normalizeIndianMobileClient(wMobile)!.slice(0, 4)}****${normalizeIndianMobileClient(
            wMobile
          )!.slice(-2)}`
        : '9876****10',
    ticket_number: wTicket.trim().toUpperCase() || 'KL000000',
    lottery_name: wLottery.trim() || 'Karunya Plus',
    prize_position:
      wPosition.trim() ||
      (numericPreviewAmount > 0 ? inferPrizePositionClient(numericPreviewAmount) : '1st Prize'),
    winning_amount: numericPreviewAmount,
    winning_amount_formatted: formatINRClient(numericPreviewAmount),
    draw_date: wDate || todayStr,
    seller_info: wSeller.trim() || `Verified Portal Record · ${wLottery || 'Kerala'} Agency`,
    certificate_ref:
      wCertRef.trim().toUpperCase() || generateCertRefClient(wTicket || 'KL000000', wDate),
    is_verified: wVerified ? 1 : 0,
    created_at: todayStr,
    updated_at: todayStr,
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#064B16] flex items-center justify-center text-white">
        <div className="flex items-center gap-3 text-[#FFD700] font-semibold">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading Admin Portal...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated Login Screen
  if (!adminUsername) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#064B16] via-[#04360F] to-[#022108] flex flex-col justify-center items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-[#094C17] border-2 border-[#FFD700]/45 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <KeralaPortalEmblem className="w-14 h-14 mb-3" />
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#FFD700]">
              Admin Portal Login
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1.5">
              Sign in to manage lottery results, prize tiers, and verified winner records
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-username"
                className="block text-xs font-semibold uppercase tracking-wider text-emerald-100/90 mb-1.5"
              >
                Username
              </label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none focus:ring-2 focus:ring-[#FFD700]/30 px-4 py-3 text-base text-white placeholder:text-emerald-200/45"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-emerald-100/90 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none focus:ring-2 focus:ring-[#FFD700]/30 pl-4 pr-11 py-3 text-base text-white placeholder:text-emerald-200/45"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-200 hover:text-[#FFD700] p-1 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="rounded-xl bg-red-950/60 border border-red-400/50 px-3.5 py-2.5 text-xs sm:text-sm text-red-200 text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-[#FFD700] hover:bg-[#FACC15] disabled:opacity-70 text-[#05330E] font-extrabold text-base py-3.5 shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Open Admin Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#FFD700]/15 text-center">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-emerald-200 hover:text-[#FFD700] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Public Portal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-[#04360F] text-white flex flex-col">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-40 bg-[#03290B]/95 backdrop-blur-md border-b border-[#FFD700]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <KeralaPortalEmblem className="w-9 h-9 shrink-0" />
            <div>
              <div className="font-display text-base sm:text-lg font-bold text-[#FFD700] leading-tight">
                Admin Dashboard
              </div>
              <div className="text-[11px] text-emerald-200/80">
                Signed in as <strong className="text-white">{adminUsername}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFD700]/35 hover:border-[#FFD700] bg-[#074715] px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-100 hover:text-[#FFD700] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Public Website</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[#FFD700]/20 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('winners')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'winners'
                ? 'bg-[#FFD700] text-[#05330E]'
                : 'bg-[#084D17] text-emerald-100 hover:bg-[#0B5F1D] border border-[#FFD700]/25'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Winner Records ({winners.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prizes')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'prizes'
                ? 'bg-[#FFD700] text-[#05330E]'
                : 'bg-[#084D17] text-emerald-100 hover:bg-[#0B5F1D] border border-[#FFD700]/25'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Today&apos;s Results &amp; Prizes ({prizes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'appointments'
                ? 'bg-[#FFD700] text-[#05330E]'
                : 'bg-[#084D17] text-emerald-100 hover:bg-[#0B5F1D] border border-[#FFD700]/25'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Appointments ({appointments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('supabase')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'supabase'
                ? 'bg-[#FFD700] text-[#05330E]'
                : 'bg-[#084D17] text-emerald-100 hover:bg-[#0B5F1D] border border-[#FFD700]/25'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Supabase DB</span>
            <span
              className={`w-2 h-2 rounded-full ${
                supabaseStatus?.connected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-[#FFD700] text-[#05330E]'
                : 'bg-[#084D17] text-emerald-100 hover:bg-[#0B5F1D] border border-[#FFD700]/25'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Security</span>
          </button>
        </div>

        {/* TAB 1: WINNER RECORDS + SMART AUTO-FILL */}
        {activeTab === 'winners' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left: Smart Auto-Fill Form */}
              <div className="xl:col-span-7 rounded-2xl bg-[#094C17] border border-[#FFD700]/35 p-5 sm:p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-[#FFD700]">
                      {editingWinnerId ? 'Edit Winner Record' : 'Add New Winner Record'}
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5">
                      Enter Name, Mobile, Ticket, Date, Lottery &amp; Amount — remaining fields auto-fill automatically.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFD700] bg-[#05350E] border border-[#FFD700]/35 px-3 py-1 rounded-lg">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Smart Auto-Fill Active</span>
                  </span>
                </div>

                <form onSubmit={handleSaveWinner} className="space-y-4">
                  {/* Core 6 Quick-Entry Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-emerald-100 mb-1">
                        Winner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={wName}
                        onChange={(e) => setWName(e.target.value)}
                        placeholder="e.g. Sugumar"
                        className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-emerald-200/45"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-100 mb-1">
                        Mobile Number (10 digits) *
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        required
                        value={wMobile}
                        onChange={(e) => setWMobile(e.target.value)}
                        placeholder="e.g. 7200488328"
                        className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm font-mono-code text-white placeholder:text-emerald-200/45"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-100 mb-1">
                        Ticket Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={wTicket}
                        onChange={(e) => setWTicket(e.target.value.toUpperCase())}
                        placeholder="e.g. KL897265"
                        className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm font-mono-code uppercase text-white placeholder:text-emerald-200/45"
                      />
                      {prizes.some((p) => p.winning_tickets.length > 0) && (
                        <select
                          aria-label="Pick ticket from Today's Prize Tiers"
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const [pidStr, tkt] = val.split('::');
                            const foundPrize = prizes.find((p) => p.id === Number(pidStr));
                            if (foundPrize && tkt) handlePickTierTicket(foundPrize, tkt);
                          }}
                          className="mt-1.5 w-full rounded-lg bg-[#05350E] border border-[#FFD700]/25 px-2.5 py-1.5 text-xs text-[#FFD700]"
                        >
                          <option value="">Quick-pick ticket from Today&apos;s Prize Tiers...</option>
                          {prizes.map((p) =>
                            p.winning_tickets.map((t, idx) => (
                              <option key={`${p.id}-${idx}`} value={`${p.id}::${t}`}>
                                {p.prize_name} — {t} ({p.prize_amount})
                              </option>
                            ))
                          )}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-100 mb-1">
                        Draw Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={wDate}
                        onChange={(e) => setWDate(e.target.value)}
                        className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm font-mono-code text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-100 mb-1">
                        Lottery Name *
                      </label>
                      <input
                        list="kerala-lottery-names"
                        required
                        value={wLottery}
                        onChange={(e) => {
                          setManualLottery(true);
                          setWLottery(e.target.value);
                        }}
                        placeholder="Select or type lottery name"
                        className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-emerald-200/45"
                      />
                      <datalist id="kerala-lottery-names">
                        {LOTTERY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-100 mb-1">
                        Winning Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={wAmount}
                        onChange={(e) => setWAmount(e.target.value)}
                        placeholder="e.g. 1200000"
                        className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm font-mono-code text-white placeholder:text-emerald-200/45"
                      />
                      {numericPreviewAmount > 0 && (
                        <div className="text-[11px] font-mono-code text-[#FFD700] mt-1">
                          Formatted: {formatINRClient(numericPreviewAmount)}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {[
                          { label: '1st · 30 Cr', val: '300000000', pos: '1st Prize' },
                          { label: '2nd · 10 Cr', val: '100000000', pos: '2nd Prize' },
                          { label: '3rd · 75 L', val: '7500000', pos: '3rd Prize' },
                          { label: '4th · 25 L', val: '2500000', pos: '4th Prize' },
                          { label: '5th · 12 L', val: '1200000', pos: '5th Prize' },
                          { label: '6th · 1 L', val: '100000', pos: '6th Prize' },
                        ].map((preset) => (
                          <button
                            key={preset.pos}
                            type="button"
                            onClick={() => {
                              setWAmount(preset.val);
                              setManualPosition(false);
                              setWPosition(preset.pos);
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-[#05350E] hover:bg-[#196A2A] border border-[#FFD700]/25 text-[#FFD700] cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Auto-Filled Secondary Fields (Editable) */}
                  <div className="rounded-xl bg-[#05360F] border border-[#FFD700]/25 p-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#FFD700]">
                      Auto-Filled Details (Editable)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-200/80 mb-1">
                          Prize Position
                        </label>
                        <input
                          type="text"
                          value={wPosition}
                          onChange={(e) => {
                            setManualPosition(true);
                            setWPosition(e.target.value);
                          }}
                          placeholder="Auto-filled from amount"
                          className="w-full rounded-lg bg-[#10471B] border border-[#FFD700]/25 focus:border-[#FFD700] focus:outline-none px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-200/80 mb-1">
                          Certificate Reference Number
                        </label>
                        <input
                          type="text"
                          value={wCertRef}
                          onChange={(e) => {
                            setManualCertRef(true);
                            setWCertRef(e.target.value.toUpperCase());
                          }}
                          placeholder="Auto-generated reference"
                          className="w-full rounded-lg bg-[#10471B] border border-[#FFD700]/25 focus:border-[#FFD700] focus:outline-none px-3 py-2 text-sm font-mono-code text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-emerald-200/80 mb-1">
                          Seller Information
                        </label>
                        <input
                          type="text"
                          value={wSeller}
                          onChange={(e) => {
                            setManualSeller(true);
                            setWSeller(e.target.value);
                          }}
                          placeholder="Auto-filled from lottery name"
                          className="w-full rounded-lg bg-[#10471B] border border-[#FFD700]/25 focus:border-[#FFD700] focus:outline-none px-3 py-2 text-sm text-white"
                        />
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-emerald-100 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={wVerified}
                        onChange={(e) => setWVerified(e.target.checked)}
                        className="rounded accent-[#FFD700] w-4 h-4"
                      />
                      <span>Mark as Verified Public Result Record</span>
                    </label>
                  </div>

                  {winnerFormError && (
                    <div className="rounded-xl bg-red-950/60 border border-red-400/50 px-4 py-2.5 text-sm text-red-200">
                      {winnerFormError}
                    </div>
                  )}

                  {winnerFormSuccess && (
                    <div className="rounded-xl bg-emerald-950/70 border border-emerald-400/50 px-4 py-2.5 text-sm text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#FFD700] shrink-0" />
                      <span>{winnerFormSuccess}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={winnerSaving}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-extrabold text-sm sm:text-base px-6 py-3 shadow-lg transition-all cursor-pointer"
                    >
                      {winnerSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>{editingWinnerId ? 'Update Winner Record' : 'Save & Publish Record'}</span>
                    </button>

                    {editingWinnerId && (
                      <button
                        type="button"
                        onClick={resetWinnerForm}
                        className="rounded-xl border border-[#FFD700]/35 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-[#135220] cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right: Live Instant Preview */}
              <div className="xl:col-span-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FFD700]">
                    Live Result Preview
                  </span>
                  <div className="inline-flex rounded-lg bg-[#084D17] p-1 border border-[#FFD700]/25">
                    <button
                      type="button"
                      onClick={() => setLivePreviewMode('card')}
                      className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                        livePreviewMode === 'card'
                          ? 'bg-[#FFD700] text-[#05330E]'
                          : 'text-emerald-100 hover:text-[#FFD700]'
                      }`}
                    >
                      Result Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setLivePreviewMode('certificate')}
                      className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                        livePreviewMode === 'certificate'
                          ? 'bg-[#FFD700] text-[#05330E]'
                          : 'text-emerald-100 hover:text-[#FFD700]'
                      }`}
                    >
                      Certificate
                    </button>
                  </div>
                </div>

                {livePreviewMode === 'card' ? (
                  <WinningResultCard winner={previewRecord} showFullMobile />
                ) : (
                  <CertificateCard winner={previewRecord} />
                )}
              </div>
            </div>

            {/* Stored Winner Records List */}
            <div className="rounded-2xl bg-[#094C17] border border-[#FFD700]/30 p-5 sm:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#FFD700]">
                    Published Winner Records
                  </h3>
                  <p className="text-xs text-emerald-200/75">
                    All records stored here are immediately searchable in the public Mobile Number Result Checker.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-[#FFD700] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={winnerSearch}
                    onChange={(e) => setWinnerSearch(e.target.value)}
                    placeholder="Search name, mobile, ticket..."
                    className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-emerald-200/50"
                  />
                </div>
              </div>

              {winnersLoading ? (
                <div className="py-10 text-center text-emerald-100">Loading records...</div>
              ) : winners.length === 0 ? (
                <div className="py-10 text-center rounded-xl bg-[#063A10] border border-[#FFD700]/15">
                  <p className="text-sm text-emerald-100/80">
                    No winner records found. Use the form above to add your first verified winner.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="border-b border-[#FFD700]/25 text-[11px] uppercase tracking-wider text-[#FFD700]">
                        <th className="py-3 px-3">Winner</th>
                        <th className="py-3 px-3">Mobile</th>
                        <th className="py-3 px-3">Ticket No.</th>
                        <th className="py-3 px-3">Lottery &amp; Position</th>
                        <th className="py-3 px-3 text-right">Amount</th>
                        <th className="py-3 px-3">Draw Date</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FFD700]/15 text-sm">
                      {winners.map((w) => (
                        <tr key={w.id} className="hover:bg-[#0D5C1E]/60 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {w.winner_name}
                            <div className="font-mono-code text-[11px] text-emerald-200/70">
                              {w.certificate_ref}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono-code text-emerald-100">
                            {w.mobile_number}
                          </td>
                          <td className="py-3 px-3 font-mono-code font-bold text-[#FFD700]">
                            {w.ticket_number}
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-white font-medium">{w.lottery_name}</div>
                            <div className="text-xs text-[#FFD700]">{w.prize_position}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-code font-bold text-[#FFD700]">
                            {w.winning_amount_formatted}
                          </td>
                          <td className="py-3 px-3 font-mono-code text-xs text-emerald-100">
                            {w.draw_date}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewWinnerModal(w)}
                                title="View Certificate"
                                className="p-2 rounded-lg bg-[#135220] hover:bg-[#196A2A] text-[#FFD700] cursor-pointer"
                              >
                                <Award className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadWinnerCertificatePNG(w)}
                                title="Download PNG"
                                className="p-2 rounded-lg bg-[#135220] hover:bg-[#196A2A] text-emerald-200 cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditWinner(w)}
                                title="Edit Record"
                                className="p-2 rounded-lg bg-[#135220] hover:bg-[#196A2A] text-white cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {deleteConfirmId === w.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWinner(w.id)}
                                    className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-1 rounded bg-[#135220] text-emerald-100 text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(w.id)}
                                  title="Delete Record"
                                  className="p-2 rounded-lg bg-[#135220] hover:bg-red-900/70 text-red-300 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TODAY'S PRIZE CATEGORIES */}
        {activeTab === 'prizes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-2xl bg-[#094C17] border border-[#FFD700]/35 p-5 sm:p-6">
              <h2 className="font-display text-xl font-bold text-[#FFD700] mb-1">
                {editingPrizeId ? 'Update Prize Tier' : 'Add Prize Tier'}
              </h2>
              <p className="text-xs text-emerald-100/80 mb-4">
                Update Today&apos;s Lottery Results cards shown on the homepage.
              </p>

              <form onSubmit={handleSavePrize} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1">
                      Prize Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      placeholder="e.g. 1st Prize"
                      className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1">
                      Tier Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={pSortOrder}
                      onChange={(e) => setPSortOrder(e.target.value)}
                      className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm font-mono-code text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100 mb-1">
                    Prize Amount *
                  </label>
                  <input
                    type="text"
                    required
                    value={pAmount}
                    onChange={(e) => setPAmount(e.target.value)}
                    placeholder="e.g. ₹ 80,00,000"
                    className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm font-mono-code text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1">
                      Lottery Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={pLottery}
                      onChange={(e) => setPLottery(e.target.value)}
                      placeholder="e.g. Karunya Plus"
                      className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1">
                      Draw Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={pDate}
                      onChange={(e) => setPDate(e.target.value)}
                      className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm font-mono-code text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100 mb-1">
                    Winning Ticket Numbers (comma separated)
                  </label>
                  <textarea
                    rows={3}
                    value={pTicketsText}
                    onChange={(e) => setPTicketsText(e.target.value)}
                    placeholder="e.g. KP123456, KP789012"
                    className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm font-mono-code text-white"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-emerald-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pIsSample}
                    onChange={(e) => setPIsSample(e.target.checked)}
                    className="rounded accent-[#FFD700] w-4 h-4"
                  />
                  <span>Keep marked as Sample Data (uncheck for Verified Results)</span>
                </label>

                {prizeFormMsg && (
                  <div className="rounded-lg bg-[#05350E] border border-[#FFD700]/40 px-3 py-2 text-xs text-[#FFD700]">
                    {prizeFormMsg}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={prizeSaving}
                    className="rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-bold text-sm px-5 py-2.5 cursor-pointer"
                  >
                    {prizeSaving ? 'Saving...' : editingPrizeId ? 'Update Prize Tier' : 'Add Prize Tier'}
                  </button>
                  {editingPrizeId && (
                    <button
                      type="button"
                      onClick={resetPrizeForm}
                      className="rounded-xl border border-[#FFD700]/35 px-4 py-2.5 text-sm text-emerald-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {prizesLoading ? (
                <div className="p-8 text-center text-emerald-100">Loading prize categories...</div>
              ) : (
                prizes.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl bg-[#094C17] border border-[#FFD700]/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-display text-lg font-bold text-[#FFD700]">
                          {p.prize_name}
                        </span>
                        <span className="font-mono-code text-base font-bold text-white">
                          {p.prize_amount}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            p.is_sample === 1
                              ? 'bg-amber-400/15 text-amber-200'
                              : 'bg-emerald-400/15 text-emerald-200'
                          }`}
                        >
                          {p.is_sample === 1 ? 'Sample' : 'Verified'}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-200/80 mt-1">
                        {p.lottery_name} · {p.draw_date}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.winning_tickets.map((t, idx) => {
                          const isHighlighted =
                            Boolean(p.highlighted_ticket) &&
                            p.highlighted_ticket!.trim().toUpperCase() === t.trim().toUpperCase();
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleToggleHighlightTicket(p.id, t)}
                              title="Click to toggle golden glow on public Today's Results"
                              className={`font-mono-code text-xs px-2.5 py-1 rounded transition-all cursor-pointer ${
                                isHighlighted
                                  ? 'bg-[#FFD700] text-[#05330E] font-extrabold border border-[#FFF3A1] shadow-[0_0_16px_rgba(255,215,0,0.85)]'
                                  : 'bg-[#135220] hover:bg-[#196A2A] border border-[#FFD700]/25 text-white'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 text-[11px] text-emerald-200/65">
                        Click any ticket badge above to toggle golden glow on Today&apos;s Results
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditPrize(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#135220] hover:bg-[#196A2A] text-white px-3 py-2 text-xs font-semibold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePrize(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#135220] hover:bg-red-900/70 text-red-300 px-3 py-2 text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="rounded-2xl bg-[#094C17] border border-[#FFD700]/30 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#FFD700]">
                  Booked Appointments
                </h2>
                <p className="text-xs text-emerald-100/75">
                  Bookings submitted from the portal are saved locally and synced to Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchAdminData(winnerSearch)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFD700]/35 bg-[#063A10] hover:bg-[#0B5A1B] px-3 py-1.5 text-xs font-semibold text-[#FFD700] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {appointmentsLoading ? (
              <div className="py-8 text-center text-sm text-emerald-100">
                Loading appointments...
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-[#063A10] border border-[#FFD700]/15 text-sm text-emerald-100/80">
                No appointments booked yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#FFD700]/25 text-[11px] uppercase tracking-wider text-[#FFD700]">
                      <th className="py-2.5 px-3">Ref</th>
                      <th className="py-2.5 px-3">Name &amp; Contact</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Purpose &amp; Notes</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FFD700]/15 text-sm">
                    {appointments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-[#0D5C1E]/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono-code text-xs text-[#FFD700]">
                          #KLR-APT-{apt.id}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-white">{apt.full_name}</div>
                          <div className="font-mono-code text-xs text-emerald-100/85">
                            {apt.mobile_number}
                          </div>
                          {apt.email && (
                            <div className="text-xs text-emerald-200/70">{apt.email}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-code text-xs text-emerald-100">
                          {apt.appointment_date}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="text-xs font-semibold text-[#FFD700]">
                            {apt.purpose}
                          </div>
                          {apt.notes && (
                            <div className="text-xs text-emerald-100/80 mt-0.5 line-clamp-2">
                              {apt.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            aria-label={`Status for ${apt.full_name}`}
                            value={apt.status}
                            onChange={(e) =>
                              handleUpdateAppointmentStatus(apt.id, e.target.value)
                            }
                            className="rounded-lg bg-[#135220] border border-[#FFD700]/30 px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAppointment(apt.id)}
                            title="Delete appointment"
                            className="p-1.5 rounded-lg bg-[#135220] hover:bg-red-900/70 text-red-300 cursor-pointer"
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
          </div>
        )}

        {/* TAB 4: SUPABASE CLOUD SYNC */}
        {activeTab === 'supabase' && (
          <div className="max-w-3xl space-y-4">
            <div className="rounded-2xl bg-[#094C17] border border-[#FFD700]/35 p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#FFD700]">
                    Supabase Database Sync
                  </h2>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    Connected project:{' '}
                    <span className="font-mono-code text-white">
                      {supabaseStatus?.projectUrl || 'Not configured'}
                    </span>
                  </p>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                    supabaseStatus?.connected
                      ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-200'
                      : 'bg-amber-950/60 border-amber-400/50 text-amber-200'
                  }`}
                >
                  {supabaseLoading
                    ? 'Checking...'
                    : supabaseStatus?.connected
                    ? 'Tables Ready & Connected'
                    : 'Setup Required in Supabase'}
                </span>
              </div>

              {supabaseStatus && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      ['winner_records', supabaseStatus.tables.winner_records],
                      ['prize_categories', supabaseStatus.tables.prize_categories],
                      ['appointments', supabaseStatus.tables.appointments],
                    ] as const
                  ).map(([tableName, ready]) => (
                    <div
                      key={tableName}
                      className="rounded-xl bg-[#05350E] border border-[#FFD700]/20 px-3.5 py-2.5 flex items-center justify-between"
                    >
                      <span className="font-mono-code text-xs text-white">{tableName}</span>
                      <span
                        className={`text-[11px] font-bold ${
                          ready ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {ready ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {supabaseStatus?.lastError && !supabaseStatus.connected && (
                <div className="rounded-xl bg-amber-950/50 border border-amber-400/40 px-3.5 py-2.5 text-xs text-amber-100">
                  {supabaseStatus.lastError}
                </div>
              )}

              {supabaseSyncMsg && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs border ${
                    supabaseSyncMsg.type === 'ok'
                      ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-200'
                      : 'bg-red-950/70 border-red-400/50 text-red-200'
                  }`}
                >
                  {supabaseSyncMsg.text}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={supabaseSyncing}
                  onClick={handleSyncSupabase}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] disabled:opacity-70 text-[#05330E] font-bold text-xs sm:text-sm px-4 py-2.5 cursor-pointer"
                >
                  {supabaseSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>{supabaseSyncing ? 'Syncing...' : 'Sync All Data to Supabase'}</span>
                </button>

                <button
                  type="button"
                  disabled={supabaseLoading}
                  onClick={handleRefreshSupabaseStatus}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFD700]/35 hover:bg-[#135220] text-emerald-100 text-xs sm:text-sm font-semibold px-4 py-2.5 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${supabaseLoading ? 'animate-spin' : ''}`} />
                  <span>Check Tables</span>
                </button>
              </div>
            </div>

            {supabaseStatus?.sqlSchema && (
              <div className="rounded-2xl bg-[#094C17] border border-[#FFD700]/30 p-5 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#FFD700]">
                      One-Time Supabase Table Setup SQL
                    </h3>
                    <p className="text-xs text-emerald-100/80">
                      Open Supabase Dashboard → SQL Editor → paste this SQL and click Run, then
                      click &ldquo;Sync All Data to Supabase&rdquo; above.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#05350E] hover:bg-[#135220] border border-[#FFD700]/40 px-3 py-1.5 text-xs font-bold text-[#FFD700] cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copied SQL' : 'Copy SQL Script'}</span>
                  </button>
                </div>

                <pre className="rounded-xl bg-[#032309] border border-[#FFD700]/20 p-3.5 text-[11px] font-mono-code text-emerald-100 overflow-x-auto max-h-56 leading-relaxed">
                  {supabaseStatus.sqlSchema}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN SECURITY */}
        {activeTab === 'security' && (
          <div className="max-w-md rounded-2xl bg-[#094C17] border border-[#FFD700]/35 p-6">
            <h2 className="font-display text-xl font-bold text-[#FFD700] mb-1">
              Update Admin Password
            </h2>
            <p className="text-xs text-emerald-100/80 mb-5">
              Passwords are hashed with salted scrypt on the server and never exposed in client code.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-100 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={curPassword}
                  onChange={(e) => setCurPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-100 mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              {secMessage && (
                <div
                  className={`rounded-lg px-3.5 py-2.5 text-xs ${
                    secMessage.type === 'ok'
                      ? 'bg-emerald-950/70 border border-emerald-400/50 text-emerald-200'
                      : 'bg-red-950/70 border border-red-400/50 text-red-200'
                  }`}
                >
                  {secMessage.text}
                </div>
              )}

              <button
                type="submit"
                className="rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-bold text-sm px-5 py-2.5 cursor-pointer"
              >
                Change Password
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Modal Preview for Any Existing Winner Certificate */}
      {previewWinnerModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto p-4 flex items-center justify-center"
          onClick={() => setPreviewWinnerModal(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-[#064213] border border-[#FFD700]/50 p-5 sm:p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-[#FFD700]">
                Certificate Preview · {previewWinnerModal.winner_name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewWinnerModal(null)}
                className="p-1.5 rounded-lg text-emerald-100 hover:bg-[#0B5A1B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CertificateCard winner={previewWinnerModal} />
          </div>
        </div>
      )}
    </div>
  );
}
