import { createBrowserClient } from '@supabase/ssr'

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseInstance
}

export const supabase = getSupabaseBrowserClient()

// Funciones auxiliares de autenticación
export const auth = {
  signIn: async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  },

  signOut: async () => {
    return await supabase.auth.signOut()
  },

  getSession: async () => {
    return await supabase.auth.getSession()
  },

  getUser: async () => {
    return await supabase.auth.getUser()
  },

  refreshSession: async () => {
    return await supabase.auth.refreshSession()
  }
}
