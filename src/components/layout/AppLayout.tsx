import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const AppLayout = () => {
  const { sidebarCollapsed } = useWorkspace();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main
        className="min-h-screen transition-all duration-200 ease-in-out"
        style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
