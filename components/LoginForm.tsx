import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff, Mail, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface LoginFormProps {
  onNavigateToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onNavigateToRegister }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState<string>('');

  useEffect(() => {
    const savedUser = localStorage.getItem('edu_grade_user');
    const savedPass = localStorage.getItem('edu_grade_pass');
    if (savedUser && savedPass) {
      setIdentifier(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setNeedsConfirmation(false);

    // 1. Trim inputs to remove accidental whitespace
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password; 

    try {
      let emailToUse = cleanIdentifier;

      // Check if the input looks like an email. If not, treat as username.
      const isEmail = cleanIdentifier.includes('@');

      if (!isEmail) {
        // Call the secure database function (RPC) to get email from username
        const { data: emailData, error: lookupError } = await supabase
          .rpc('get_email_by_username', { username_input: cleanIdentifier });

        if (lookupError) {
          console.error("Lookup Error:", JSON.stringify(lookupError));
          
          // Check for Network Error (Config issue)
          if (lookupError.message && lookupError.message.includes('Failed to fetch')) {
             throw new Error("Connection failed. Please check your internet or database configuration.");
          }
          
          // Check if function is missing (Code 42883) or generic error
          // If the backend function doesn't exist, we cannot support username login.
          if (lookupError.code === '42883' || (lookupError.message && lookupError.message.includes('function'))) {
             throw new Error('Username login is not configured on this server. Please login with your Email Address.');
          }

          throw new Error('Unable to verify username. Please try logging in with your Email Address.');
        }

        if (!emailData) {
          throw new Error('Username not found. Please check your username or login with Email.');
        }

        emailToUse = emailData;
      }
      
      // Store resolved email in case we need to resend confirmation
      setResolvedEmail(emailToUse);

      // Perform authentication with the resolved email
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: cleanPassword,
      });

      if (authError) {
        console.error("Auth Error:", JSON.stringify(authError));
        
        if (authError.message.includes("Email not confirmed")) {
          setNeedsConfirmation(true);
          throw new Error("Email not confirmed.");
        }
        
        if (authError.message.includes("Failed to fetch")) {
           throw new Error("Connection failed. Please check your internet or API keys.");
        }
        
        if (authError.message.includes("Invalid login credentials") || authError.code === "invalid_credentials") {
           throw new Error("Invalid password or credentials. Please try again.");
        }
        
        throw new Error('Login failed: ' + authError.message);
      }

      if (data.user) {
        console.log("Login successful");
        // Handle Remember Me
        if (rememberMe) {
          localStorage.setItem('edu_grade_user', cleanIdentifier);
          localStorage.setItem('edu_grade_pass', cleanPassword);
        } else {
          localStorage.removeItem('edu_grade_user');
          localStorage.removeItem('edu_grade_pass');
        }
      }
      
    } catch (err: any) {
      console.error("Login Error details:", err);
      let message = "An unexpected error occurred during login.";
      
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      } else if (err && typeof err === 'object') {
        // Safe extraction
        message = err.message || err.error_description || JSON.stringify(err);
      }
      
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!resolvedEmail && !identifier.includes('@')) {
      setErrorMsg("Cannot determine email address. Please try logging in with your Email Address instead of Username.");
      return;
    }

    const targetEmail = resolvedEmail || identifier;
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
      
      alert(`Confirmation email sent to ${targetEmail}!\n\nPlease check your inbox (and spam folder).`);
      setNeedsConfirmation(false);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend confirmation email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center w-full py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-green-800 p-8 text-center flex flex-col items-center border-b-4 border-yellow-500">
          <img 
             src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSD_sDccF9FqKwyxF0rgvVKQpfEgOWyseZ0LQ&s" 
             alt="Logo" 
             className="h-20 w-20 rounded-full border-4 border-yellow-400 mb-4 shadow-md bg-white p-0.5"
          />
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-yellow-100 mt-2 text-sm font-medium">Faculty Portal Login</p>
        </div>
        
        <div className="p-8">
          {errorMsg && (
            <div className={`mb-4 p-3 border text-sm rounded-lg flex flex-col gap-2 ${needsConfirmation ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">{needsConfirmation ? "Account Not Verified" : errorMsg}</span>
              </div>
              
              {needsConfirmation && (
                <div className="mt-1">
                  <p className="text-xs mb-2">Your email address has not been confirmed yet. Please check your inbox.</p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleResendConfirmation}
                    className="w-full text-xs h-8 bg-white"
                    isLoading={isLoading}
                  >
                    <Mail className="h-3 w-3 mr-2" />
                    Resend Confirmation Email
                  </Button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none top-8">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <Input 
                label="Username or Email" 
                type="text" 
                placeholder="Enter username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none top-8">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <Input 
                label="Password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer select-none group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-5 h-5 border rounded transition-colors flex items-center justify-center ${rememberMe ? 'bg-green-800 border-green-800' : 'bg-white border-slate-300 group-hover:border-green-400'}`}>
                     {rememberMe && <CheckSquare className="h-3.5 w-3.5 text-white" />}
                  </div>
                </div>
                <span className="ml-2 text-sm text-slate-600 group-hover:text-green-900 transition-colors">Remember username and password</span>
              </label>
            </div>

            <Button type="submit" className="w-full py-3 text-base" isLoading={isLoading}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <button 
                onClick={onNavigateToRegister}
                className="font-semibold text-green-800 hover:text-green-700 hover:underline focus:outline-none"
              >
                Register as a Teacher
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};