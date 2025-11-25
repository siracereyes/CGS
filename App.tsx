import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { RegistrationForm } from './components/RegistrationForm';
import { TeacherDashboard } from './components/TeacherDashboard';
import { LogOut, AlertTriangle, UserCircle } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Button } from './components/ui/Button';

export default function App() {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [session, setSession] = useState<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        // 1. Check active session on load
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Supabase Session Error:", error);
          // If the error implies a bad URL or key, flag it
          if (error.message.includes('Fetch') || error.message.includes('URL') || error.message.includes('apikey')) {
            setConfigError("Failed to connect to database. Please check your API Keys.");
          }
          return;
        }

        setSession(data.session);
        if (data.session) {
          // Clean the URL if it contains a hash (remove access_token visually)
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      } catch (err: any) {
        console.error("Initialization Error:", err);
        setConfigError(err.message || "An unexpected error occurred during initialization.");
      }
    };

    initSession();

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Helper to get user display info
  const getUserDisplayName = () => {
    if (!session?.user?.user_metadata) return 'User';
    const { firstName, lastName, email } = session.user.user_metadata;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    return email || session.user.email;
  };

  const getUserRole = () => {
    return session?.user?.user_metadata?.role || 'Guest';
  };

  // Render Configuration Error Screen if critical failure
  if (configError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-xl shadow-xl border border-red-200 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Configuration Error</h1>
          <p className="text-slate-600 mb-6">{configError}</p>
          <div className="bg-slate-100 p-4 rounded text-left text-xs font-mono text-slate-700 mb-6 overflow-x-auto">
            <p><strong>Troubleshooting for Vercel:</strong></p>
            <p>1. Go to your Vercel Dashboard {'>'} Settings {'>'} Environment Variables.</p>
            <p>2. Ensure you have added:</p>
            <ul className="list-disc ml-4 mt-1">
              <li><code>VITE_SUPABASE_URL</code></li>
              <li><code>VITE_SUPABASE_ANON_KEY</code></li>
            </ul>
            <p className="mt-2">3. Redeploy your application after adding these keys.</p>
          </div>
          <Button onClick={() => window.location.reload()}>Retry Connection</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header / Navbar */}
      <header className="bg-green-800 text-white shadow-md z-10 relative border-b-4 border-yellow-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-full shadow-lg">
              <img 
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSD_sDccF9FqKwyxF0rgvVKQpfEgOWyseZ0LQ&s" 
                alt="School Logo" 
                className="h-12 w-12 rounded-full"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg md:text-xl tracking-tight leading-none text-white shadow-sm">
                Ramon Magsaysay (CUBAO) High School
              </span>
              <span className="text-xs text-yellow-200 uppercase tracking-wider font-semibold mt-1">
                Centralized Grading System
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {session && (
              <div className="flex items-center gap-4 bg-green-900/50 py-1.5 px-4 rounded-full border border-green-700/50">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold leading-none">{getUserDisplayName()}</div>
                  <div className="text-xs text-yellow-200 font-medium">{getUserRole()}</div>
                </div>
                <div className="h-8 w-8 bg-green-700 rounded-full flex items-center justify-center text-xs font-bold border-2 border-green-600">
                  {getUserDisplayName().charAt(0)}
                </div>
                <div className="h-6 w-px bg-green-700 mx-1"></div>
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 p-1 h-auto" onClick={handleSignOut} title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      {session ? (
         // Authenticated View - Full Dashboard
         <TeacherDashboard session={session} />
      ) : (
        // Public Views - Centered Forms
        <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-100">
          <div className="w-full max-w-5xl">
            {currentView === 'login' ? (
              <LoginForm onNavigateToRegister={() => setCurrentView('register')} />
            ) : (
              <RegistrationForm onNavigateToLogin={() => setCurrentView('login')} />
            )}
          </div>
        </main>
      )}

      {/* Footer - Only show on public pages */}
      {!session && (
        <footer className="bg-white border-t border-slate-200 py-6">
          <div className="text-center text-slate-500 text-sm">
            &copy; CJMR RMCHS. All rights reserved.
          </div>
        </footer>
      )}
    </div>
  );
}