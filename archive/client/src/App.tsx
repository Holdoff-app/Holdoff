import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import FilterPage from "./pages/FilterPage";
import InterpretPage from "./pages/InterpretPage";
import CompanionsPage from "./pages/CompanionsPage";
import CompanionChatPage from "./pages/CompanionChatPage";
import JournalPage from "./pages/JournalPage";
import CommunityPage from "./pages/CommunityPage";
import ProfilePage from "./pages/ProfilePage";
import QuizPage from "./pages/QuizPage";
import ContactsPage from "./pages/ContactsPage";
import ContactDetailPage from "./pages/ContactDetailPage";
import ChroniclePage from "./pages/ChroniclePage";
import PricingPage from "./pages/PricingPage";
import FounderStoryPage from "./pages/FounderStoryPage";
import AdminDashboard from "./pages/AdminDashboard";

const APP_TABS = ["/filter", "/interpret", "/companions", "/journal", "/community"];

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/filter" component={FilterPage} />
      <Route path="/interpret" component={InterpretPage} />
      <Route path="/companions" component={CompanionsPage} />
      <Route path="/companions/:persona" component={CompanionChatPage} />
      <Route path="/journal" component={JournalPage} />
      <Route path="/community" component={CommunityPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/quiz" component={QuizPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/contacts/:id" component={ContactDetailPage} />
      <Route path="/chronicle" component={ChroniclePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/story" component={FounderStoryPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const isLandingPage = location === "/";
  const isTabPage = APP_TABS.some(tab => location === tab || location.startsWith(tab + "/"));
  const showBottomNav = !isLandingPage;

  return (
    <div className="app-shell">
      <div className="app-content">
        <Router />
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppShell />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
