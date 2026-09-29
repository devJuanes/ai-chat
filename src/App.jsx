import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ChatPage from './pages/ChatPage';
import ExplorePage from './pages/ExplorePage';
import ImaginePage from './pages/ImaginePage';
import LibraryPage from './pages/LibraryPage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import UsagePage from './pages/UsagePage';
import SupportPage from './pages/SupportPage';
import AdminPage from './pages/AdminPage';
import ForecastsPage from './pages/ForecastsPage';
import BotsPage from './pages/BotsPage';
import BotDetailPage from './pages/BotDetailPage';
import InboxPage from './pages/InboxPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SharePage from './pages/SharePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import ModelsPage from './pages/ModelsPage';
import ModelDetailPage from './pages/ModelDetailPage';
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ConnectSizorPage from './pages/ConnectSizorPage';
import GoogleAnalytics from './components/seo/GoogleAnalytics';
import ScrollToTop from './components/ScrollToTop';

function BotsIndexRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const tab =
    params.has('meta_error') || params.has('meta_connected')
      ? 'canales'
      : 'agentes';
  return <Navigate to={{ pathname: `/bots/${tab}`, search }} replace />;
}

export default function App() {
  return (
    <>
      <GoogleAnalytics />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/acerca" element={<AboutPage />} />
        <Route path="/contacto" element={<ContactPage />} />
        <Route path="/modelos" element={<ModelsPage />} />
        <Route path="/modelos/:modelId" element={<ModelDetailPage />} />
        <Route path="/precios" element={<PricingPage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/conectar-sizor" element={<ConnectSizorPage />} />
        <Route path="/s/:token" element={<SharePage />} />

        <Route element={<AppLayout />}>
          <Route path="/c/:conversationId" element={<ChatPage />} />
          <Route path="/p/:projectId" element={<ChatPage />} />
          <Route
            path="/p/:projectId/c/:conversationId"
            element={<ChatPage />}
          />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/imagine" element={<ImaginePage />} />
          <Route path="/bots" element={<BotsIndexRedirect />} />
          <Route path="/bots/agentes/:botId" element={<BotDetailPage />} />
          <Route path="/bots/:tab" element={<BotsPage />} />
          <Route path="/inbox/:conversationId?" element={<InboxPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/soporte" element={<SupportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/pronosticos" element={<ForecastsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route
            path="/settings"
            element={<Navigate to="/settings/perfil" replace />}
          />
          <Route path="/settings/:tab" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
