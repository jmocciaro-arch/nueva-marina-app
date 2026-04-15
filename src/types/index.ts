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
  // Virtuagym expansion fields
  emergency_contact?: string
  medical_notes?: string
  document_type?: string
  document_number?: string
  address?: string
  postal_code?: string
  iban?: string
  virtuagym_id?: string
  notes?: string
  // Migración 005 — perfil atleta
  dni?: string
  current_weight?: number
  injuries?: Injury[]
}

export interface Injury {
  tipo: string
  fecha?: string
  descripcion?: string
  activa?: boolean
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

// =============================================
// EXPANSIÓN VIRTUAGYM
// =============================================

// VIRTUAGYM SYNC
export interface VirtuagymSync {
  id: number
  club_id: number
  entity_type: string
  virtuagym_id: string
  nm_entity_type: string
  nm_entity_id: string
  last_synced_at: string
  sync_status: 'synced' | 'pending' | 'error'
  sync_data?: Record<string, unknown>
}

// ACCESS CONTROL
export interface AccessPoint {
  id: number
  club_id: number
  name: string
  type: 'turnstile' | 'gate' | 'door'
  location?: string
  hardware_id?: string
  relay_endpoint?: string
  relay_method: 'http' | 'mqtt' | 'websocket'
  is_active: boolean
  config: Record<string, unknown>
  created_at: string
}

export interface AccessCredential {
  id: number
  club_id: number
  user_id: string
  type: 'qr' | 'nfc' | 'fingerprint' | 'facial' | 'pin'
  credential_data: string
  is_active: boolean
  expires_at?: string
  created_at: string
  last_used_at?: string
  // Joined
  user?: User
}

export interface AccessLog {
  id: number
  club_id: number
  user_id?: string
  access_point_id?: number
  credential_type?: string
  direction: 'in' | 'out'
  granted: boolean
  denial_reason?: string
  timestamp: string
  // Joined
  user?: User
  access_point?: AccessPoint
}

// SUBSCRIPTIONS & BILLING
export interface SubscriptionPlan {
  id: number
  club_id: number
  name: string
  slug?: string
  description?: string
  price: number
  billing_cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual'
  features: string[]
  includes_gym: boolean
  includes_courts: boolean
  court_discount_pct: number
  max_classes_per_week?: number
  max_bookings_per_week?: number
  access_hours?: { start: string; end: string }
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Subscription {
  id: number
  club_id: number
  user_id: string
  plan_id: number
  status: 'active' | 'past_due' | 'cancelled' | 'paused' | 'expired'
  start_date: string
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  cancelled_at?: string
  payment_method?: string
  stripe_subscription_id?: string
  notes?: string
  created_at: string
  // Joined
  plan?: SubscriptionPlan
  user?: User
}

export interface Invoice {
  id: number
  club_id: number
  user_id?: string
  invoice_number: string
  subscription_id?: number
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
  due_date?: string
  paid_at?: string
  payment_method?: string
  payment_reference?: string
  pdf_url?: string
  notes?: string
  created_at: string
  // Joined
  user?: User
}

export interface InvoiceItem {
  description: string
  qty: number
  unit_price: number
  tax_rate: number
  total: number
}

export interface CreditPack {
  id: number
  club_id: number
  name: string
  type: 'class' | 'booking' | 'mixed'
  credits: number
  price: number
  valid_days: number
  applicable_to?: string[]
  is_active: boolean
  created_at: string
}

export interface UserCredit {
  id: number
  club_id: number
  user_id: string
  pack_id: number
  total_credits: number
  used_credits: number
  purchased_at: string
  expires_at?: string
  status: 'active' | 'exhausted' | 'expired'
  // Joined
  pack?: CreditPack
}

// COMMUNITY
export interface Post {
  id: number
  club_id: number
  author_id: string
  type: 'post' | 'announcement' | 'event' | 'achievement' | 'result'
  content: string
  images: string[]
  link_url?: string
  link_preview?: { title: string; description: string; image: string }
  is_pinned: boolean
  visibility: 'public' | 'members' | 'admin_only'
  likes_count: number
  comments_count: number
  created_at: string
  updated_at: string
  // Joined
  author?: User
  user_liked?: boolean
}

export interface PostComment {
  id: number
  post_id: number
  author_id: string
  content: string
  parent_id?: number
  likes_count: number
  created_at: string
  // Joined
  author?: User
}

// CHALLENGES / GAMIFICATION
export interface Challenge {
  id: number
  club_id: number
  name: string
  description?: string
  type: 'individual' | 'team' | 'club_wide'
  category?: string
  metric: string
  target_value: number
  start_date?: string
  end_date?: string
  reward_type?: string
  reward_value?: string
  banner_url?: string
  is_active: boolean
  created_at: string
}

export interface ChallengeParticipant {
  id: number
  challenge_id: number
  user_id: string
  current_value: number
  completed: boolean
  completed_at?: string
  joined_at: string
  // Joined
  user?: User
}

export interface Badge {
  id: number
  club_id: number
  name: string
  slug: string
  description?: string
  icon_url?: string
  category?: string
  criteria?: Record<string, unknown>
}

export interface UserBadge {
  id: number
  user_id: string
  badge_id: number
  awarded_at: string
  // Joined
  badge?: Badge
}

// TRAINING
export interface TrainingPlan {
  id: number
  club_id: number
  name: string
  description?: string
  created_by?: string
  target_level?: 'beginner' | 'intermediate' | 'advanced'
  duration_weeks?: number
  goal?: string
  schedule: { day: number; workout_id: number }[]
  is_template: boolean
  is_active: boolean
  created_at: string
}

export interface UserTrainingPlan {
  id: number
  user_id: string
  plan_id: number
  assigned_by?: string
  start_date?: string
  status: 'active' | 'completed' | 'paused'
  progress: Record<string, unknown>
  created_at: string
  // Joined
  plan?: TrainingPlan
}

// PRODUCT CATEGORIES
export interface ProductCategory {
  id: number
  club_id: number
  name: string
  slug?: string
  parent_id?: number
  image_url?: string
  sort_order: number
  is_active: boolean
}

// STAFF
export interface StaffSchedule {
  id: number
  club_id: number
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  role?: string
  is_active: boolean
  // Joined
  user?: User
}

export interface StaffShift {
  id: number
  club_id: number
  user_id?: string
  date: string
  check_in?: string
  check_out?: string
  scheduled_start?: string
  scheduled_end?: string
  notes?: string
  status: 'scheduled' | 'active' | 'completed' | 'absent'
  // Joined
  user?: User
}

// RECOVERY SESSIONS (migración 005)
export interface RecoverySession {
  id: number
  club_id: number
  user_id: string
  type: 'crio' | 'hidro' | 'masaje' | 'estiramiento' | 'fisio'
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  assigned_staff_id?: string
  price?: number
  payment_status: 'pending' | 'paid' | 'included'
  notes?: string
  completed_at?: string
  created_at: string
  // Joined
  user?: User
  assigned_staff?: User
}
