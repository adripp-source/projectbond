import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Palette,
  Globe,
  Newspaper,
  Target,
  Paintbrush,
  Settings,
  ChevronLeft,
  Zap,
  LogOut,
  Kanban,
  Hash,
  GitBranch,
  BookOpen,
  Bot,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const getNavItems = (userType: string | null, companyCode: string | null) => [
  { path: "/home", label: "Home", icon: Home },
  { path: "/analysis", label: "Website Analysis", icon: Globe },
  { path: "/actions", label: userType === "dev_team" ? "Dev Board" : "Action Center", icon: userType === "dev_team" ? Kanban : Target },
  { path: "/branding", label: "Branding", icon: Palette },
  { path: "/flows", label: "Flow & Logic", icon: GitBranch },
  { path: "/ai-tester", label: "AI Tester", icon: Bot },

  { path: "/flows", label: "Flow & Logic", icon: GitBranch },
  { path: "/docs", label: "Tech Docs", icon: BookOpen },
  { path: "/media", label: "Media Footprint", icon: Newspaper },
  { path: "/settings", label: "Settings", icon: Settings },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("user_type, workspace_id").eq("user_id", user.id).single().then(async ({ data }) => {
      setUserType((data as any)?.user_type ?? null);
      if ((data as any)?.workspace_id) {
        const { data: ws } = await supabase.from("workspaces").select("company_code").eq("id", (data as any).workspace_id).single();
        setCompanyCode((ws as any)?.company_code ?? null);
      }
    });
  }, [user]);

  const navItems = getNavItems(userType, companyCode);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-foreground font-semibold text-sm tracking-tight whitespace-nowrap"
            >
              Project Bond
            </motion.span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="block"
            >
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Company code */}
      {companyCode && !collapsed && (
        <div className="px-3 py-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar-accent/30">
            <Hash className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground">Team Code:</span>
            <span className="text-xs font-mono font-bold text-primary">{companyCode}</span>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:text-destructive hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
