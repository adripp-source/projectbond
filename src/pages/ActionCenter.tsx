import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StandardActionCenter from "@/components/action-center/StandardActionCenter";
import DevIssuesBoard from "@/pages/DevIssuesBoard";
import { Loader2 } from "lucide-react";

const ActionCenter = () => {
  const { user } = useAuth();
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setUserType(data?.user_type ?? null);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (userType === "dev_team") {
    return <DevIssuesBoard />;
  }

  return <StandardActionCenter />;
};

export default ActionCenter;
