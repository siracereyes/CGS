import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Role, Subject, GradeLevel, RegistrationData } from '../types';
import { UserPlus, ChevronLeft, CheckSquare, Square, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface RegistrationFormProps {
  onNavigateToLogin: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onNavigateToLogin }) => {
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: '',
    mainSubject: '',
    mainGradeLevel: '',
    hasMultipleGrades: false,
    additionalGrades: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      hasMultipleGrades: checked,
      additionalGrades: checked ? prev.additionalGrades : [] 
    }));
  };

  const handleAdditionalGradeToggle = (grade: GradeLevel) => {
    setFormData(prev => {
      const currentGrades = prev.additionalGrades;
      if (currentGrades.includes(grade)) {
        return { ...prev, additionalGrades: currentGrades.filter(g => g !== grade) };
      } else {
        return { ...prev, additionalGrades: [...currentGrades, grade] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords do not match!");
      return;
    }

    if (formData.password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine the redirect URL. This ensures the email link comes back to THIS app.
      const redirectUrl = window.location.origin;

      // 1. Create Auth User
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            username: formData.username,
            role: formData.role,
            mainSubject: formData.mainSubject,
            mainGradeLevel: formData.mainGradeLevel,
            hasMultipleGrades: formData.hasMultipleGrades,
            additionalGrades: formData.additionalGrades,
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error("Registration failed. No user was created.");

      // 2. Insert into Public Profiles Table immediately
      // This ensures the user appears in Admin lists even before they log in for the first time.
      const { error: profileError } = await supabase.from('profiles').insert([{
        id: data.user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        username: formData.username,
        role: formData.role,
        main_subject: formData.mainSubject,
        main_grade_level: formData.mainGradeLevel,
        has_multiple_grades: formData.hasMultipleGrades,
        additional_grades: formData.additionalGrades,
        // Default additional subjects to empty array
        additional_subjects: [] 
      }]);

      if (profileError) {
         console.warn("Profile creation warning:", profileError);
         // We don't throw here, as the auth user was created successfully.
         // The Dashboard has a self-healing mechanism to fix missing profiles on login.
      }

      console.log("Registration Successful");
      alert(`Account Request Sent! \n\nPlease check your email to confirm your account.\nThe link will redirect you back to: ${redirectUrl}`);
      onNavigateToLogin();

    } catch (err: any) {
      console.error("Registration Error:", err);
      
      let message = "An unexpected error occurred.";
      if (typeof err === 'string') {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="bg-green-800 p-6 sm:p-8 flex items-center justify-between border-b-4 border-yellow-500">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            Teacher Registration
          </h2>
          <p className="text-yellow-100 mt-1 text-sm">Create your academic profile</p>
        </div>
        <Button 
          variant="ghost" 
          onClick={onNavigateToLogin} 
          className="text-white hover:bg-green-700 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Login
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
        
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Section 1: Personal Information */}
        <section>
          <h3 className="text-lg font-semibold text-green-900 border-b border-slate-200 pb-2 mb-4">
            1. Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input 
              label="First Name" 
              name="firstName" 
              value={formData.firstName} 
              onChange={handleChange} 
              required 
              placeholder="e.g. Juan"
            />
            <Input 
              label="Middle Name" 
              name="middleName" 
              value={formData.middleName} 
              onChange={handleChange} 
              placeholder="Optional"
            />
            <Input 
              label="Last Name" 
              name="lastName" 
              value={formData.lastName} 
              onChange={handleChange} 
              required 
              placeholder="e.g. Dela Cruz"
            />
            <div className="md:col-span-3">
              <Input 
                label="Email Address" 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                placeholder="teacher@school.edu.ph"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Account Setup */}
        <section>
          <h3 className="text-lg font-semibold text-green-900 border-b border-slate-200 pb-2 mb-4">
            2. Account Setup
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input 
              label="Preferred Username" 
              name="username" 
              value={formData.username} 
              onChange={handleChange} 
              required 
            />
            <div className="relative">
              <Input 
                label="Password" 
                type={showPassword ? "text" : "password"} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                required 
                placeholder="Minimum 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Input 
                label="Confirm Password" 
                type={showPassword ? "text" : "password"} 
                name="confirmPassword" 
                value={formData.confirmPassword} 
                onChange={handleChange} 
                required 
                placeholder="Re-enter password"
                className="pr-10"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Teaching Profile */}
        <section>
          <h3 className="text-lg font-semibold text-green-900 border-b border-slate-200 pb-2 mb-4">
            3. Teaching Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Select 
              label="Role" 
              name="role" 
              value={formData.role} 
              onChange={handleChange} 
              options={Object.values(Role)} 
              required 
            />
            <Select 
              label="Main Subject" 
              name="mainSubject" 
              value={formData.mainSubject} 
              onChange={handleChange} 
              options={Object.values(Subject)} 
              required 
            />
            <Select 
              label="Main Grade Level" 
              name="mainGradeLevel" 
              value={formData.mainGradeLevel} 
              onChange={handleChange} 
              options={Object.values(GradeLevel)} 
              required 
            />
          </div>
        </section>

        {/* Section 4: Multiple Grade Level Logic */}
        <section className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <div className="flex items-center mb-4">
            <label className="flex items-center cursor-pointer select-none">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={formData.hasMultipleGrades} 
                  onChange={handleCheckboxChange}
                />
                <div className={`w-6 h-6 border-2 rounded transition-colors flex items-center justify-center ${formData.hasMultipleGrades ? 'bg-green-800 border-green-800' : 'bg-white border-slate-300'}`}>
                   {formData.hasMultipleGrades && <CheckSquare className="h-4 w-4 text-white" />}
                </div>
              </div>
              <span className="ml-3 text-sm font-medium text-slate-900">Do you teach multiple grade levels?</span>
            </label>
          </div>

          {/* Conditional Rendering based on check state */}
          {formData.hasMultipleGrades && (
            <div className="mt-4 animate-fadeIn">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Select Additional Grade Levels
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.values(GradeLevel).map((grade) => (
                  <div 
                    key={grade}
                    onClick={() => handleAdditionalGradeToggle(grade)}
                    className={`
                      cursor-pointer flex items-center p-3 rounded-lg border text-sm transition-all
                      ${formData.additionalGrades.includes(grade) 
                        ? 'bg-green-50 border-green-500 text-green-900 ring-1 ring-green-500' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-green-300'
                      }
                    `}
                  >
                    {formData.additionalGrades.includes(grade) ? (
                      <CheckSquare className="h-4 w-4 mr-2 text-green-600 flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 mr-2 text-slate-300 flex-shrink-0" />
                    )}
                    <span className="truncate">{grade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="pt-4 flex flex-col sm:flex-row justify-end gap-4">
           <Button 
            type="button" 
            variant="outline" 
            onClick={onNavigateToLogin}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="w-full sm:w-auto min-w-[160px]" 
            isLoading={isSubmitting}
          >
            Register
          </Button>
        </div>

      </form>
    </div>
  );
};