import type { WinnerRecord } from '../types';

export function normalizeIndianMobileClient(input: string): string | null {
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

export function formatINRClient(amount: number): string {
  const safe = Math.max(0, Math.round(Number(amount) || 0));
  return `₹ ${safe.toLocaleString('en-IN')}`;
}

export function inferPrizePositionClient(amount: number): string {
  if (amount >= 200000000) return '1st Prize';
  if (amount >= 50000000) return '2nd Prize';
  if (amount >= 5000000) return '3rd Prize';
  if (amount >= 2000000) return '4th Prize';
  if (amount >= 500000) return '5th Prize';
  if (amount >= 50000) return '6th Prize';
  if (amount >= 5000) return '7th Prize';
  return 'Consolation Prize';
}

export function formatWinnerPlace(prizePosition: string): string {
  const trimmed = (prizePosition || 'Winner').trim();
  if (/prize$/i.test(trimmed)) {
    return trimmed.replace(/prize$/i, 'Winner place');
  }
  if (/place$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} Winner place`;
}

export function inferLotteryFromTicketClient(ticket: string): string {
  const upper = ticket.trim().toUpperCase();
  if (upper.startsWith('WW')) return 'Win-Win';
  if (upper.startsWith('SS')) return 'Sthree Sakthi';
  if (upper.startsWith('FF')) return 'Fifty-Fifty';
  if (upper.startsWith('KP')) return 'Karunya Plus';
  if (upper.startsWith('KN')) return 'Karunya';
  if (upper.startsWith('NR')) return 'Nirmal';
  if (upper.startsWith('AK')) return 'Akshaya';
  if (upper.startsWith('KL')) return 'Karunya Plus';
  return '';
}

export function generateCertRefClient(ticketNumber: string, drawDate: string): string {
  const cleanDate = (drawDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const cleanTicket =
    (ticketNumber || 'KL').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'KL';
  let hash = 0;
  const seed = `${cleanDate}-${cleanTicket}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + hash);
  return `KLR-${cleanDate}-${cleanTicket}-${suffix}`;
}

export function downloadWinnerCertificatePNG(winner: WinnerRecord): void {
  const width = 1600;
  const height = 1140;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const winnerPlace = formatWinnerPlace(winner.prize_position);

  // Soft rose-pink certificate background matching reference
  ctx.fillStyle = '#FADCE7';
  ctx.fillRect(0, 0, width, height);

  // Outer thick dark border
  ctx.strokeStyle = '#0B0F17';
  ctx.lineWidth = 18;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  // Subtle inner hairline frame
  ctx.strokeStyle = 'rgba(131, 24, 67, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  // Decorative Circular Independent Seal Watermark in center
  ctx.save();
  ctx.translate(width / 2, height / 2 + 10);
  ctx.strokeStyle = 'rgba(107, 33, 69, 0.14)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 250, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 230, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 165, 0, Math.PI * 2);
  ctx.stroke();

  // Lotus / Palm crest in watermark center
  ctx.fillStyle = 'rgba(107, 33, 69, 0.12)';
  ctx.beginPath();
  ctx.moveTo(0, -85);
  ctx.quadraticCurveTo(-24, -45, 0, -5);
  ctx.quadraticCurveTo(24, -45, 0, -85);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.quadraticCurveTo(-40, -20, -60, -58);
  ctx.quadraticCurveTo(-30, -45, 0, -5);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.quadraticCurveTo(40, -20, 60, -58);
  ctx.quadraticCurveTo(30, -45, 0, -5);
  ctx.fill();

  ctx.fillStyle = 'rgba(107, 33, 69, 0.14)';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INDEPENDENT INFORMATIONAL PORTAL', 0, -185);
  ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NOT AN OFFICIAL GOVERNMENT CERTIFICATE', 0, 200);
  ctx.restore();

  // Top Header
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  ctx.font = '800 66px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('C E R T I F I C A T E', width / 2, 165);

  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#1F2937';
  ctx.fillText('O F   W I N N E R', width / 2, 222);

  // Thin horizontal divider
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(410, 265);
  ctx.lineTo(width - 410, 265);
  ctx.stroke();

  // Presented to label
  ctx.fillStyle = '#1F2937';
  ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('THIS CERTIFICATE IS PRESENTED TO :', width / 2, 332);

  // Winner Name
  ctx.fillStyle = '#0B0F17';
  ctx.font = '800 84px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(winner.winner_name, width / 2, 465);

  // Dotted line below name
  ctx.save();
  ctx.setLineDash([6, 9]);
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(430, 498);
  ctx.lineTo(width - 430, 498);
  ctx.stroke();
  ctx.restore();

  // Achievement wording matching reference
  ctx.fillStyle = '#111827';
  ctx.font = '500 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `For the achievement of ${winnerPlace} in ${winner.lottery_name}`,
    width / 2,
    578
  );
  ctx.fillText(
    `at the Winning level (${winner.winning_amount_formatted}). Thank you for`,
    width / 2,
    628
  );
  ctx.fillText('your participation and good Luck.', width / 2, 678);

  // Ticket Number highlight
  ctx.fillStyle = '#111827';
  ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Winner Lottery Number is.  ${winner.ticket_number}`, width / 2, 760);

  // Thin horizontal divider
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(410, 800);
  ctx.lineTo(width - 410, 800);
  ctx.stroke();

  // Certificate Reference Number
  ctx.fillStyle = '#374151';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText(`Certificate Ref: ${winner.certificate_ref}`, width / 2, 838);

  // Footer columns: Date & Handwritten Signature
  const footerY = 965;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.5;

  // Left line (Date)
  ctx.beginPath();
  ctx.moveTo(180, footerY);
  ctx.lineTo(620, footerY);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.fillText(winner.draw_date, 400, footerY - 22);
  ctx.fillStyle = '#1F2937';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('D A T E', 400, footerY + 38);

  // Right line (Signature)
  ctx.beginPath();
  ctx.moveTo(width - 620, footerY);
  ctx.lineTo(width - 180, footerY);
  ctx.stroke();

  // Pen-style cursive signature stroke
  ctx.save();
  ctx.translate(width - 490, footerY - 82);
  ctx.scale(1.25, 1.25);
  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(20, 42);
  ctx.bezierCurveTo(32, 18, 46, 8, 52, 10);
  ctx.bezierCurveTo(56, 12, 42, 36, 48, 40);
  ctx.bezierCurveTo(54, 44, 68, 18, 76, 14);
  ctx.bezierCurveTo(82, 11, 74, 34, 82, 36);
  ctx.bezierCurveTo(90, 38, 100, 22, 108, 26);
  ctx.bezierCurveTo(114, 29, 118, 35, 128, 32);
  ctx.bezierCurveTo(138, 29, 150, 26, 162, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.lineWidth = 1.8;
  ctx.moveTo(26, 30);
  ctx.bezierCurveTo(44, 26, 62, 24, 78, 24);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#1F2937';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('S I G N A T U R E', width - 400, footerY + 38);

  // Bottom disclaimer inside certificate
  ctx.fillStyle = '#4B5563';
  ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'Independent informational certificate · Not an official Kerala Government document.',
    width / 2,
    height - 64
  );

  const link = document.createElement('a');
  const safeTicket = winner.ticket_number.replace(/[^A-Z0-9-]/gi, '') || 'winner';
  link.download = `kerala-lottery-certificate-${safeTicket}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
