import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: string[];
  error?: string;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ 
  label, 
  options, 
  error, 
  placeholder = "Select an option", 
  className = '',
  ...props 
}) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <select
          className={`
            block w-full rounded-lg border shadow-sm appearance-none
            text-slate-900 sm:text-sm px-3 py-2.5 pr-8 bg-white
            focus:ring-2 focus:ring-green-600 focus:border-green-600
            transition-colors duration-200
            ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}
            ${className}
          `}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};