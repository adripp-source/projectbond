import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AlertsBell from "@/components/AlertsBell";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-[240px] min-h-screen">
        <div className="fixed top-0 right-0 z-40 p-3 flex items-center gap-2">
          <AlertsBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
