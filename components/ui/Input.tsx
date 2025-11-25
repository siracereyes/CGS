import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        className={`
          block w-full rounded-lg border shadow-sm 
          text-slate-900 sm:text-sm px-3 py-2.5
          placeholder:text-slate-400
          focus:ring-2 focus:ring-green-600 focus:border-green-600
          transition-colors duration-200
          ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};