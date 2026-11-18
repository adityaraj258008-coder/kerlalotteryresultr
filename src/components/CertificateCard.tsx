import React from 'react';
import { Award, Download } from 'lucide-react';
import type { WinnerRecord } from '../types';
import { downloadWinnerCertificatePNG, formatWinnerPlace } from '../utils/lotteryHelpers';

interface CertificateCardProps {
  winner: WinnerRecord;
}

export function CertificateCard({ winner }: CertificateCardProps) {
  const winnerPlace = formatWinnerPlace(winner.prize_position);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-center gap-2 text-[#FFD700] font-semibold tracking-wider text-xs sm:text-sm uppercase mb-4">
        <Award className="w-4 h-4" />
        <span>Your Informational Winner Certificate</span>
      </div>

      {/* Pink Certificate Card matching Reference Layout */}
      <div className="relative mx-auto max-w-2xl bg-[#FADCE7] p-3 sm:p-5 text-[#111827] shadow-2xl border-[6px] border-[#0B0F17] overflow-hidden">
        {/* Subtle inner hairline border */}
        <div className="relative border border-[#831843]/25 px-4 py-7 sm:px-12 sm:py-10 text-center">
          {/* Decorative Circular Independent Informational Watermark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
          >
            <svg
              viewBox="0 0 320 320"
              className="w-60 h-60 sm:w-72 sm:h-72 text-[#6B2145]/15"
              fill="none"
            >
              <circle cx="160" cy="160" r="144" stroke="currentColor" strokeWidth="3" />
              <circle
                cx="160"
                cy="160"
                r="134"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle cx="160" cy="160" r="96" stroke="currentColor" strokeWidth="2" />
              {/* Stylized Lotus & Palm Crest (Non-Government Independent Emblem) */}
              <path
                d="M160 112C148 130 144 148 160 166C176 148 172 130 160 112Z"
                fill="currentColor"
              />
              <path
                d="M160 166C140 158 124 144 122 126C138 134 150 148 160 166Z"
                fill="currentColor"
              />
              <path
                d="M160 166C180 158 196 144 198 126C182 134 170 148 160 166Z"
                fill="currentColor"
              />
              <path
                d="M126 178H194M136 188H184"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <defs>
                <path id="cert-arc-top" d="M 48,160 A 112,112 0 1,1 272,160" />
                <path id="cert-arc-bottom" d="M 272,160 A 112,112 0 1,1 48,160" />
              </defs>
              <text
                fill="currentColor"
                fontSize="14.5"
                fontWeight="700"
                letterSpacing="3.2"
              >
                <textPath href="#cert-arc-top" startOffset="50%" textAnchor="middle">
                  INDEPENDENT INFORMATIONAL PORTAL
                </textPath>
              </text>
              <text
                fill="currentColor"
                fontSize="12"
                fontWeight="700"
                letterSpacing="2.4"
              >
                <textPath href="#cert-arc-bottom" startOffset="50%" textAnchor="middle">
                  NOT AN OFFICIAL GOVERNMENT CERTIFICATE
                </textPath>
              </text>
            </svg>
          </div>

          <div className="relative z-10">
            <h4 className="text-2xl sm:text-4xl font-extrabold tracking-[0.18em] text-[#111827]">
              CERTIFICATE
            </h4>
            <p className="text-xs sm:text-sm font-bold tracking-[0.34em] text-[#1F2937] mt-1.5">
              OF WINNER
            </p>

            {/* Thin Horizontal Rule */}
            <div className="w-60 sm:w-80 h-[1px] bg-[#1F2937]/75 mx-auto my-5" />

            <p className="text-[11px] sm:text-xs font-bold tracking-[0.16em] text-[#1F2937] uppercase">
              THIS CERTIFICATE IS PRESENTED TO :
            </p>

            {/* Winner Name */}
            <div className="mt-5 mb-2">
              <span className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#0B0F17] break-words">
                {winner.winner_name}
              </span>
            </div>

            {/* Dotted Underline */}
            <div className="w-56 sm:w-80 border-b-[2.5px] border-dotted border-[#1F2937] mx-auto mb-5" />

            {/* Achievement Wording matching Reference */}
            <p className="text-sm sm:text-[15px] font-medium text-[#111827] max-w-md mx-auto leading-relaxed">
              For the achievement of <strong className="font-bold">{winnerPlace}</strong> in{' '}
              <strong className="font-bold">{winner.lottery_name}</strong> at the Winning level (
              <strong className="font-bold">{winner.winning_amount_formatted}</strong>). Thank you
              for your participation and good Luck.
            </p>

            <p className="mt-5 text-sm sm:text-base font-medium text-[#111827]">
              Winner Lottery Number is.{' '}
              <strong className="font-mono-code font-extrabold tracking-wider">
                {winner.ticket_number}
              </strong>
            </p>

            {/* Thin Horizontal Rule */}
            <div className="w-60 sm:w-80 h-[1px] bg-[#1F2937]/75 mx-auto mt-4 mb-2" />

            <p className="font-mono-code text-[11px] text-[#374151]">
              Certificate Ref: {winner.certificate_ref}
            </p>

            {/* Footer row: Date & Handwritten Signature */}
            <div className="mt-6 pt-2 grid grid-cols-2 gap-6 sm:gap-12 max-w-lg mx-auto items-end">
              <div>
                <div className="font-mono-code text-sm sm:text-base font-bold text-[#111827] pb-2">
                  {winner.draw_date}
                </div>
                <div className="border-t border-[#111827] pt-2 text-[11px] font-bold tracking-[0.18em] text-[#1F2937] uppercase">
                  DATE
                </div>
              </div>

              <div>
                {/* Crisp Pen-Style Cursive Signature SVG */}
                <div className="flex justify-center pb-1">
                  <svg
                    viewBox="0 0 180 56"
                    className="w-28 sm:w-32 h-9 sm:h-10 text-[#1E3A8A]"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M20 42 C32 18, 46 8, 52 10 C56 12, 42 36, 48 40 C54 44, 68 18, 76 14 C82 11, 74 34, 82 36 C90 38, 100 22, 108 26 C114 29, 118 35, 128 32 C138 29, 150 26, 162 28"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M26 30 C44 26, 62 24, 78 24"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="border-t border-[#111827] pt-2 text-[11px] font-bold tracking-[0.18em] text-[#1F2937] uppercase">
                  SIGNATURE
                </div>
              </div>
            </div>

            <p className="mt-5 text-[10px] sm:text-[11px] text-[#4B5563]">
              Independent informational certificate · Not an official Kerala Government document
            </p>
          </div>
        </div>
      </div>

      {/* Download PNG Button */}
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => downloadWinnerCertificatePNG(winner)}
          className="inline-flex items-center gap-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FACC15] active:scale-[0.99] text-[#05330E] font-bold px-6 py-3 text-sm sm:text-base shadow-lg shadow-black/25 transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download Certificate (PNG)</span>
        </button>
      </div>
    </div>
  );
}
