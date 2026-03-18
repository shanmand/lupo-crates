
import React from 'react';
import { useBranches } from '../useBranches';
import { Loader2 } from 'lucide-react';

interface BranchSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

const BranchSelector: React.FC<BranchSelectorProps> = ({ 
  value, 
  onChange, 
  className = "", 
  placeholder = "Select Branch...",
  required = false
}) => {
  const { branches, isLoading } = useBranches();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 p-3">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest">Loading Branches...</span>
      </div>
    );
  }

  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all ${className}`}
    >
      <option value="">{placeholder}</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
};

export default BranchSelector;
