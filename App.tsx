import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { RegistrationForm } from './components/RegistrationForm';
import { TeacherDashboard } from './components/TeacherDashboard';
import { LogOut } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Button } from './components/ui/Button';

export default function App() {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // 1. Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // Clean the URL if it contains a hash (remove access_token visually)
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    });

    // 2. Listen for auth changes (e.g. sign in, sign out, or auto-login from email link)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && window.location.hash) {
        // Clean the URL hash after successful auth event
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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
              <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
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