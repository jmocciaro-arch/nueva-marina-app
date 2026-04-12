// =============================================
// NUEVA MARINA — TypeScript Types
// =============================================

// CORE
export interface Club {
  id: number
  name: string
  slug: string
  legal_name?: string
  tax_id?: string
  country: string
  city?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  logo_url?: string
  banner_url?: string
  timezone: string
  currency: string
  config: ClubConfig
  subscription_plan: string
  subscription_status: string
  created_at: string
}

export interface ClubConfig {
  theme?: {
    primary_color: string
    logo_url?: string
    favicon_url?: string
  }
  features?: {
    gym: boolean
    shop: boolean
    tournaments: boolean
    leagues: boolean
    innovation: boolean
    ai: boolean
  }
  booking?: {
    slot_duration: number
    max_advance_days: number
    cancellation_hours: number
  }
}

export interface User {
  id: string
  email: string
  full_name?: string
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  date_of_birth?: string
  gender?: string
  country: string
  city?: string
  preferred_language: string
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export interface ClubMember {
  id: number
  club_id: number
  user_id: string
  role: 'owner' | 'admin' | 'staff' | 'coach' | 'player' | 'guest'
  membership_type?: string
  membership_start?: string
  membership_end?: string
  is_active: boolean
  permissions: string[]
  joined_at: string
}

// COURTS & BOOKINGS
export interface Court {
  id: number
  club_id: number
  venue_id?: number
  sport_id?: number
  name: string
  type?: string
  surface?: string
  has_lighting: boolean
  is_active: boolean
  color: string
  sort_order: number
  config: Record<string, unknown>
}

export interface CourtSchedule {
  id: number
  court_id: number
  day_of_week: number
  open_time: string
  close_time: string
  slot_duration: number
  price_per_slot?: number
  is_peak: boolean
  peak_price?: number
  peak_start?: string
  peak_end?: string
}

export interface Booking {
  id: number
  club_id: number
  court_id: number
  booked_by: string
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  type: 'regular' | 'match' | 'tournament' | 'league' | 'class' | 'event'
  price?: number
  payment_status: 'pending' | 'paid' | 'refunded'
  payment_method?: string
  players: BookingPlayer[]
  needs_players: number
  is_open: boolean
  notes?: string
  created_at: string
  // Joined
  court?: Court
  booked_by_user?: User
}

export interface BookingPlayer {
  user_id?: string
  name: string
  position?: string
  confirmed: boolean
}

// PLAYERS
export interface PlayerProfile {
  id: number
  user_id: string
  club_id: number
  preferred_position: 'drive' | 'reves' | 'both'
  secondary_position?: string
  dominant_hand: 'right' | 'left'
  level: number
  category?: string
  racket_brand?: string
  racket_model?: string
  matches_played: number
  matches_won: number
  win_rate: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  ranking_points: number
  ranking_position?: number
  best_ranking?: number
  reputation_score: number
  punctuality_score: number
  sportsmanship_score: number
  cancellation_rate: number
  bio?: string
  photo_url?: string
  is_public: boolean
  // Joined
  user?: User
}

// MATCHES
export interface Match {
  id: number
  club_id: number
  booking_id?: number
  sport_id?: number
  match_type: 'friendly' | 'competitive' | 'tournament' | 'league'
  team1_player1?: string
  team1_player2?: string
  team2_player1?: string
  team2_player2?: string
  team1_set1?: number
  team2_set1?: number
  team1_set2?: number
  team2_set2?: number
  team1_set3?: number
  team2_set3?: number
  sets_team1: number
  sets_team2: number
  games_team1: number
  games_team2: number
  winner_team?: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  played_at?: string
  created_at: string
}

// TOURNAMENTS
export interface Tournament {
  id: number
  club_id: number
  name: string
  slug?: string
  format: string
  sport_id?: number
  start_date?: string
  end_date?: string
  registration_deadline?: string
  max_teams?: number
  entry_fee: number
  prize_pool: number
  prize_description?: string
  sets_to_win: number
  games_per_set: number
  golden_point: boolean
  banner_url?: string
  description?: string
  sponsor?: string
  status: 'draft' | 'registration' | 'active' | 'playoffs' | 'finished' | 'cancelled'
  categories: TournamentCategory[]
  created_at: string
}

export interface TournamentCategory {
  name: string
  gender: string
  level: string
  max_teams: number
}

export interface TournamentTeam {
  id: number
  tournament_id: number
  category?: string
  team_name?: string
  player1_id?: string
  player1_name: string
  player2_id?: string
  player2_name: string
  seed?: number
  status: 'registered' | 'confirmed' | 'eliminated' | 'winner'
  paid: boolean
  registered_at: string
}

// LEAGUES
export interface League {
  id: number
  club_id: number
  name: string
  slug?: string
  format: string
  sport_id?: number
  season?: string
  sponsor?: string
  banner_url?: string
  start_date?: string
  end_date?: string
  registration_deadline?: string
  entry_fee: number
  scoring_rules: ScoringRules
  sets_to_win: number
  games_per_set: number
  golden_point: boolean
  has_playoffs: boolean
  playoff_format: string
  description?: string
  rules_text?: string
  status: 'draft' | 'registration' | 'active' | 'playoffs' | 'finished'
  created_at: string
}

export interface ScoringRules {
  win_2_0: number
  win_2_1: number
  loss_1_2: number
  loss_0_2: number
  walkover_win: number
  walkover_loss: number
  punctuality_bonus: number
  max_pending_for_bonus: number
  tiebreakers: string[]
}

export interface LeagueCategory {
  id: number
  league_id: number
  name: string
  gender: string
  level?: string
  max_teams: number
  num_groups: number
  play_days?: string[]
  play_time_start?: string
  play_time_end?: string
  status: 'registration' | 'active' | 'playoffs' | 'finished'
  sort_order: number
}

export interface LeagueGroup {
  id: number
  category_id: number
  name: string
  sort_order: number
}

export interface LeagueTeam {
  id: number
  category_id: number
  group_id?: number
  team_name?: string
  player1_id?: string
  player1_name: string
  player1_position: string
  player2_id?: string
  player2_name: string
  player2_position: string
  player3_id?: string
  player3_name?: string
  seed?: number
  is_active: boolean
  registered_at: string
}

export interface LeagueRound {
  id: number
  category_id: number
  group_id?: number
  round_number: number
  scheduled_date?: string
  deadline_date?: string
  status: 'pending' | 'active' | 'completed'
  is_playoff: boolean
}

export interface LeagueMatch {
  id: number
  round_id: number
  category_id: number
  group_id?: number
  team1_id?: number
  team2_id?: number
  court_id?: number
  team1_set1?: number
  team2_set1?: number
  team1_set2?: number
  team2_set2?: number
  team1_set3?: number
  team2_set3?: number
  sets_team1: number
  sets_team2: number
  games_team1: number
  games_team2: number
  winner_team_id?: number
  status: 'scheduled' | 'played' | 'walkover' | 'postponed'
  walkover_team_id?: number
  played_date?: string
  notes?: string
  created_at: string
  // Joined
  team1?: LeagueTeam
  team2?: LeagueTeam
  round?: LeagueRound
}

export interface StandingRow {
  team_id: number
  team_name: string
  played: number
  won: number
  lost: number
  sets_won: number
  sets_lost: number
  set_diff: number
  games_won: number
  games_lost: number
  game_diff: number
  points: number
  bonus: number
  total_points: number
  results: Record<number, 'W' | 'L'>
}

// GYM
export interface GymMembership {
  id: number
  club_id: number
  user_id: string
  plan: string
  price: number
  billing_cycle: string
  start_date: string
  end_date?: string
  status: string
  auto_renew: boolean
}

// SHOP
export interface Product {
  id: number
  club_id: number
  name: string
  slug?: string
  category?: string
  brand?: string
  description?: string
  price: number
  cost?: number
  tax_rate: number
  sku?: string
  stock: number
  min_stock: number
  images: string[]
  specs: Record<string, unknown>
  is_active: boolean
  is_featured: boolean
}

export interface Order {
  id: number
  club_id: number
  user_id?: string
  order_number: string
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  payment_method?: string
  payment_status: string
  status: string
  created_at: string
}

export interface OrderItem {
  product_id: number
  name: string
  qty: number
  price: number
  total: number
}

// CASH REGISTER
export interface CashEntry {
  id: number
  club_id: number
  type: 'booking' | 'shop' | 'tournament' | 'league' | 'gym' | 'class' | 'other'
  description?: string
  amount: number
  payment_method: string
  reference_type?: string
  reference_id?: number
  staff_id?: string
  date: string
  created_at: string
}

// NOTIFICATIONS
export interface Notification {
  id: number
  club_id?: number
  user_id: string
  type: string
  channel: string
  title: string
  body?: string
  data?: Record<string, unknown>
  is_read: boolean
  sent_at: string
}
