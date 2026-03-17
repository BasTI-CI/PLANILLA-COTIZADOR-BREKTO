import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Using mock data. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://xqowzaerffopqvzjciiv.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxb3d6YWVyZmZvcHF2empjaWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjQzOTQsImV4cCI6MjA4OTAwMDM5NH0.bixUgKjbBbsUl9lkUG9SNeHngSUQmjSY8vtjWZBAfkM'
)
