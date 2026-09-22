import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ChatPage from './pages/ChatPage';
import ExplorePage from './pages/ExplorePage';
import ImaginePage from './pages/ImaginePage';
import LibraryPage from './pages/LibraryPage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import UsagePage from './pages/UsagePage';
import BotsPage from './pages/BotsPage';
import InboxPage from './pages/InboxPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SharePage from './pages/SharePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import ModelsPage from './pages/ModelsPage';
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ConnectSizorPage from './pages/ConnectSizorPage';
import GoogleAnalytics from './components/seo/GoogleAnalytics';
import ScrollToTop from './components/ScrollToTop';

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
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/:conversationId" element={<InboxPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/usage" element={<UsagePage />} />
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
