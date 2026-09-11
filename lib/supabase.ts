import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables d'environnement NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes.",
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}

// Crée (ou réutilise) une session anonyme Supabase : auth.uid() réel,
// vérifié côté serveur, sans formulaire de connexion. Nécessite que
// "Allow anonymous sign-ins" soit activé dans le dashboard Supabase
// (Authentication -> Providers) ; sinon retourne null et la sauvegarde
// de projets est simplement indisponible (le reste de l'app continue
// de fonctionner).
export async function ensureAnonymousSession(): Promise<string | null> {
  const client = getSupabaseClient();

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    console.error("ensureAnonymousSession: getSession failed:", sessionError);
    return null;
  }
  if (sessionData.session?.user) {
    return sessionData.session.user.id;
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    console.error("ensureAnonymousSession: signInAnonymously failed:", error);
    return null;
  }
  return data.user?.id ?? null;
}
