import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://stqnheojxnicwnhuxisd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cW5oZW9qeG5pY3duaHV4aXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMzQ5MjcsImV4cCI6MjEwNDYxMDkyN30.LerfBHCD2RaHSrjuQftdRWJFXmVduaxnSZ_3BCNXF8E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)