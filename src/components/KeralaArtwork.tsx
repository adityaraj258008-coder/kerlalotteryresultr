import React from 'react';

export function KeralaPortalEmblem({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="29" fill="#053610" stroke="#FFD700" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="23" stroke="#FFD700" strokeOpacity="0.4" strokeWidth="1" />
      {/* Stylized Coconut Palm Fronds */}
      <path
        d="M32 45V27"
        stroke="#FFD700"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M32 27C26 20 18 20 14 25C19 24 25 25 32 27Z"
        fill="#FFD700"
      />
      <path
        d="M32 27C38 20 46 20 50 25C45 24 39 25 32 27Z"
        fill="#FFD700"
      />
      <path
        d="M32 27C28 18 22 15 17 17C22 18 27 21 32 27Z"
        fill="#FACC15"
      />
      <path
        d="M32 27C36 18 42 15 47 17C42 18 37 21 32 27Z"
        fill="#FACC15"
      />
      {/* Traditional Kerala Nilavilakku base accent */}
      <path
        d="M23 45H41M26 49H38"
        stroke="#FFD700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoconutPalmHeroIllustration() {
  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[340px] flex items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#085E1B] via-[#064B16] to-[#032D0C] border border-[#FFD700]/30 p-6">
      {/* Golden Sun / Backwater Glow */}
      <div
        className="absolute top-6 right-10 w-36 h-36 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,215,0,0.38) 0%, rgba(255,215,0,0.08) 55%, transparent 75%)',
        }}
      />

      {/* Custom Kerala Backwaters & Coconut Palms SVG */}
      <svg
        viewBox="0 0 520 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[480px] relative z-10"
        aria-label="Kerala coconut palm trees over golden backwaters illustration"
      >
        <defs>
          <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE55C" />
            <stop offset="100%" stopColor="#D4A000" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#053B11" />
            <stop offset="50%" stopColor="#0B6B20" />
            <stop offset="100%" stopColor="#042E0D" />
          </linearGradient>
          <linearGradient id="palmDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#A67C00" />
          </linearGradient>
        </defs>

        {/* Sun disc */}
        <circle cx="370" cy="115" r="56" fill="url(#sunGrad)" fillOpacity="0.85" />

        {/* Distant Kerala hills */}
        <path
          d="M0 265C85 230 165 238 250 258C330 276 420 232 520 255V315H0V265Z"
          fill="#043A10"
        />

        {/* Backwater ripples */}
        <rect x="0" y="290" width="520" height="70" rx="12" fill="url(#waterGrad)" />
        <path
          d="M60 315H210M275 325H440M130 340H310"
          stroke="#FFD700"
          strokeOpacity="0.35"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Left Tall Coconut Tree */}
        <path
          d="M122 298C124 235 142 175 170 112"
          stroke="url(#palmDark)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <g transform="translate(170,112)">
          <path d="M0 0C-48 -28 -95 -12 -118 22C-78 4 -38 2 0 0Z" fill="#FFD700" />
          <path d="M0 0C-32 -52 -78 -56 -108 -34C-66 -32 -32 -16 0 0Z" fill="#FACC15" />
          <path d="M0 0C-8 -58 26 -82 62 -76C30 -52 12 -28 0 0Z" fill="#FFE047" />
          <path d="M0 0C44 -42 96 -34 124 -4C80 -14 40 -10 0 0Z" fill="#FFD700" />
          <path d="M0 0C50 -8 88 22 98 62C66 32 34 14 0 0Z" fill="#EAB308" />
          <path d="M0 0C-18 22 -34 52 -30 82C-16 54 -6 26 0 0Z" fill="#CA8A04" />
          <circle cx="-6" cy="8" r="6" fill="#78350F" />
          <circle cx="6" cy="9" r="6" fill="#78350F" />
        </g>

        {/* Secondary Leaning Coconut Tree */}
        <path
          d="M275 298C272 252 260 212 242 172"
          stroke="#EAB308"
          strokeWidth="7.5"
          strokeLinecap="round"
        />
        <g transform="translate(242,172)">
          <path d="M0 0C-38 -20 -72 -6 -88 18C-56 4 -28 2 0 0Z" fill="#FACC15" />
          <path d="M0 0C-18 -42 -52 -46 -76 -28C-46 -24 -22 -12 0 0Z" fill="#FFD700" />
          <path d="M0 0C24 -40 62 -36 86 -12C54 -16 26 -8 0 0Z" fill="#FFE047" />
          <path d="M0 0C36 -8 62 18 68 48C44 26 22 10 0 0Z" fill="#CA8A04" />
        </g>

        {/* Traditional Kettuvallam (Kerala Houseboat) silhouette */}
        <path
          d="M322 292C340 278 395 278 415 292H322Z"
          fill="#022309"
          stroke="#FFD700"
          strokeWidth="1.8"
        />
        <path
          d="M298 294H438L422 306H312L298 294Z"
          fill="#FFD700"
        />
      </svg>

      {/* Subtle corner badge */}
      <div className="absolute top-4 left-4 text-xs font-medium tracking-wide text-[#FFD700]/90">
        KERALA HERITAGE · INDEPENDENT RESULT PORTAL
      </div>
    </div>
  );
}
