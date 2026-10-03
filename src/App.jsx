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
import EduLayout from './pages/edu/EduLayout';
import EduHome from './pages/edu/EduHome';
import EduCreate from './pages/edu/EduCreate';
import EduRoutesPage from './pages/edu/EduRoutesPage';
import EduCertificatesPage from './pages/edu/EduCertificatesPage';
import CommunityShell from './pages/edu/community/CommunityShell';
import CommunityHome from './pages/edu/community/CommunityHome';
import CommunityBoard from './pages/edu/community/CommunityBoard';
import ChallengesView from './pages/edu/community/ChallengesView';
import ProjectsView from './pages/edu/community/ProjectsView';
import GroupsView from './pages/edu/community/GroupsView';
import EventsView from './pages/edu/community/EventsView';
import {
  ActivityView,
  CalendarView,
  CoursesView,
  GroupDetail,
  JoinGroup,
  StreaksView,
} from './pages/edu/community/Board';
import EduCoins from './pages/edu/EduCoins';
import EduForumPost from './pages/edu/EduForumPost';
import EduProfile from './pages/edu/EduProfile';
import EduEvents from './pages/edu/EduEvents';
import EduCourse from './pages/edu/EduCourse';
import EduCertificate from './pages/edu/EduCertificate';
import EduSupport from './pages/edu/EduSupport';
import EduAbout from './pages/edu/EduAbout';
import EduCalendar from './pages/edu/EduCalendar';
import EduLanding from './pages/EduLanding';
import EduVerify from './pages/edu/EduVerify';
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

function CoinsRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/edu/monedas${search}`} replace />;
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

        <Route path="/educreator" element={<EduLanding />} />
        <Route path="/edu/validar/:code?" element={<EduVerify />} />
        <Route path="/edu" element={<EduLayout />}>
          <Route index element={<EduHome />} />
          <Route path="crear" element={<EduCreate />} />
          <Route path="rutas" element={<EduRoutesPage />} />
          <Route path="monedas" element={<EduCoins />} />
          <Route path="certificados" element={<EduCertificatesPage />} />
          <Route path="comunidad" element={<CommunityShell />}>
            <Route index element={<CommunityHome />} />
            <Route path="foro" element={<CommunityBoard />} />
            <Route path="cursos" element={<CoursesView />} />
            <Route path="retos" element={<ChallengesView />} />
            <Route path="proyectos" element={<ProjectsView />} />
            <Route path="grupos" element={<GroupsView />} />
            <Route path="grupos/unirse/:code" element={<JoinGroup />} />
            <Route path="grupos/:groupId" element={<GroupDetail />} />
            <Route path="eventos" element={<EventsView />} />
            <Route path="actividad" element={<ActivityView />} />
            <Route path="calendario" element={<CalendarView />} />
            <Route path="rachas" element={<StreaksView />} />
            <Route path="monedas" element={<CoinsRedirect />} />
            <Route path=":postId" element={<EduForumPost />} />
          </Route>
          <Route path="perfil/:userId" element={<EduProfile />} />
          <Route path="perfil" element={<EduProfile />} />
          <Route path="eventos" element={<EduEvents />} />
          <Route path="tutor" element={<Navigate to="/edu/crear" replace />} />
          <Route path="soporte" element={<EduSupport />} />
          <Route path="acerca" element={<EduAbout />} />
          <Route path="calendario" element={<EduCalendar />} />
          <Route path="cursos/:courseId" element={<EduCourse />} />
          <Route path="cursos/:courseId/certificado" element={<EduCertificate />} />
        </Route>

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
