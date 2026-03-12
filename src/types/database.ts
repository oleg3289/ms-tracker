export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  google_calendar_connected: boolean
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expiry: number | null
  created_at: string
}

export interface WorkoutProgram {
  id: string
  user_id: string
  title: string
  description: string | null
  source_url: string | null
  source_type: 'url' | 'pdf' | 'manual'
  duration_weeks: number | null
  days_per_week: number | null
  level: string | null
  goal: string | null
  created_at: string
}

export interface WorkoutDay {
  id: string
  program_id: string
  week_number: number
  day_number: number
  label: string | null
  notes: string | null
}

export interface Exercise {
  id: string
  day_id: string
  sort_order: number
  name: string
  sets: number | null
  reps: string | null
  weight_note: string | null
  rest_seconds: number | null
  notes: string | null
  youtube_url: string | null
}

export interface WorkoutPlan {
  id: string
  user_id: string
  program_id: string
  start_date: string
  end_date: string | null
  calendar_synced: boolean
  active: boolean
  created_at: string
}

export interface WorkoutSession {
  id: string
  plan_id: string
  day_id: string | null
  user_id: string
  scheduled_date: string
  completed: boolean
  completed_at: string | null
  duration_minutes: number | null
  notes: string | null
  calendar_event_id: string | null
}

export interface ExerciseLog {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  reps_done: number | null
  weight_kg: number | null
  completed: boolean
  created_at: string
}

// Extended types with joins
export interface WorkoutDayWithExercises extends WorkoutDay {
  exercises: Exercise[]
}

export interface WorkoutProgramWithDays extends WorkoutProgram {
  workout_days: WorkoutDayWithExercises[]
}

export interface WorkoutSessionWithDay extends WorkoutSession {
  workout_day: (WorkoutDay & { exercises: (Exercise & { exercise_logs: ExerciseLog[] })[] }) | null
  workout_plan: WorkoutPlan | null
}
