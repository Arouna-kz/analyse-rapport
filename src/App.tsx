import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Chat from "./pages/Chat";
import ReportDetail from "./pages/ReportDetail";
import GenerateFutureReport from "./pages/GenerateFutureReport";
import GenerateFromTemplate from "./pages/GenerateFromTemplate";
import Alerts from "./pages/Alerts";
import MultiScenarioPredictions from "./pages/MultiScenarioPredictions";
import SharedPrediction from "./pages/SharedPrediction";
import Documentation from "./pages/Documentation";
import ArenaSettings from "./pages/ArenaSettings";
import AdminPanel from "./pages/AdminPanel";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { AuthenticatedLayout } from "./components/AuthenticatedLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/shared" element={<SharedPrediction />} />

          {/* Authenticated routes with sidebar */}
          <Route element={<AuthenticatedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/generate-future" element={<GenerateFutureReport />} />
            <Route path="/generate-template" element={<GenerateFromTemplate />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/predictions" element={<MultiScenarioPredictions />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/arena-settings" element={<ArenaSettings />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
