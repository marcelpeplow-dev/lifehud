// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface Profile {
  id: string;
  display_name: string | null;
  date_of_birth: string | null; // ISO date string
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  height_cm: number | null;
  weight_kg: number | null;
  timezone: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceConnection {
  id: string;
  user_id: string;
  terra_user_id: string;
  provider: "FITBIT" | "APPLE" | "GARMIN" | "OURA" | "WHOOP";
  connected_at: string;
  last_sync_at: string | null;
  is_active: boolean;
}

export interface SleepRecord {
  id: string;
  user_id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  bedtime: string | null; // ISO timestamp
  wake_time: string | null;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: number | null; // 0–100
  avg_heart_rate: number | null;
  avg_hrv: number | null;
  source: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  workout_type: "strength" | "cardio" | "flexibility" | "sport" | "other" | null;
  activity_name: string | null;
  calories_burned: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  distance_meters: number | null;
  intensity_score: number | null; // 0–100
  source: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DailyMetrics {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  active_minutes: number | null;
  resting_heart_rate: number | null;
  hrv_average: number | null;
  calories_total: number | null;
  calories_active: number | null;
  stress_score: number | null;
  recovery_score: number | null;
  source: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export type InsightCategory =
  | "sleep"
  | "fitness"
  | "recovery"
  | "correlation"
  | "goal"
  | "general";

export interface Insight {
  id: string;
  user_id: string;
  date: string;
  category: InsightCategory;
  title: string;
  body: string;
  data_points: Record<string, unknown> | null;
  priority: number; // 0–5, higher = more important
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export type GoalCategory = "sleep" | "fitness" | "recovery" | "general";
export type GoalFrequency = "daily" | "weekly" | "monthly";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  category: GoalCategory;
  metric_name: string;
  target_value: number;
  target_unit: string;
  target_frequency: GoalFrequency;
  current_value: number;
  start_date: string;
  target_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// SUPABASE DATABASE SCHEMA TYPE (for typed client)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      device_connections: {
        Row: DeviceConnection;
        Insert: Omit<DeviceConnection, "id" | "connected_at">;
        Update: Partial<DeviceConnection>;
      };
      sleep_records: {
        Row: SleepRecord;
        Insert: Omit<SleepRecord, "id" | "created_at">;
        Update: Partial<SleepRecord>;
      };
      workouts: {
        Row: Workout;
        Insert: Omit<Workout, "id" | "created_at">;
        Update: Partial<Workout>;
      };
      daily_metrics: {
        Row: DailyMetrics;
        Insert: Omit<DailyMetrics, "id" | "created_at">;
        Update: Partial<DailyMetrics>;
      };
      insights: {
        Row: Insight;
        Insert: Omit<Insight, "id" | "created_at">;
        Update: Partial<Insight>;
      };
      goals: {
        Row: Goal;
        Insert: Omit<Goal, "id" | "created_at" | "updated_at">;
        Update: Partial<Goal>;
      };
    };
  };
}

// ============================================================
// PATTERN ANALYSIS TYPES
// ============================================================

export type PatternSignificance = "high" | "medium" | "low";

export interface DetectedPattern {
  type:
    | "sleep_performance_correlation"
    | "sleep_consistency"
    | "workout_frequency_trend"
    | "resting_hr_trend"
    | "recovery_pattern"
    | "step_count_trend"
    | "personal_record";
  description: string;
  data: Record<string, unknown>;
  significance: PatternSignificance;
}

// ============================================================
// AI INSIGHT GENERATION TYPES
// ============================================================

export interface InsightGenerationRequest {
  user_id: string;
  trigger?: "sleep" | "fitness" | "daily";
}

export interface RawInsight {
  category: InsightCategory;
  title: string;
  body: string;
  priority: number;
}

// ============================================================
// TERRA WEBHOOK TYPES
// ============================================================

export type TerraEventType =
  | "auth"
  | "sleep"
  | "activity"
  | "daily"
  | "body"
  | "nutrition"
  | "menstruation";

export interface TerraWebhookPayload {
  type: TerraEventType;
  user: {
    user_id: string;
    provider: string;
    last_webhook_update: string;
  };
  data?: unknown[];
}

// ============================================================
// UI / COMPONENT PROP TYPES
// ============================================================

export type TrendDirection = "up" | "down" | "flat";

export interface MetricCardProps {
  label: string;
  value: string;
  trend: TrendDirection;
  trendValue: string;
  trendPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export type DateRange = "7d" | "30d" | "90d";

export interface SleepChartDataPoint {
  date: string;
  duration_minutes: number;
  goal_minutes?: number;
}

export interface WorkoutChartDataPoint {
  date: string;
  workouts: number;
  duration_minutes: number;
}
