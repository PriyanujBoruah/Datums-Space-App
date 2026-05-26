import React from 'react';

interface PersonaLogoProps {
  agentId: string;
  className?: string;
}

export const PersonaLogo: React.FC<PersonaLogoProps> = ({ agentId, className = 'w-8 h-8' }) => {
  switch (agentId) {
    case 'analyst':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-indigo-500 flex-shrink-0`} fill="currentColor">
          {/* Symmetrical curved 3-pointed star */}
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          {/* Orbital spinning rings */}
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_10s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          {/* Outer Point Rings */}
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Data Analyst signature: vertical bar charts in center */}
          <rect x="43" y="47" width="3" height="11" rx="0.8" fill="white" />
          <rect x="48.5" y="41" width="3" height="17" rx="0.8" fill="white" />
          <rect x="54" y="49" width="3" height="9" rx="0.8" fill="white" />
        </svg>
      );

    case 'cso':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-emerald-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_12s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Business Strategist signature: Rising strategist chevrons & target */}
          <path d="M 44 58 L 50 51 L 56 58" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="45" r="2.5" fill="white" />
        </svg>
      );

    case 'logistics':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-amber-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          {/* Logistics signature: Outer dashed routes connecting points */}
          <path d="M 50 16 A 40 40 0 0 1 81 76" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2.5" className="opacity-60" />
          <path d="M 81 80 A 40 40 0 0 1 19 80" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2.5" className="opacity-60" />
          <path d="M 19 76 A 40 40 0 0 1 50 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2.5" className="opacity-60" />
          
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-25 animate-[spin_15s_linear_infinite]" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Supply Chain signature: isometric package cargo box */}
          <path d="M 44 48 L 50 44 L 56 48 L 56 55 L 50 59 L 44 55 Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="50" y1="44" x2="50" y2="59" stroke="white" strokeWidth="1" />
          <line x1="44" y1="48" x2="50" y2="51.5" stroke="white" strokeWidth="1" />
          <line x1="56" y1="48" x2="50" y2="51.5" stroke="white" strokeWidth="1" />
        </svg>
      );

    case 'auditor':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-rose-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_8s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Forensic Auditor signature: crosshair magnifier */}
          <circle cx="50" cy="49" r="6" fill="none" stroke="white" strokeWidth="1.5" />
          <line x1="50" y1="40" x2="50" y2="43" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="50" y1="55" x2="50" y2="58" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="41" y1="49" x2="44" y2="49" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="56" y1="49" x2="59" y2="49" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="54.5" y1="53.5" x2="59" y2="58" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'growth':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-pink-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_9s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Growth Partner signature: Ascending high-performance rocket */}
          <path d="M 50 40 C 52 45 53.5 49 53.5 53.5 L 46.5 53.5 C 46.5 49 48 45 50 40 Z" fill="white" />
          <path d="M 46.5 51.5 L 44 55 L 46.5 55 Z" fill="white" />
          <path d="M 53.5 51.5 L 56 55 L 53.5 55 Z" fill="white" />
          <path d="M 50 53.5 L 50 57.5" stroke="#ec4899" strokeWidth="1" strokeLinecap="round" />
          <path d="M 48.5 55 L 47 58" stroke="#ec4899" strokeWidth="1" strokeLinecap="round" />
          <path d="M 51.5 55 L 53 58" stroke="#ec4899" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'engineer':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-cyan-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_11s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Data Engineer signature: central spinning mechanical gear */}
          <circle cx="50" cy="50" r="4.5" fill="none" stroke="white" strokeWidth="1.8" />
          <line x1="50" y1="42.5" x2="50" y2="44.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="50" y1="55.5" x2="50" y2="57.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="42.5" y1="50" x2="44.5" y2="50" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="55.5" y1="50" x2="57.5" y2="50" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="44.7" y1="44.7" x2="46.1" y2="46.1" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="53.9" y1="53.9" x2="55.3" y2="55.3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="44.7" y1="55.3" x2="46.1" y2="53.9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="53.9" y1="46.1" x2="55.3" y2="44.7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'compliance':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-purple-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_10s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Chief Compliance Officer signature: secure shield & checkmark */}
          <path d="M 42 45 L 50 41 L 58 45 L 58 52 C 58 58 53 62 50 64 C 47 62 42 58 42 52 Z" fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M 46 51.5 L 49 54.5 L 54 49" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'product':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-blue-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_9s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Product & UX Analyst signature: device dashboard layout */}
          <rect x="43" y="42" width="14" height="21" rx="2" fill="none" stroke="white" strokeWidth="1.8" />
          <circle cx="50" cy="59.5" r="1" fill="white" />
          <line x1="47" y1="46" x2="53" y2="46" stroke="white" strokeWidth="1" strokeLinecap="round" />
          <path d="M 46 50 L 51 52.5 L 54 48" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'finance':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-green-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_12s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* CFO signature: premium dollar emblem */}
          <path d="M 46 56 C 46 58 48 59.5 50 59.5 C 52 59.5 53.5 58.5 53.5 57 C 53.5 54.5 46.5 54 46.5 51.5 C 46.5 50 48 48.5 50 48.5 C 52 48.5 53.5 49.5 53.8 51.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="50" y1="45.5" x2="50" y2="62.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'marketing':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-rose-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_11s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Marketing Director signature: megaphone emitting dynamic signals */}
          <path d="M 44 49 L 51 45 L 53 58 L 46 54 L 44 49 Z" fill="white" />
          <path d="M 47 54.5 L 48.5 59.5 L 51 58" fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M 55.5 47 A 7 7 0 0 1 55.5 56" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 58 44.5 A 11 11 0 0 1 58 58.5" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeDasharray="1.5 1.5" />
        </svg>
      );

    case 'hr':
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-orange-500 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_10s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* CHRO signature: overlapping collaborative human silhouettes */}
          <circle cx="44" cy="46" r="3.5" fill="white" />
          <path d="M 38 56 C 38 52 41 51 44 51 C 47 51 50 52 50 56" fill="white" />
          <circle cx="56" cy="48" r="3" fill="white" />
          <path d="M 51 57 C 51 53.5 53.5 52.5 56 52.5 C 58.5 52.5 61 53.5 61 57" fill="white" stroke="#f97316" strokeWidth="0.8" />
        </svg>
      );

    default:
      // Generic System Logo
      return (
        <svg viewBox="0 0 100 100" className={`${className} text-brand-650 dark:text-brand-400 flex-shrink-0`} fill="currentColor">
          <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
          <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_10s_linear_infinite]" />
          <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
          <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
  }
};
