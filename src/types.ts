export interface WinnerRecord {
  id: number;
  winner_name: string;
  mobile_number?: string;
  masked_mobile: string;
  ticket_number: string;
  lottery_name: string;
  prize_position: string;
  winning_amount: number;
  winning_amount_formatted: string;
  draw_date: string;
  seller_info: string;
  certificate_ref: string;
  is_verified: number;
  created_at: string;
  updated_at: string;
}

export interface PrizeCategory {
  id: number;
  sort_order: number;
  prize_name: string;
  prize_amount: string;
  winning_tickets: string[];
  highlighted_ticket?: string | null;
  lottery_name: string;
  draw_date: string;
  is_sample: number;
  updated_at: string;
}

export interface PublicStats {
  lotteryResultsCount: number;
  prizeCategoriesCount: number;
  previousDrawsCount: number;
  updatedRecordsCount: number;
  lastUpdated: string | null;
}

export interface VisitorReview {
  id: number;
  author_name: string;
  city: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface AppointmentRecord {
  id: number;
  full_name: string;
  mobile_number: string;
  email: string;
  appointment_date: string;
  purpose: string;
  notes: string;
  status: string;
  created_at: string;
}

export interface SupabaseStatus {
  configured: boolean;
  projectUrl: string | null;
  connected: boolean;
  tables: {
    winner_records: boolean;
    prize_categories: boolean;
    appointments: boolean;
  };
  lastError: string | null;
  sqlSchema: string;
}
