import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronUp,
  FileCheck2,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Menu,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  X,
} from 'lucide-react';
import keralaLotteryManImg from '../assets/images/kerala_lottery_man_tickets_1794759001172.jpg';
import type { PrizeCategory, WinnerRecord } from '../types';
import { normalizeIndianMobileClient } from '../utils/lotteryHelpers';
import { CertificateCard } from './CertificateCard';
import { CoconutPalmHeroIllustration, KeralaPortalEmblem } from './KeralaArtwork';
import { WinningResultCard } from './WinningResultCard';

interface PublicPortalProps {
  onNavigateAdmin: () => void;
}

type InfoModalType = 'contact' | 'appointment' | 'privacy' | 'terms' | 'responsible' | null;

const KERALA_SERIES_GALLERY = [
  {
    name: 'Win-Win',
    schedule: 'Monday Draw · Weekly Series',
    code: 'WW',
    summary: 'Weekly draw schedule overview with 1st through 8th prize tiers and consolation structure.',
  },
  {
    name: 'Sthree Sakthi',
    schedule: 'Tuesday Draw · Weekly Series',
    code: 'SS',
    summary: 'Tuesday weekly series supporting structured prize tier lookup and ticket verification.',
  },
  {
    name: 'Fifty-Fifty',
    schedule: 'Wednesday Draw · Weekly Series',
    code: 'FF',
    summary: 'Mid-week draw series featuring multi-tier ticket prize distributions and archive records.',
  },
  {
    name: 'Karunya Plus',
    schedule: 'Thursday Draw · Weekly Series',
    code: 'KN',
    summary: 'Thursday weekly series indexed with clear prize amounts and draw date tracking.',
  },
  {
    name: 'Nirmal',
    schedule: 'Friday Draw · Weekly Series',
    code: 'NR',
    summary: 'Friday weekly draw schedule with instant mobile-number lookup support for registered records.',
  },
  {
    name: 'Karunya & Akshaya',
    schedule: 'Weekend Draws · Saturday & Sunday',
    code: 'KR / AK',
    summary: 'Weekend draw schedules formatted for easy mobile readability and PNG certificate generation.',
  },
];

export function PublicPortal({ onNavigateAdmin }: PublicPortalProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(true);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Result Checker state
  const [mobileInput, setMobileInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [matchedResults, setMatchedResults] = useState<WinnerRecord[]>([]);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTicketGlow, setSelectedTicketGlow] = useState<string | null>(null);

  // Footer Modal & Appointment Form
  const [activeModal, setActiveModal] = useState<InfoModalType>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [aptName, setAptName] = useState('');
  const [aptMobile, setAptMobile] = useState('');
  const [aptEmail, setAptEmail] = useState('');
  const [aptDate, setAptDate] = useState(todayDateStr);
  const [aptPurpose, setAptPurpose] = useState('Result Verification Inquiry');
  const [aptNotes, setAptNotes] = useState('');
  const [aptSubmitting, setAptSubmitting] = useState(false);
  const [aptError, setAptError] = useState<string | null>(null);
  const [aptSuccess, setAptSuccess] = useState<{ id: number; syncedToSupabase: boolean } | null>(null);

  const checkerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 420);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPublicData() {
      try {
        const prizesRes = await fetch('/api/public/prizes');
        if (!active) return;
        if (prizesRes.ok) {
          const p = (await prizesRes.json()) as { prizes: PrizeCategory[] };
          setPrizes(p.prizes || []);
        }
      } catch {
        // Ignore transient load error
      } finally {
        if (active) setPrizesLoading(false);
      }
    }
    loadPublicData();
    return () => {
      active = false;
    };
  }, []);

  const scrollToChecker = () => {
    setMobileMenuOpen(false);
    const el = document.getElementById('result-checker');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        checkerInputRef.current?.focus({ preventScroll: true });
      }, 450);
    }
  };

  const handleCheckResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError(null);
    setMatchedResults([]);
    setSelectedMatchIdx(0);

    const normalized = normalizeIndianMobileClient(mobileInput);
    if (!normalized) {
      setHasSearched(true);
      setCheckError(
        'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).'
      );
      return;
    }

    setChecking(true);
    setHasSearched(true);
    try {
      const [res] = await Promise.all([
        fetch(`/api/public/check-result?mobile=${encodeURIComponent(normalized)}`),
        new Promise((resolve) => setTimeout(resolve, 480)),
      ]);
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || 'Unable to verify mobile number right now.');
        return;
      }
      if (!data.found || !data.result) {
        setCheckError(
          data.message || 'No verified winning record found for this mobile number.'
        );
        return;
      }
      const list: WinnerRecord[] = data.allMatches || [data.result];
      setMatchedResults(list);
      setSelectedTicketGlow(list[0]?.ticket_number?.toUpperCase() || null);
      // Refresh prizes so any newly synced winner ticket appears & glows immediately
      try {
        const pRes = await fetch('/api/public/prizes');
        if (pRes.ok) {
          const pd = (await pRes.json()) as { prizes: PrizeCategory[] };
          setPrizes(pd.prizes || []);
        }
      } catch {
        // Ignore refresh error
      }
    } catch {
      setCheckError('Network error while checking database. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleResetChecker = () => {
    setMobileInput('');
    setCheckError(null);
    setMatchedResults([]);
    setSelectedTicketGlow(null);
    setHasSearched(false);
    checkerInputRef.current?.focus();
  };

  const openAppointmentModal = () => {
    setAptError(null);
    setAptSuccess(null);
    setActiveModal('appointment');
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAptError(null);

    if (aptName.trim().length < 2) {
      setAptError('Please enter your full name.');
      return;
    }

    const normalized = normalizeIndianMobileClient(aptMobile);
    if (!normalized) {
      setAptError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setAptSubmitting(true);
    try {
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: aptName.trim(),
          mobile_number: normalized,
          email: aptEmail.trim(),
          appointment_date: aptDate || todayDateStr,
          purpose: aptPurpose,
          notes: aptNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAptError(data.error || 'Could not submit booking request. Please try again.');
        return;
      }
      setAptSuccess({
        id: data.appointment?.id || 0,
        syncedToSupabase: Boolean(data.syncedToSupabase),
      });
      setAptName('');
      setAptMobile('');
      setAptEmail('');
      setAptNotes('');
    } catch {
      setAptError('Network error while submitting booking. Please try again.');
    } finally {
      setAptSubmitting(false);
    }
  };

  const activeWinner = matchedResults[selectedMatchIdx] || null;
  const hasSamplePrizes = prizes.some((p) => p.is_sample === 1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#064B16] via-[#053E12] to-[#032A0C] text-white flex flex-col">
      {/* Top Thin Golden Announcement Bar */}
      <div className="bg-[#FFD700] text-[#05330E] h-7 overflow-hidden flex items-center border-b border-[#ca8a04]">
        <div className="animate-marquee whitespace-nowrap text-xs font-bold tracking-wide">
          <span className="mx-8">
            Independent Kerala Lottery Result Information Website · Not Affiliated With Kerala Government · Check Verified Records &amp; Prize Tiers · Always Verify Results Through Official Sources · Play Responsibly
          </span>
          <span className="mx-8" aria-hidden="true">
            Independent Kerala Lottery Result Information Website · Not Affiliated With Kerala Government · Check Verified Records &amp; Prize Tiers · Always Verify Results Through Official Sources · Play Responsibly
          </span>
        </div>
      </div>

      {/* Sticky 3-Zone Header */}
      <header className="sticky top-0 z-40 bg-[#04380F]/95 backdrop-blur-md border-b border-[#FFD700]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#home"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] rounded-lg"
          >
            <KeralaPortalEmblem className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#FFD700] whitespace-nowrap shrink-0">
              KERALA LOTTERY RESULT
            </span>
          </a>

          {/* Zone 2: Desktop Nav Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-emerald-50/90"
          >
            {[
              ['Home', '#home'],
              ['Results', '#todays-results'],
              ['About', '#about'],
              ['Services', '#services'],
              ['Gallery', '#gallery'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="hover:text-[#FFD700] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[#FFD700]"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Primary CTA + Mobile Menu Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={scrollToChecker}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-bold text-xs sm:text-sm px-3.5 sm:px-5 py-2 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Check Result</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#0A581B] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Hamburger Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#FFD700]/20 bg-[#04330D] px-4 py-4">
            <nav className="flex flex-col gap-1">
              {[
                ['Home', '#home'],
                ['Results', '#todays-results'],
                ['About', '#about'],
                ['Services', '#services'],
                ['Gallery', '#gallery'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-base font-medium text-emerald-50 hover:bg-[#0A581B] hover:text-[#FFD700] transition-colors"
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateAdmin();
                }}
                className="mt-2 px-3 py-1.5 rounded-lg text-left text-xs text-emerald-200/65 hover:text-[#FFD700] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                <span>Admin</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section id="home" className="relative py-10 sm:py-16 px-4 sm:px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#FFD700] mb-3">
                <span>Independent Information Portal</span>
                <span aria-hidden="true">·</span>
                <span>Kerala Lottery Series</span>
                <span aria-hidden="true">·</span>
                <span>Instant Mobile Lookup</span>
              </div>

              <h1
                className="font-display font-bold text-white leading-[1.12] tracking-tight"
                style={{ fontSize: 'clamp(2rem, 4.2vw, 3.5rem)', textWrap: 'balance' }}
              >
                WELCOME TO <span className="text-[#FFD700]">KERALA LOTTERY RESULT</span>
              </h1>

              <p className="mt-4 text-base sm:text-xl text-emerald-100/90 max-w-2xl leading-relaxed">
                Check Kerala Lottery Results Easily and View Your Ticket Information
              </p>

              <p className="mt-3 text-sm text-emerald-200/75 max-w-xl leading-relaxed">
                Browse daily prize breakdowns, search verified winner records using your registered
                mobile number, and download your informational winner certificate as a high-resolution PNG.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={scrollToChecker}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] active:scale-[0.99] text-[#05330E] font-extrabold text-base px-7 py-3.5 shadow-xl shadow-black/25 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Search className="w-5 h-5" />
                  <span>Check Result</span>
                </button>

                <a
                  href="#todays-results"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#FFD700]/40 hover:border-[#FFD700] bg-[#084D17]/60 hover:bg-[#0A5A1B] text-[#FFD700] font-semibold text-sm sm:text-base px-5 py-3.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trophy className="w-4 h-4" />
                  <span>View Today&apos;s Prizes</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <CoconutPalmHeroIllustration />
            </div>
          </div>
        </section>

        <div className="kasavu-divider max-w-6xl mx-auto" />

        {/* Mobile Number Result Checker Section (Matching Reference Screenshot Core!) */}
        <section id="result-checker" className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FFD700] mb-2">
                Result Checker
              </p>
              <h2
                className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                CHECK YOUR <span className="text-[#FFD700]">WINNING RESULT</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-emerald-100/85 max-w-xl mx-auto">
                Enter your registered mobile number to check your lottery result information.
              </p>
              <div className="w-12 h-1 bg-[#FFD700] rounded-full mx-auto mt-4" />
            </div>

            {/* Checker Container Card */}
            <div className="rounded-2xl bg-[#094C17] border border-[#FFD700]/30 p-5 sm:p-8 shadow-2xl">
              <div className="text-center mb-5">
                <h3 className="text-base sm:text-lg font-bold tracking-wider uppercase text-[#FFD700]">
                  Enter Your Mobile Number
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/75 mt-1">
                  Search verified records stored in our database and view your ticket details
                </p>
              </div>

              <form onSubmit={handleCheckResult} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-[#FFD700] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={checkerInputRef}
                    type="tel"
                    inputMode="numeric"
                    maxLength={14}
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value)}
                    placeholder="Enter Your Mobile Number"
                    aria-label="Enter Your Mobile Number"
                    className="w-full rounded-xl bg-[#1A5826] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none focus:ring-2 focus:ring-[#FFD700]/30 pl-11 pr-4 py-3.5 text-base font-mono-code text-white placeholder:text-emerald-200/50 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={checking}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] disabled:opacity-70 text-[#05330E] font-extrabold text-base px-6 py-3.5 shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[48px]"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Check Result</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-3 text-center text-xs text-emerald-200/70 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFD700] shrink-0" />
                <span>
                  Mobile-only lookup · We never ask for bank accounts, OTPs, or payment details
                </span>
              </p>

              {/* Loading Animation */}
              {checking && (
                <div className="mt-8 py-10 flex flex-col items-center justify-center text-center border-t border-[#FFD700]/15">
                  <div className="w-14 h-14 rounded-full border-4 border-[#FFD700]/25 border-t-[#FFD700] animate-spin mb-4" />
                  <p className="text-base font-semibold text-[#FFD700]">
                    Searching verified lottery records...
                  </p>
                  <p className="text-xs text-emerald-100/70 mt-1">
                    Checking Indian mobile number against portal database
                  </p>
                </div>
              )}

              {/* Error / No Match State */}
              {!checking && hasSearched && checkError && (
                <div className="mt-6 rounded-xl bg-[#05360F] border border-amber-400/40 p-5 text-center">
                  <AlertCircle className="w-9 h-9 text-[#FFD700] mx-auto mb-2.5" />
                  <h4 className="text-base sm:text-lg font-bold text-white">No Matching Result</h4>
                  <p className="text-sm text-emerald-100/85 mt-1 max-w-md mx-auto">
                    {checkError}
                  </p>
                  <button
                    type="button"
                    onClick={handleResetChecker}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FFD700]/15 hover:bg-[#FFD700]/25 border border-[#FFD700]/40 text-[#FFD700] text-sm font-semibold px-4 py-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Check Again</span>
                  </button>
                </div>
              )}

              {/* Matched Winning Result Card + Certificate */}
              {!checking && activeWinner && (
                <div className="mt-7 pt-6 border-t border-[#FFD700]/20">
                  {matchedResults.length > 1 && (
                    <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                      <span className="text-xs text-emerald-100/80 mr-1">
                        Multiple records found ({matchedResults.length}):
                      </span>
                      {matchedResults.map((m, idx) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedMatchIdx(idx);
                            setSelectedTicketGlow(m.ticket_number.toUpperCase());
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-semibold transition-colors cursor-pointer ${
                            idx === selectedMatchIdx
                              ? 'bg-[#FFD700] text-[#05330E]'
                              : 'bg-[#135220] text-emerald-100 hover:bg-[#196629]'
                          }`}
                        >
                          {m.ticket_number} ({m.draw_date})
                        </button>
                      ))}
                    </div>
                  )}

                  <WinningResultCard winner={activeWinner} />

                  <div className="mt-4 flex justify-center">
                    <a
                      href="#todays-results"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700]/15 hover:bg-[#FFD700]/25 border border-[#FFD700]/50 text-[#FFD700] text-xs sm:text-sm font-bold px-4 py-2.5 transition-colors"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>
                        View Glowing Ticket ({activeWinner.ticket_number}) in {activeWinner.prize_position}
                      </span>
                    </a>
                  </div>

                  <CertificateCard winner={activeWinner} />

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={handleResetChecker}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#FFD700]/35 hover:border-[#FFD700] bg-[#064112] hover:bg-[#0B5A1B] text-emerald-100 text-sm font-semibold px-4 py-2.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-[#FFD700]" />
                      <span>Check Another Mobile Number</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="kasavu-divider max-w-6xl mx-auto" />

        {/* Today's Lottery Results Section */}
        <section id="todays-results" className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2
                className="font-display text-3xl sm:text-4xl font-bold text-[#FFD700] tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                🏆 TODAY&apos;S LOTTERY RESULTS
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-emerald-100/85 max-w-2xl mx-auto">
                Prize tier breakdown and ticket number listings managed by the portal administrator.
              </p>

              {hasSamplePrizes && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#05350E] border border-[#FFD700]/35 px-4 py-2 text-xs sm:text-sm text-amber-200">
                  <Sparkles className="w-4 h-4 text-[#FFD700] shrink-0" />
                  <span>
                    Entries labeled <strong>Sample Data</strong> are structural templates until verified draw results are entered by the administrator.
                  </span>
                </div>
              )}
            </div>

            {prizesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-2xl bg-[#094C17]/70 border border-[#FFD700]/15 animate-pulse"
                  />
                ))}
              </div>
            ) : prizes.length === 0 ? (
              <div className="rounded-2xl bg-[#094C17] border border-[#FFD700]/25 p-8 text-center">
                <p className="text-emerald-100">No prize categories published yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {prizes.map((prize) => {
                  const activeGlowUpper =
                    selectedTicketGlow ||
                    (prize.highlighted_ticket ? prize.highlighted_ticket.toUpperCase() : null);
                  const tierMatchesActiveWinner =
                    !activeWinner ||
                    activeWinner.prize_position.trim().toLowerCase() ===
                      prize.prize_name.trim().toLowerCase() ||
                    prize.winning_tickets.some(
                      (t) => t.trim().toUpperCase() === activeWinner.ticket_number.trim().toUpperCase()
                    );

                  return (
                    <article
                      key={prize.id}
                      className="rounded-2xl bg-[#0A5319] border border-[#FFD700]/30 hover:border-[#FFD700]/65 p-4 sm:p-6 shadow-lg transition-colors"
                    >
                      {/* Top Header Row matching screenshot: Prize Title left, Prize Amount right */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-[#FFD700]/15">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-display text-lg sm:text-xl font-bold text-[#FFD700]">
                            {prize.prize_name}
                          </h3>
                          <span className="text-xs text-emerald-200/80">
                            {prize.lottery_name} · <span className="font-mono-code">{prize.draw_date}</span>
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                              prize.is_sample === 1
                                ? 'bg-amber-400/15 text-amber-200 border border-amber-300/30'
                                : 'bg-emerald-400/15 text-emerald-200 border border-emerald-300/30'
                            }`}
                          >
                            {prize.is_sample === 1 ? 'Sample Data' : 'Verified'}
                          </span>
                        </div>

                        <div className="font-mono-code text-base sm:text-xl font-extrabold text-emerald-50 tabular-nums">
                          {prize.prize_amount}
                        </div>
                      </div>

                      {/* Winning Ticket Numbers Grid with Golden Glow on Match / Selection */}
                      <div className="flex flex-wrap gap-2">
                        {prize.winning_tickets.length > 0 ? (
                          prize.winning_tickets.map((ticket, i) => {
                            const upper = ticket.trim().toUpperCase();
                            const isGlowing =
                              Boolean(activeGlowUpper) &&
                              upper === activeGlowUpper &&
                              (selectedTicketGlow ? tierMatchesActiveWinner || !activeWinner : true);

                            return (
                              <button
                                key={`${prize.id}-${i}`}
                                type="button"
                                onClick={() =>
                                  setSelectedTicketGlow((prev) => (prev === upper ? null : upper))
                                }
                                title="Click to highlight ticket number"
                                className={`font-mono-code text-xs sm:text-sm px-3.5 py-2 rounded-lg tracking-wider transition-all cursor-pointer ${
                                  isGlowing
                                    ? 'bg-[#FFD700] text-[#05330E] font-extrabold border-2 border-[#FFF3A1] shadow-[0_0_22px_rgba(255,215,0,0.9)] scale-[1.03]'
                                    : 'bg-[#145C22] hover:bg-[#196B29] border border-[#FFD700]/25 text-emerald-50 font-semibold'
                                }`}
                              >
                                {ticket}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-xs text-emerald-200/70">
                            Pending ticket entry
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="kasavu-divider max-w-6xl mx-auto" />

        {/* About & Services Sections */}
        <section id="about" className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 rounded-2xl bg-[#094C17] border border-[#FFD700]/30 p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700] mb-2">
                About Our Portal
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Independent Kerala Lottery Information Hub
              </h2>
              <p className="mt-4 text-sm sm:text-base text-emerald-100/85 leading-relaxed">
                Kerala Lottery Result is an independent lottery-result information portal designed
                for fast, mobile-friendly access to prize structures, draw dates, and registered
                ticket verification lookups.
              </p>
              <p className="mt-3 text-sm text-emerald-100/80 leading-relaxed">
                We are not affiliated with, endorsed by, or connected to the Government of Kerala or
                the Kerala State Lotteries Department. Always confirm official winning tickets with
                authorized government lottery offices or gazettes.
              </p>
            </div>

            <div id="services" className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Search,
                  title: '01. Mobile Number Lookup',
                  desc: 'Query our server-side database with your 10-digit Indian mobile number to inspect matching winner records.',
                },
                {
                  icon: Trophy,
                  title: '02. Prize Tier Breakdown',
                  desc: 'Clear 1st through 6th and consolation prize structures with draw dates and ticket number badges.',
                },
                {
                  icon: FileCheck2,
                  title: '03. PNG Winner Certificate',
                  desc: 'Generate and download an informational winner certificate containing your ticket and reference number.',
                },
                {
                  icon: ShieldCheck,
                  title: '04. Safe & Private Checks',
                  desc: 'Masked mobile display on public cards and zero requests for OTPs, passwords, or bank account numbers.',
                },
              ].map((service) => {
                const Icon = service.icon;
                return (
                  <div
                    key={service.title}
                    className="rounded-2xl bg-[#094C17] border border-[#FFD700]/25 p-5 sm:p-6"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/35 flex items-center justify-center mb-3.5">
                      <Icon className="w-5 h-5 text-[#FFD700]" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white">{service.title}</h3>
                    <p className="mt-1.5 text-sm text-emerald-100/80 leading-relaxed">
                      {service.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="kasavu-divider max-w-6xl mx-auto" />

        {/* Gallery / Kerala Lottery Series Guide */}
        <section id="gallery" className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700] mb-2">
                Kerala Draw Showcase
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                Weekly Kerala <span className="text-[#FFD700]">Lottery Series</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {KERALA_SERIES_GALLERY.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl bg-[#094C17] border border-[#FFD700]/25 hover:border-[#FFD700]/60 p-5 sm:p-6 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono-code text-sm font-bold text-[#05330E] bg-[#FFD700] px-3 py-1 rounded-lg">
                      {item.code}
                    </span>
                    <Ticket className="w-5 h-5 text-[#FFD700]/75" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">{item.name}</h3>
                  <p className="text-xs font-medium text-[#FFD700] mt-0.5">{item.schedule}</p>
                  <p className="mt-2.5 text-sm text-emerald-100/80 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="kasavu-divider max-w-6xl mx-auto" />

        {/* Bottom Feature Photo: Kerala Lottery Ticket Seller / Holder */}
        <section aria-label="Kerala Lottery Ticket Showcase" className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl bg-[#094C17] border-2 border-[#FFD700]/40 overflow-hidden shadow-2xl">
              <div className="relative aspect-[16/9] w-full bg-[#04360F]">
                {!photoFailed ? (
                  <img
                    src={keralaLotteryManImg}
                    alt="Smiling man in traditional Kerala attire holding colorful Kerala lottery tickets beneath coconut palms"
                    referrerPolicy="no-referrer"
                    onError={() => setPhotoFailed(true)}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#085E1B] to-[#032D0C]">
                    <Ticket className="w-12 h-12 text-[#FFD700] mb-3" />
                    <p className="font-display text-xl font-bold text-white">
                      Kerala Lottery Ticket Information
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#03260B]/90 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-0 inset-x-0 p-5 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]">
                      Kerala Ticket Tradition
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
                      Check Every Kerala Lottery Ticket With Confidence
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-100/85 mt-1.5 max-w-xl">
                      Always purchase physical tickets from authorized retail agents and verify your ticket number above.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToChecker}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-extrabold text-sm px-5 py-3 shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                  >
                    <Search className="w-4 h-4" />
                    <span>Check Result Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#03260B] border-t border-[#FFD700]/25 pt-10 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#FFD700]/15">
            <div className="md:col-span-5">
              <div className="flex items-center gap-2.5 mb-3">
                <KeralaPortalEmblem className="w-8 h-8" />
                <span className="font-display text-lg font-bold text-[#FFD700]">
                  KERALA LOTTERY RESULT
                </span>
              </div>
              <p className="text-sm text-emerald-100/80 leading-relaxed max-w-md">
                About Kerala Lottery Results: Independent informational resource for viewing daily
                lottery prize structures, checking registered winner records by mobile number, and
                downloading informational certificates.
              </p>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFD700] mb-3">
                Information &amp; Policies
              </h4>
              <ul className="space-y-2 text-sm text-emerald-100/85">
                <li>
                  <button
                    type="button"
                    onClick={openAppointmentModal}
                    className="hover:text-[#FFD700] transition-colors cursor-pointer"
                  >
                    Book Appointment
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('contact')}
                    className="hover:text-[#FFD700] transition-colors cursor-pointer"
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('privacy')}
                    className="hover:text-[#FFD700] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('terms')}
                    className="hover:text-[#FFD700] transition-colors cursor-pointer"
                  >
                    Terms and Conditions
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('responsible')}
                    className="hover:text-[#FFD700] transition-colors cursor-pointer"
                  >
                    Responsible Lottery Information
                  </button>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFD700] mb-3">
                Contact &amp; Address
              </h4>
              <div className="space-y-3 text-sm text-emerald-100/85">
                <a
                  href="mailto:support@keralalotteryresult.in"
                  className="flex items-center gap-2.5 hover:text-[#FFD700] transition-colors break-all"
                >
                  <Mail className="w-4 h-4 text-[#FFD700] shrink-0" />
                  <span className="font-mono-code text-xs sm:text-sm">
                    support@keralalotteryresult.in
                  </span>
                </a>
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                  <span>Vikas Bhavan P.O., Thiruvananthapuram, Kerala</span>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={openAppointmentModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-bold text-xs px-4 py-2.5 shadow-md transition-colors cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Book Appointment</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mandatory Disclaimer */}
          <div className="mt-6 rounded-xl bg-[#05350E] border border-[#FFD700]/25 p-4 text-center">
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              &ldquo;This is an independent lottery-result information website and is not affiliated
              with or endorsed by the Kerala Government. Please verify lottery results through
              authorized official sources.&rdquo;
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-emerald-200/60">
            <span>
              © {new Date().getFullYear()} Kerala Lottery Result Information Portal. All rights
              reserved.
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-200/55 hover:text-[#FFD700] transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Admin</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] shadow-xl flex items-center justify-center transition-transform cursor-pointer"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* Footer Info Modal */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#064213] border border-[#FFD700]/50 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-display text-xl font-bold text-[#FFD700]">
                {activeModal === 'contact' && 'Contact Information'}
                {activeModal === 'appointment' && 'Book an Appointment'}
                {activeModal === 'privacy' && 'Privacy Policy'}
                {activeModal === 'terms' && 'Terms and Conditions'}
                {activeModal === 'responsible' && 'Responsible Lottery Information'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-[#0B5A1B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-emerald-100/90 space-y-3 leading-relaxed">
              {activeModal === 'contact' && (
                <>
                  <p>
                    For informational inquiries or corrections to published portal records, reach our
                    support desk:
                  </p>
                  <div className="space-y-2.5 rounded-xl bg-[#04310D] border border-[#FFD700]/25 p-4">
                    <a
                      href="mailto:support@keralalotteryresult.in"
                      className="flex items-center gap-2.5 font-mono-code text-[#FFD700] hover:underline"
                    >
                      <Mail className="w-4 h-4 shrink-0" />
                      <span>support@keralalotteryresult.in</span>
                    </a>
                    <div className="flex items-start gap-2.5 text-emerald-100">
                      <MapPin className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                      <span>Vikas Bhavan P.O., Thiruvananthapuram, Kerala</span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={openAppointmentModal}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] font-bold text-xs sm:text-sm px-4 py-2.5 transition-colors cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book an Appointment</span>
                    </button>
                  </div>
                  <p className="text-xs text-emerald-200/75">
                    Note: This independent portal does not process prize payouts or collect bank
                    details. Official prize claims must be submitted through authorized Kerala
                    State Lottery offices.
                  </p>
                </>
              )}
              {activeModal === 'appointment' && (
                <>
                  {aptSuccess ? (
                    <div className="rounded-xl bg-[#04310D] border border-[#FFD700]/40 p-5 text-center space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-[#FFD700] mx-auto" />
                      <h4 className="font-display text-lg font-bold text-[#FFD700]">
                        Appointment Booked
                      </h4>
                      <p className="text-sm text-emerald-100">
                        Your booking reference{' '}
                        <span className="font-mono-code font-bold text-white">
                          #KLR-APT-{aptSuccess.id}
                        </span>{' '}
                        has been saved to our database.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setAptSuccess(null)}
                          className="rounded-xl border border-[#FFD700]/40 hover:bg-[#0B5A1B] px-4 py-2 text-xs font-semibold text-[#FFD700] cursor-pointer"
                        >
                          Book Another
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModal(null)}
                          className="rounded-xl bg-[#FFD700] hover:bg-[#FACC15] text-[#05330E] px-4 py-2 text-xs font-bold cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleBookAppointment} className="space-y-3">
                      <p className="text-xs text-emerald-200/80">
                        Schedule an informational consultation or ticket inquiry appointment at
                        Vikas Bhavan P.O., Thiruvananthapuram, Kerala.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-emerald-100 mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={aptName}
                            onChange={(e) => setAptName(e.target.value)}
                            placeholder="Your full name"
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
                            value={aptMobile}
                            onChange={(e) => setAptMobile(e.target.value)}
                            placeholder="e.g. 9876543210"
                            className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm font-mono-code text-white placeholder:text-emerald-200/45"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-emerald-100 mb-1">
                            Email (Optional)
                          </label>
                          <input
                            type="email"
                            value={aptEmail}
                            onChange={(e) => setAptEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-emerald-200/45"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-emerald-100 mb-1">
                            Preferred Date *
                          </label>
                          <input
                            type="date"
                            required
                            value={aptDate}
                            onChange={(e) => setAptDate(e.target.value)}
                            className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm font-mono-code text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-emerald-100 mb-1">
                          Purpose
                        </label>
                        <select
                          value={aptPurpose}
                          onChange={(e) => setAptPurpose(e.target.value)}
                          className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2.5 text-sm text-white"
                        >
                          <option value="Result Verification Inquiry">Result Verification Inquiry</option>
                          <option value="Ticket Information Consultation">Ticket Information Consultation</option>
                          <option value="Winner Certificate Assistance">Winner Certificate Assistance</option>
                          <option value="General Appointment">General Appointment</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-emerald-100 mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={aptNotes}
                          onChange={(e) => setAptNotes(e.target.value)}
                          placeholder="Ticket number or inquiry notes (do not share bank details or OTPs)"
                          className="w-full rounded-xl bg-[#135220] border border-[#FFD700]/30 focus:border-[#FFD700] focus:outline-none px-3.5 py-2 text-sm text-white placeholder:text-emerald-200/45"
                        />
                      </div>

                      {aptError && (
                        <div className="rounded-xl bg-red-950/60 border border-red-400/50 px-3.5 py-2 text-xs text-red-200">
                          {aptError}
                        </div>
                      )}

                      <p className="text-[11px] text-emerald-200/70 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#FFD700] shrink-0" />
                        <span>Never share bank accounts, OTPs, or payment details.</span>
                      </p>

                      <button
                        type="submit"
                        disabled={aptSubmitting}
                        className="w-full rounded-xl bg-[#FFD700] hover:bg-[#FACC15] disabled:opacity-70 text-[#05330E] font-extrabold text-sm py-3 shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {aptSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting Booking...</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4" />
                            <span>Confirm Appointment Booking</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </>
              )}
              {activeModal === 'privacy' && (
                <>
                  <p>
                    Mobile numbers entered in the Result Checker are used solely to query matching
                    records in our portal database and are masked on public displays.
                  </p>
                  <p>
                    We never request or store bank account details, credit cards, OTPs, or personal
                    passwords from visitors checking lottery results.
                  </p>
                </>
              )}
              {activeModal === 'terms' && (
                <>
                  <p>
                    This portal is provided strictly for informational reference. While our
                    administrators strive for accuracy, official government gazettes and authorized
                    Kerala State Lottery offices remain the sole authoritative source for prize
                    verification and claims.
                  </p>
                  <p>
                    Informational PNG certificates generated here are personal reference summaries
                    and do not constitute official proof of prize entitlement.
                  </p>
                </>
              )}
              {activeModal === 'responsible' && (
                <>
                  <p>
                    Participate responsibly and strictly within your personal budget. Lotteries are
                    regulated games of chance and should never be viewed as guaranteed income.
                  </p>
                  <p>
                    Underage participation is prohibited. Always purchase physical tickets only from
                    authorized retail agents and verify draw results through official channels.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
