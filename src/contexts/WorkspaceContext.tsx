import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceData {
  userType: string | null;
  companyCode: string | null;
  companyName: string | null;
  workspaceId: string | null;
  displayName: string | null;
  latestScanUrl: string | null;
  latestScanId: string | null;
  healthScore: number | null;
  securityScore: number | null;
  sentimentScore: number | null;
  issueCount: number;
  loading: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceData>({
  userType: null, companyCode: null, companyName: null, workspaceId: null,
  displayName: null, latestScanUrl: null, latestScanId: null,
  healthScore: null, securityScore: null, sentimentScore: null,
  issueCount: 0, loading: true, sidebarCollapsed: false,
  setSidebarCollapsed: () => {}, refresh: async () => {},
});

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [data, setData] = useState<Omit<WorkspaceData, "loading" | "sidebarCollapsed" | "setSidebarCollapsed" | "refresh">>({
    userType: null, companyCode: null, companyName: null, workspaceId: null,
    displayName: null, latestScanUrl: null, latestScanId: null,
    healthScore: null, securityScore: null, sentimentScore: null, issueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const [profileRes, scanRes, issueCountRes] = await Promise.all([
      supabase.from("profiles").select("user_type, workspace_id, display_name").eq("user_id", user.id).single(),
      supabase.from("scans").select("id, url, health_score, security_score, sentiment_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("scan_issues").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "fixed"),
    ]);

    let companyCode: string | null = null;
    let companyName: string | null = null;
    const workspaceId = (profileRes.data as any)?.workspace_id ?? null;

    if (workspaceId) {
      const { data: ws } = await supabase.from("workspaces").select("company_code, company_name").eq("id", workspaceId).single();
      companyCode = (ws as any)?.company_code ?? null;
      companyName = (ws as any)?.company_name ?? null;
    }

    setData({
      userType: (profileRes.data as any)?.user_type ?? null,
      displayName: (profileRes.data as any)?.display_name ?? null,
      workspaceId,
      companyCode,
      companyName,
      latestScanUrl: scanRes.data?.url ?? null,
      latestScanId: scanRes.data?.id ?? null,
      healthScore: scanRes.data?.health_score ?? null,
      securityScore: scanRes.data?.security_score ?? null,
      sentimentScore: scanRes.data?.sentiment_score ?? null,
      issueCount: issueCountRes.count ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user]);

  return (
    <WorkspaceContext.Provider value={{ ...data, loading, sidebarCollapsed, setSidebarCollapsed, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
