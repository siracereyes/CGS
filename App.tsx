import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { RegistrationForm } from './components/RegistrationForm';
import { TeacherDashboard } from './components/TeacherDashboard';
import { LogOut, AlertTriangle, UserCircle, Database, Link as LinkIcon, Save } from 'lucide-react';
import { supabase, isConfigured, saveSupabaseConfig, clearSupabaseConfig } from './lib/supabaseClient';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

export default function App() {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [session, setSession] = useState<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // State for Manual Setup Form
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');

  useEffect(() => {
    const initSession = async () => {
      // 1. Immediate Configuration Check
      if (!isConfigured) {
        setConfigError("Database not configured.");
        return;
      }

      try {
        // 2. Connectivity Check (Ping)
        // We attempt a lightweight request. If this throws a network error, the URL/Key is likely wrong.
        const { error: pingError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        
        if (pingError) {
           console.warn("Connection Ping Failed:", pingError);
           if (pingError.message.includes('Fetch') || pingError.message.includes('Failed to fetch')) {
              setConfigError("Cannot connect to database. URL might be invalid.");
              return;
           }
        }

        // 3. Session Check
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Supabase Session Error:", error);
          if (error.message.includes('Fetch') || error.message.includes('URL') || error.message.includes('apikey')) {
            setConfigError("Failed to connect to database. Please check your API Keys.");
            return;
          }
        }
        
        setSession(data.session);
        if (data.session) {
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

    // 4. Listen for auth changes
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
  
  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl || !manualKey) {
      alert("Please enter both URL and Key");
      return;
    }
    saveSupabaseConfig(manualUrl, manualKey);
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

  // Render Configuration Error / Manual Setup Screen
  if (configError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-lg w-full rounded-xl shadow-xl border border-red-200 overflow-hidden">
          <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
             <div className="bg-red-100 p-2 rounded-full">
               <AlertTriangle className="h-6 w-6 text-red-600" />
             </div>
             <div>
               <h1 className="text-lg font-bold text-red-900">Connection Setup Required</h1>
               <p className="text-red-700 text-sm">Application cannot reach the database.</p>
             </div>
          </div>
          
          <div className="p-8">
            <p className="text-slate-600 mb-6 text-sm">
              The environment variables are missing or incorrect. You can manually connect by entering your Supabase credentials below. These will be saved securely in your browser.
            </p>
            
            <form onSubmit={handleManualConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supabase Project URL</label>
                <div className="relative">
                   <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                   <input 
                      type="url" 
                      required
                      placeholder="https://your-project.supabase.co"
                      className="pl-9 w-full rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      value={manualUrl}
                      onChange={e => setManualUrl(e.target.value)}
                   />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supabase Anon Key</label>
                <div className="relative">
                   <Database className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                   <input 
                      type="password" 
                      required
                      placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                      className="pl-9 w-full rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      value={manualKey}
                      onChange={e => setManualKey(e.target.value)}
                   />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save & Connect
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                To fix this permanently, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your Vercel Project Settings.
              </p>
            </div>
          </div>
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
            {/* Show Connection Reset for Admin Debugging if needed */}
            {!session && isConfigured && (
               <button onClick={clearSupabaseConfig} className="text-xs text-green-200 hover:text-white underline mr-2">
                 Reset Connection
               </button>
            )}
            
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