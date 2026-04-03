import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home, Palette, Globe, Newspaper, Target, Paintbrush, Settings,
  ChevronLeft, Zap, LogOut, Kanban, Hash, GitBranch,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const getNavItems = (userType: string | null) => [
  { path: "/home", label: "Today's Focus", icon: Home },
  { path: "/branding", label: "Branding", icon: Palette },
  { path: "/analysis", label: "Website Analysis", icon: Globe },
  { path: "/media", label: "Media Footprint", icon: Newspaper },
  { path: "/actions", label: userType === "dev_team" ? "Dev Board" : "Action Center", icon: userType === "dev_team" ? Kanban : Target },
  { path: "/editor", label: "Visual Editor", icon: Paintbrush },
  { path: "/flows", label: "Flow & Logic", icon: GitBranch },
  { path: "/settings", label: "Settings", icon: Settings },
];

const AppSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const {
    userType, companyCode, displayName, healthScore, issueCount,
    sidebarCollapsed, setSidebarCollapsed,
  } = useWorkspace();

  const navItems = getNavItems(userType);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const scoreColor = (healthScore ?? 0) >= 75 ? "text-success" : (healthScore ?? 0) >= 50 ? "text-warning" : "text-destructive";

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-foreground font-semibold text-sm tracking-tight whitespace-nowrap">
              Project Bond
            </motion.span>
          )}
        </div>
      </div>

      {/* Quick status bar */}
      {!sidebarCollapsed && healthScore !== null && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-sidebar-accent/30">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${(healthScore ?? 0) >= 75 ? "bg-success" : (healthScore ?? 0) >= 50 ? "bg-warning" : "bg-destructive"}`} />
              <span className="text-xs text-muted-foreground">Health</span>
              <span className={`text-xs font-bold ${scoreColor}`}>{healthScore}</span>
            </div>
            {issueCount > 0 && (
              <span className="text-[10px] text-destructive font-medium">{issueCount} issues</span>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.path} to={item.path} className="block">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
              }`}>
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                {!sidebarCollapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
                {isActive && !sidebarCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* User info + company code */}
      {!sidebarCollapsed && (
        <div className="px-3 py-2 border-t border-sidebar-border space-y-1">
          {displayName && (
            <div className="px-3 py-1 text-xs text-muted-foreground truncate">
              👋 {displayName}
            </div>
          )}
          {companyCode && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar-accent/30">
              <Hash className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Team Code:</span>
              <span className="text-xs font-mono font-bold text-primary">{companyCode}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:text-destructive hover:bg-sidebar-accent/50 transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors">
          <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`} />
        </button>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
