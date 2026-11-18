import React from 'react';
import { Award, Calendar, CheckCircle2, ShieldAlert, Store, Ticket, Trophy } from 'lucide-react';
import type { WinnerRecord } from '../types';

interface WinningResultCardProps {
  winner: WinnerRecord;
  showFullMobile?: boolean;
}

export function WinningResultCard({ winner, showFullMobile = false }: WinningResultCardProps) {
  const displayMobile = showFullMobile && winner.mobile_number ? winner.mobile_number : winner.masked_mobile;

  return (
    <div className="rounded-2xl border-2 border-[#FFD700] bg-gradient-to-b from-[#084D17] to-[#053810] p-5 sm:p-8 shadow-2xl">
      {/* Top Golden Banner */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#FFD700] px-5 py-2 text-[#05330E] font-extrabold text-sm sm:text-base tracking-wide shadow-md">
          <span aria-hidden="true">🎉</span>
          <span>YOU ARE A WINNER!</span>
          <span aria-hidden="true">🎉</span>
        </div>
      </div>

      {/* Celebratory Centerpiece */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/50 flex items-center justify-center mb-3">
          <Trophy className="w-9 h-9 text-[#FFD700]" />
        </div>
        <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-[#FFD700]">
          CONGRATULATIONS!
        </h3>
        <p className="text-xs sm:text-sm text-emerald-100/80 mt-1">
          Verified record matched in Kerala Lottery Result portal database
        </p>
      </div>

      {/* 2-Column Info Tiles matching Reference Screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3.5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/75 mb-1">
            Name
          </div>
          <div className="text-base sm:text-lg font-bold text-white break-words">
            {winner.winner_name}
          </div>
        </div>

        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3.5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/75 mb-1">
            Mobile
          </div>
          <div className="font-mono-code text-base sm:text-lg font-bold text-white tabular-nums">
            {displayMobile}
          </div>
        </div>

        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3.5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/75 mb-1">
            Ticket No.
          </div>
          <div className="font-mono-code text-base sm:text-lg font-bold text-white tracking-wider">
            {winner.ticket_number}
          </div>
        </div>

        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3.5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/75 mb-1">
            Position
          </div>
          <div className="text-base sm:text-lg font-bold text-[#FFD700]">
            {winner.prize_position}
          </div>
        </div>
      </div>

      {/* Full-Width Winning Amount */}
      <div className="rounded-xl bg-[#135220] border border-[#FFD700]/35 px-4 py-4 text-center mb-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/80 mb-1 flex items-center justify-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-[#FFD700]" />
          <span>Winning Amount</span>
        </div>
        <div className="font-mono-code text-3xl sm:text-4xl font-extrabold text-[#FFD700] tabular-nums tracking-tight">
          {winner.winning_amount_formatted}
        </div>
      </div>

      {/* Draw Date & Lottery Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3.5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/75 mb-1 flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Draw Date</span>
          </div>
          <div className="font-mono-code text-base font-bold text-white tabular-nums">
            {winner.draw_date}
          </div>
        </div>

        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3.5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/75 mb-1 flex items-center justify-center gap-1.5">
            <Ticket className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Lottery Name</span>
          </div>
          <div className="text-base font-bold text-white">
            {winner.lottery_name}
          </div>
        </div>
      </div>

      {/* Verified Seller Info */}
      {winner.seller_info && (
        <div className="rounded-xl bg-[#135220] border border-[#FFD700]/20 px-4 py-3 text-center mb-3.5">
          <div className="text-xs sm:text-sm text-emerald-100 flex items-center justify-center gap-2 flex-wrap">
            <Store className="w-4 h-4 text-[#FFD700] shrink-0" />
            <span className="text-emerald-200/80">Ticket Seller Information:</span>
            <span className="font-semibold text-[#FFD700]">{winner.seller_info}</span>
            {winner.is_verified === 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>
        </div>
      )}

      {/* Safety Notice — Never asks for bank details, OTPs, or passwords */}
      <div className="rounded-xl bg-[#042D0C] border border-[#FFD700]/25 px-4 py-3 text-center">
        <div className="text-xs sm:text-sm text-emerald-100/90 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#FFD700] shrink-0" />
          <span>
            Please verify your ticket at an authorized Kerala Lottery office. Never share bank details, OTPs, or passwords online.
          </span>
        </div>
      </div>
    </div>
  );
}
