import { useState, useEffect } from "react";
import { Bell, X, AlertTriangle, Shield, Info, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

const severityConfig: Record<string, { icon: any; color: string }> = {
  critical: { icon: AlertTriangle, color: "text-destructive" },
  warning: { icon: AlertTriangle, color: "text-warning" },
  info: { icon: Info, color: "text-primary" },
};

export default function AlertsBell() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);

  const loadAlerts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("alerts" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20) as any;
    if (data) setAlerts(data);
  };

  useEffect(() => { loadAlerts(); }, [user]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from("alerts" as any).update({ is_read: true } as any).eq("id", id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("alerts" as any).update({ is_read: true } as any).eq("user_id", user.id).eq("is_read", false);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  };

  const dismissAlert = async (id: string) => {
    await supabase.from("alerts" as any).delete().eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-card border-border" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            alerts.map(alert => {
              const config = severityConfig[alert.severity] || severityConfig.info;
              const Icon = config.icon;
              return (
                <div key={alert.id}
                  onClick={() => markRead(alert.id)}
                  className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/30 transition-colors ${!alert.is_read ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium text-foreground ${!alert.is_read ? "" : "opacity-70"}`}>{alert.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); dismissAlert(alert.id); }}
                      className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
