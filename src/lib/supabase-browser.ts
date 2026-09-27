import { createClient } from '@supabase/supabase-js'

// Browser client — uses the anon key, safe for client components. Reads rely
// on the RLS policies in supabase/schema.sql.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
