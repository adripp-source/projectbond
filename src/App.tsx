import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Branding from "./pages/Branding";
import WebsiteAnalysis from "./pages/WebsiteAnalysis";
import MediaFootprint from "./pages/MediaFootprint";
import ActionCenter from "./pages/ActionCenter";
import VisualEditor from "./pages/VisualEditor";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Onboarding />} />
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/branding" element={<Branding />} />
            <Route path="/analysis" element={<WebsiteAnalysis />} />
            <Route path="/media" element={<MediaFootprint />} />
            <Route path="/actions" element={<ActionCenter />} />
            <Route path="/editor" element={<VisualEditor />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
