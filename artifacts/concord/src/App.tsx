import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';
import { CycleProvider } from '@/contexts/cycle-context';
import { ThemeProvider } from '@/contexts/theme-context';

import { Dashboard } from '@/pages/dashboard';
import { TasksList } from '@/pages/tasks';
import { AddTask } from '@/pages/add-task';
import { ChatAssistant } from '@/pages/chat';
import { CalendarPage } from '@/pages/calendar';
import { AnalyticsPage } from '@/pages/analytics';
import { LoginPage } from '@/pages/login';
import { ProfileSetup } from '@/pages/profile-setup';
import { ProfilePage } from '@/pages/profile';
import ResetPasswordPage from '@/pages/reset-password';
import { PeriodUpdateDialog } from '@/components/period-update-dialog';
import { RescheduleDialog } from '@/components/reschedule-dialog';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();

  if (authLoading || (isAuthenticated && profileLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-2xl animate-pulse">
            C
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (profile && !profile.profileCompleted) {
    return <ProfileSetup />;
  }

  return (
    <>
      <PeriodUpdateDialog />
      <RescheduleDialog />
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/tasks" component={TasksList} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/add" component={AddTask} />
          <Route path="/chat" component={ChatAssistant} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthProvider>
              <ProfileProvider>
                <CycleProvider>
                  <AppRoutes />
                </CycleProvider>
              </ProfileProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
