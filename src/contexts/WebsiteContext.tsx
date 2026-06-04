// Global shared website list. Any URL added in any page is visible everywhere.
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SharedWebsite {
  id: string;
  url: string;
  name: string | null;
  section: string;
  created_at?: string;
}

interface WebsiteContextValue {
  websites: SharedWebsite[];
  loading: boolean;
  refresh: () => Promise<void>;
  addWebsite: (url: string, name?: string, section?: string) => Promise<SharedWebsite | null>;
  removeWebsite: (id: string) => Promise<void>;
  // URLs deduped across sections (one entry per unique URL)
  uniqueUrls: SharedWebsite[];
}

const WebsiteContext = createContext<WebsiteContextValue | null>(null);

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).toString().replace(/\/$/, ""); } catch { return u; }
}

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [websites, setWebsites] = useState<SharedWebsite[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setWebsites([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("websites")
      .select("id, url, name, section, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setWebsites(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: when any row changes, refresh so every page stays in sync.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("websites-sync")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "websites", filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const addWebsite = useCallback<WebsiteContextValue["addWebsite"]>(async (rawUrl, name, section = "general") => {
    if (!user) return null;
    const url = normalizeUrl(rawUrl);
    if (!url) return null;
    // Avoid duplicate rows for the same URL+section
    const existing = websites.find(w => w.url === url && w.section === section);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("websites")
      .insert({ user_id: user.id, url, name: name ?? null, section })
      .select("id, url, name, section, created_at")
      .single();
    if (error) { console.error("addWebsite failed", error); return null; }
    await refresh();
    return data;
  }, [user, websites, refresh]);

  const removeWebsite = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("websites").delete().eq("id", id).eq("user_id", user.id);
    await refresh();
  }, [user, refresh]);

  // Unique URLs across sections (newest entry wins)
  const seen = new Set<string>();
  const uniqueUrls = websites.filter(w => {
    if (seen.has(w.url)) return false;
    seen.add(w.url);
    return true;
  });

  return (
    <WebsiteContext.Provider value={{ websites, loading, refresh, addWebsite, removeWebsite, uniqueUrls }}>
      {children}
    </WebsiteContext.Provider>
  );
}

export function useWebsites() {
  const ctx = useContext(WebsiteContext);
  if (!ctx) throw new Error("useWebsites must be used within WebsiteProvider");
  return ctx;
}
