import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DemoModeProvider } from "./contexts/DemoModeContext";
import AppLayout from "./layouts/AppLayout";
import DashboardPage from "./pages/proads/DashboardPage";
import AgentPage from "./pages/proads/AgentPage";
import CampaignsPage from "./pages/proads/CampaignsPage";
import CampaignDetailPage from "./pages/proads/CampaignDetailPage";
import NewCampaignPage from "./pages/proads/NewCampaignPage";
import CreativesPage from "./pages/proads/CreativesPage";
import CreativeDetailPage from "./pages/proads/CreativeDetailPage";
import NewCreativePage from "./pages/proads/NewCreativePage";
import AudiencesPage from "./pages/proads/AudiencesPage";
import AudienceDetailPage from "./pages/proads/AudienceDetailPage";
import ApprovalsPage from "./pages/proads/ApprovalsPage";
import ReportsPage from "./pages/proads/ReportsPage";
import IntegrationsPage from "./pages/proads/IntegrationsPage";
import HistoryPage from "./pages/proads/HistoryPage";
import SettingsPage from "./pages/proads/settings/SettingsPage";
import CompanySettingsPage from "./pages/proads/settings/CompanySettingsPage";
import UsersSettingsPage from "./pages/proads/settings/UsersSettingsPage";
import AISettingsPage from "./pages/proads/settings/AISettingsPage";
import SecuritySettingsPage from "./pages/proads/settings/SecuritySettingsPage";
import NotFoundPage from "./pages/proads/NotFoundPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <DemoModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="agente" element={<AgentPage />} />
            <Route path="campanhas" element={<CampaignsPage />} />
            <Route path="campanhas/nova" element={<NewCampaignPage />} />
            <Route path="campanhas/:id" element={<CampaignDetailPage />} />
            <Route path="criativos" element={<CreativesPage />} />
            <Route path="criativos/novo" element={<NewCreativePage />} />
            <Route path="criativos/:id" element={<CreativeDetailPage />} />
            <Route path="publicos" element={<AudiencesPage />} />
            <Route path="publicos/:id" element={<AudienceDetailPage />} />
            <Route path="aprovacoes" element={<ApprovalsPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="integracoes" element={<IntegrationsPage />} />
            <Route path="historico" element={<HistoryPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="configuracoes/empresa" element={<CompanySettingsPage />} />
            <Route path="configuracoes/usuarios" element={<UsersSettingsPage />} />
            <Route path="configuracoes/ia" element={<AISettingsPage />} />
            <Route path="configuracoes/seguranca" element={<SecuritySettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </DemoModeProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
