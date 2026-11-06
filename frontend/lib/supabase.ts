import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Default or environment configuration
const DEFAULT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const DEFAULT_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let cachedClient: SupabaseClient | null = null;
let lastUrl = "";
let lastKey = "";

export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  if (typeof window !== "undefined") {
    const localUrl = localStorage.getItem("agentforge_supabase_url");
    const localKey = localStorage.getItem("agentforge_supabase_key");
    if (localUrl && localKey) {
      return { url: localUrl.trim(), key: localKey.trim(), isConfigured: true };
    }
  }

  const isConfigured = Boolean(
    DEFAULT_URL &&
    DEFAULT_KEY &&
    !DEFAULT_URL.includes("your-project") &&
    !DEFAULT_KEY.includes("your-anon-key")
  );

  return {
    url: DEFAULT_URL,
    key: DEFAULT_KEY,
    isConfigured,
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();

  if (!isConfigured || !url || !key) {
    return null;
  }

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.warn("Failed to initialize Supabase client:", err);
    return null;
  }
}

export interface PipelineRunRecord {
  id: string;
  user_id?: string;
  user_email?: string;
  specification: string;
  status: string;
  file_count?: number;
  created_at?: string;
}

// Database helper: Save run to Supabase 'pipeline_runs' table
export async function saveRunToSupabase(run: PipelineRunRecord): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("pipeline_runs").upsert(
      {
        id: run.id,
        user_id: run.user_id || "anonymous",
        user_email: run.user_email || "anonymous",
        specification: run.specification,
        status: run.status,
        file_count: run.file_count || 0,
        created_at: run.created_at || new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("Supabase save error (table 'pipeline_runs' may need creation):", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Could not record run in Supabase:", err);
    return false;
  }
}

// Database helper: Fetch user runs from Supabase
export async function getRunsFromSupabase(userEmail?: string): Promise<PipelineRunRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = supabase.from("pipeline_runs").select("*").order("created_at", { ascending: false }).limit(20);
    if (userEmail) {
      query = query.eq("user_email", userEmail);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data as PipelineRunRecord[];
  } catch {
    return [];
  }
}
