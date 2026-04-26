// Cross-section website sync. When a user adds a website in any section,
// it becomes available everywhere else (Analysis, Editor, Media, Docs).

import { supabase } from "@/integrations/supabase/client";

export interface SyncedWebsite {
  id: string;
  url: string;
  name: string | null;
  section: string;
}

export async function getAllUserWebsites(userId: string): Promise<SyncedWebsite[]> {
  const { data } = await supabase
    .from("websites")
    .select("id, url, name, section")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

// Returns websites the user has added in OTHER sections that don't yet exist in the current one.
export async function getSuggestedWebsites(userId: string, currentSection: string): Promise<SyncedWebsite[]> {
  const all = await getAllUserWebsites(userId);
  const inCurrent = new Set(all.filter(w => w.section === currentSection).map(w => w.url));
  // De-dupe by URL across sections
  const seen = new Set<string>();
  const out: SyncedWebsite[] = [];
  for (const w of all) {
    if (w.section !== currentSection && !inCurrent.has(w.url) && !seen.has(w.url)) {
      seen.add(w.url);
      out.push(w);
    }
  }
  return out;
}

// Adopt a suggested website into the current section (creates a row).
export async function adoptWebsite(userId: string, url: string, section: string): Promise<SyncedWebsite | null> {
  const { data, error } = await supabase
    .from("websites")
    .insert({ user_id: userId, url, section })
    .select("id, url, name, section")
    .single();
  if (error) {
    console.error("adoptWebsite failed", error);
    return null;
  }
  return data;
}
