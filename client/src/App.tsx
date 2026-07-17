import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { ClerkProvider } from "@clerk/clerk-react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { trackPageView } from "@/lib/analytics";
import WorldClock from "@/pages/world-clock";
import NotFound from "@/pages/not-found";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Support from "@/pages/support";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Router() {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
    // wouter swaps the route in place and leaves scroll where it was, so navigating from the
    // bottom of the tall home page (e.g. the footer's "access your location" link) would land
    // /support scrolled near its own footer. Reset to the top on every route change.
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={WorldClock} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function App() {
  // If no Clerk key configured, run without auth (localStorage-only mode)
  if (!CLERK_PUBLISHABLE_KEY) {
    return <AppContent />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AppContent />
    </ClerkProvider>
  );
}

export default App;
