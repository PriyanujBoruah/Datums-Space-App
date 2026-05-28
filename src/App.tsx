import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, Database } from 'lucide-react';
import eventBus from './services/EventBus';
import firebaseService from './services/FirebaseService';
import type { FirebaseUser, UserRole } from './services/FirebaseService';
import duckDbService from './services/DuckDbService';
import type { TableMeta } from './services/DuckDbService';
import Sidebar from './components/Layout/Sidebar';
import type { ComplianceDoc } from './data/complianceDocs';
import ConsolePanel from './components/Layout/ConsolePanel';
import CustomDialogOverlay from './components/Layout/CustomDialogOverlay';
import { showAlert } from './services/DialogService';
import ChatInterface from './components/Chat/ChatInterface';
import StructuredIngestion from './components/Pipeline/StructuredIngestion';
import UnstructuredIngestion from './components/Pipeline/UnstructuredIngestion';
import NeuralIngestion from './components/Pipeline/NeuralIngestion';
import RelationalJoinLab from './components/Pipeline/RelationalJoinLab';
import PrivacyLab from './components/Enterprise/PrivacyLab';
import AuditDossier from './components/Enterprise/AuditDossier';
import SpatialBook from './components/Enterprise/SpatialBook';
import Library from './components/Enterprise/Library';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [activeDoc, setActiveDoc] = useState<ComplianceDoc | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(window.innerWidth > 768);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dynamic Sidebar drag-resizing states
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(320);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(420);
  const [activeResizer, setActiveResizer] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (!activeResizer) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (activeResizer === 'left') {
        const newWidth = Math.max(220, Math.min(480, e.clientX));
        setLeftSidebarWidth(newWidth);
      } else if (activeResizer === 'right') {
        const newWidth = Math.max(360, Math.min(600, window.innerWidth - e.clientX));
        setRightSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setActiveResizer(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeResizer]);

  useEffect(() => {
    const sync = () => {
      const active = duckDbService.getActiveTables();
      setTables(active);
      if (active.length > 0) {
        setSelectedTable((prev) => {
          if (!prev || !active.some((t) => t.name === prev)) {
            return active[0].name;
          }
          return prev;
        });
      }
    };
    sync();
    const unsubTables = eventBus.on('TABLES_UPDATED', sync);
    const unsubImport = eventBus.on('TABLE_IMPORTED', (tableName: string) => {
      setSelectedTable(tableName);
    });
    return () => {
      unsubTables();
      unsubImport();
    };
  }, []);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('datum_s_theme') as 'light' | 'dark') || 'light');
  const [palette, setPalette] = useState<string>(() => localStorage.getItem('datum_s_palette') || 'indigo');

  // Form states for custom login & registration
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>('Admin');
  const [org, setOrg] = useState('GlobalCorp');

  // Org Setup state for Google SSO users who lack organization ID mappings
  const [setupOrg, setSetupOrg] = useState('');
  const [submittingOrg, setSubmittingOrg] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('datum_s_theme', theme);
  }, [theme]);

  useEffect(() => {
    const htmlEl = document.documentElement;
    const classes = Array.from(htmlEl.classList);
    classes.forEach((cls) => {
      if (cls.startsWith('palette-')) {
        htmlEl.classList.remove(cls);
      }
    });
    htmlEl.classList.add(`palette-${palette}`);
    localStorage.setItem('datum_s_palette', palette);
  }, [palette]);

  useEffect(() => {
    setCurrentUser(firebaseService.getCurrentUser());
    
    const unsub = eventBus.on('AUTH_STATE_CHANGED', (user) => {
      setCurrentUser(user);
    });

    const unsubTab = eventBus.on('SWITCH_TAB', (tabName: string) => {
      setActiveTab(tabName);
    });

    return () => {
      unsub();
      unsubTab();
    };
  }, []);

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoggingIn(true);
    try {
      if (isRegistering) {
        if (!password.trim() || !displayName.trim()) {
          await showAlert("All registration parameters must be provided, including password and display name.", "Registration Incomplete");
          setIsLoggingIn(false);
          return;
        }
        await firebaseService.register(email.trim(), role, org, displayName.trim(), password.trim());
      } else {
        const needsPassword = firebaseService.isFirebaseConfigured();
        if (needsPassword && !password.trim()) {
          await showAlert("Production secure login requires a password.", "Password Required");
          setIsLoggingIn(false);
          return;
        }
        await firebaseService.login(email.trim(), role, org, undefined, password.trim() || undefined);
      }
    } catch (err: any) {
      await showAlert(`Authentication Failed: ${err.message || err}`, "Authentication Error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await firebaseService.loginWithGoogle();
    } catch (err: any) {
      await showAlert(`Google Authentication Failed: ${err.message || err}`, "Authentication Error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await firebaseService.logout();
  };

  const handleSetupOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupOrg.trim()) return;
    setSubmittingOrg(true);
    try {
      // Default new Google SSO user to 'Analyst' unless they are first (which is forced to 'Admin' in service layer)
      await firebaseService.joinOrganization(setupOrg.trim(), 'Analyst');
    } catch (err: any) {
      await showAlert(`Organization setup failed: ${err.message || err}`, "Setup Error");
    } finally {
      setSubmittingOrg(false);
    }
  };

  // Render Organization Setup screen if authenticated but lacks organization ID scope
  if (currentUser && !currentUser.organizationId) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-955 flex items-center justify-center p-4 selection:bg-brand-600 selection:text-white font-sans relative overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Background HSL gradients */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl filter animate-pulse" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl filter" />

        <div className="w-full max-w-md bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <svg viewBox="0 0 100 100" className="w-8 h-8 text-brand-650 dark:text-brand-400 mx-auto" fill="currentColor">
              {/* Curved 3-pointed star exactly matching user specifications */}
              <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
              {/* Overlapping orbits */}
              <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_12s_linear_infinite]" />
              <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
              {/* Rings at each side of the star points */}
              <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
            </svg>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-sans pt-2">
              Setup Your Workspace
            </h2>
            <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-normal max-w-sm mx-auto">
              Google Single Sign-On authenticated successfully. To complete activation, please configure your business organization custody bounds.
            </p>
          </div>

          <form onSubmit={handleSetupOrg} className="space-y-4 text-[10px]">
            <div className="space-y-0.5">
              <label className="text-[9px] text-slate-500 dark:text-slate-555 uppercase font-semibold">Organization / Business Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. SpaceCorp or GlobalCorp"
                value={setupOrg}
                onChange={(e) => setSetupOrg(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Premium Outfit alert notice */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl flex items-start gap-2 select-none">
              <span className="text-xs text-brand-500 mt-0.5">ℹ️</span>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-normal">
                Creating a brand new organization automatically assigns you the <strong className="text-slate-700 dark:text-slate-200 font-bold">Admin</strong> role. 
                Joining an existing organization restricts subsequent signups to restricted workspace clearances to maintain data custody.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                disabled={submittingOrg || !setupOrg.trim()}
                className="flex-1 py-2.5 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-700/50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/10 transition-all flex items-center justify-center gap-1.5"
              >
                {submittingOrg ? 'Activating Organization...' : 'Activate Secure Workspace'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-955 dark:hover:bg-slate-900 text-slate-550 dark:text-slate-400 hover:text-red-505 dark:hover:text-red-400 border border-slate-200 dark:border-slate-855 rounded-xl text-xs font-semibold transition-all"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Login screen if not Authenticated
  if (!currentUser) {
    const isCloud = firebaseService.isFirebaseConfigured();

    return (
      <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 selection:bg-brand-600 selection:text-white font-sans relative overflow-y-auto text-slate-900 dark:text-slate-100">
        {/* Background HSL gradients */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl filter animate-pulse" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl filter" />

        <div className="w-full max-w-4xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 rounded-3xl p-6 md:p-10 flex flex-col md:flex-row gap-8 backdrop-blur-xl shadow-2xl relative z-10">
          
          {/* Logo & Value Prop Panel */}
          <div className="flex-1 flex flex-col justify-between relative overflow-hidden p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-50/60 to-slate-100/40 dark:from-slate-955/65 dark:to-slate-900/35 border border-slate-150 dark:border-slate-900 pb-6 md:pb-8 z-0">
            {/* Dynamic Animated Geometrical Background Elements */}
            <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-30 select-none overflow-hidden z-0">
              {/* Style Injection */}
              <style>{`
                @keyframes float-geom-auth-1 {
                  0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                  50% { transform: translate(20px, -15px) rotate(180deg) scale(1.12); }
                  100% { transform: translate(0px, 0px) rotate(360deg) scale(1); }
                }
                @keyframes float-geom-auth-2 {
                  0% { transform: translate(0px, 0px) rotate(360deg) scale(1.15); }
                  50% { transform: translate(-25px, 20px) rotate(180deg) scale(0.9); }
                  100% { transform: translate(0px, 0px) rotate(0deg) scale(1.15); }
                }
                @keyframes float-geom-auth-3 {
                  0% { transform: translate(0px, 0px) rotate(0deg) scale(0.85); }
                  50% { transform: translate(15px, 25px) rotate(-180deg) scale(1.1); }
                  100% { transform: translate(0px, 0px) rotate(-360deg) scale(0.85); }
                }
                @keyframes float-geom-auth-slow {
                  0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                  50% { transform: translate(-12px, -18px) rotate(90deg) scale(1.05); }
                  100% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                }
              `}</style>

              {/* Shape 1: Primary glowing circle */}
              <div 
                className="absolute rounded-full filter blur-[2px]" 
                style={{
                  width: '50px',
                  height: '50px',
                  left: '8%',
                  top: '15%',
                  background: 'radial-gradient(circle, #4f46e5 0%, transparent 80%)',
                  animation: 'float-geom-auth-1 14s infinite ease-in-out'
                }}
              />

              {/* Shape 2: Accent glowing circle */}
              <div 
                className="absolute rounded-full filter blur-[3px]" 
                style={{
                  width: '45px',
                  height: '45px',
                  right: '15%',
                  bottom: '12%',
                  background: 'radial-gradient(circle, #a5b4fc 0%, transparent 80%)',
                  animation: 'float-geom-auth-2 18s infinite ease-in-out'
                }}
              />

              {/* Shape 3: Micro pulsing top glow */}
              <div 
                className="absolute rounded-full filter blur-[1.5px]" 
                style={{
                  width: '24px',
                  height: '24px',
                  left: '48%',
                  top: '10%',
                  background: 'radial-gradient(circle, #4f46e5 0%, transparent 85%)',
                  animation: 'float-geom-auth-3 9s infinite ease-in-out'
                }}
              />

              {/* Shape 4: Rotating border-only square */}
              <div 
                className="absolute border-[1.5px] filter blur-[0.2px]" 
                style={{
                  width: '28px',
                  height: '28px',
                  right: '8%',
                  top: '30%',
                  borderColor: '#a5b4fc',
                  opacity: 0.7,
                  borderRadius: '6px',
                  animation: 'float-geom-auth-2 19s infinite ease-in-out'
                }}
              />

              {/* Shape 5: Soft glowing outline triangle */}
              <svg 
                className="absolute animate-[spin_30s_linear_infinite]" 
                style={{
                  width: '30px',
                  height: '30px',
                  left: '40%',
                  bottom: '25%',
                  fill: 'none',
                  stroke: '#4f46e5',
                  strokeWidth: 2,
                  opacity: 0.6,
                  animation: 'float-geom-auth-3 16s infinite ease-in-out'
                }}
                viewBox="0 0 24 24"
              >
                <polygon points="12,2 22,22 2,22" />
              </svg>

              {/* Shape 6: Coordinate Cross Node */}
              <div 
                className="absolute flex items-center justify-center"
                style={{
                  left: '20%',
                  top: '55%',
                  opacity: 0.5,
                  animation: 'float-geom-auth-slow 24s infinite ease-in-out'
                }}
              >
                <div className="absolute w-4.5 h-0.5" style={{ backgroundColor: '#4f46e5' }} />
                <div className="absolute w-0.5 h-4.5" style={{ backgroundColor: '#4f46e5' }} />
              </div>

              {/* Shape 7: Floating dots */}
              <div 
                className="absolute w-2 h-2 rounded-full" 
                style={{
                  left: '25%',
                  top: '35%',
                  backgroundColor: '#a5b4fc',
                  opacity: 0.8,
                  animation: 'float-geom-auth-1 11s infinite ease-in-out'
                }}
              />
              <div 
                className="absolute w-1.5 h-1.5 rounded-full" 
                style={{
                  right: '28%',
                  bottom: '22%',
                  backgroundColor: '#4f46e5',
                  opacity: 0.8,
                  animation: 'float-geom-auth-2 13s infinite ease-in-out'
                }}
              />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <svg viewBox="0 0 100 100" className="w-8 h-8 text-brand-650 dark:text-brand-400 flex-shrink-0" fill="currentColor">
                    {/* Curved 3-pointed star exactly matching user specifications */}
                    <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
                    {/* Overlapping orbits */}
                    <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_10s_linear_infinite]" />
                    <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
                    {/* Rings at each side of the star points */}
                    <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                  <div>
                    <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-wider">Datums Space</h1>
                    <p className="text-[10px] text-brand-500 dark:text-brand-400 font-semibold tracking-widest uppercase">Agentic Data Platform</p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-255 tracking-tight leading-tight">
                    The Power of Agentic AI, with the Privacy of Local Compute.
                  </h2>
                  <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed font-sans">
                    Datums Space runs high-speed DuckDB SQL and OCR analytics directly in your browser. Absolutely no raw records ever leave your local computer.
                  </p>
                </div>
              </div>

              <div className="pt-6 md:pt-0 space-y-2 text-[10px] text-slate-650 dark:text-slate-500 font-semibold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-500" />
                  Zero-Cloud Sandboxed DuckDB
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-500" />
                  Local Tesseract OCR Ingestion
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-500" />
                  IndexedDB Parquet Vault
                </div>
              </div>
            </div>
          </div>

          {/* Login Gate Panel */}
          <div className="flex-1 space-y-5">
            {/* Connection mode indicator */}
            <div className={`p-2.5 rounded-xl border text-[9px] font-bold tracking-wider flex items-center gap-2 select-none uppercase ${
              isCloud 
                ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100/60 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100/60 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              <span>{isCloud ? '🛡️' : '⚠️'}</span>
              <span>{isCloud ? 'Production Cloud Auth Active' : 'Offline Simulation Sandbox Active'}</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-4.5 h-4.5 text-brand-500" />
                Enterprise Authentication Gate
              </h3>
              <p className="text-[10px] text-slate-550 leading-normal">
                {isCloud 
                  ? 'Connect to your Firebase cloud tenant. Access permissions are controlled dynamically.' 
                  : 'Firebase cloud not connected. Secure offline workspace profiles are persisted inside local sandboxing.'}
              </p>
            </div>

            {/* Custom login / registration form */}
            <form onSubmit={handleCustomLogin} className="space-y-3.5 select-none text-[10px]">
              {/* Form Mode Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-900 p-1 rounded-xl gap-1 text-[9.5px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    !isRegistering
                      ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-200 dark:border-slate-850 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  🔒 Secure Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    isRegistering
                      ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-200 dark:border-slate-850 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  📝 Register Profile
                </button>
              </div>

              {/* Email */}
              <div className="space-y-0.5">
                <label className="text-[9px] text-slate-500 dark:text-slate-550 uppercase font-semibold">User Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Password (Mandatory in production cloud config) */}
              <div className="space-y-0.5">
                <label className="text-[9px] text-slate-500 dark:text-slate-550 uppercase font-semibold">Password {isCloud && '*'}</label>
                <input
                  type="password"
                  required={isCloud || isRegistering}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Display Name (Only visible when Registering a new profile) */}
              {isRegistering && (
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 dark:text-slate-555 uppercase font-semibold">Display Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Alex Mercer"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Role & Tenant ID selectors */}
              {isRegistering && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-0.5">
                      <label className="text-[9px] text-slate-500 dark:text-slate-550 uppercase font-semibold">Workspace Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none font-sans"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Analyst">Analyst</option>
                        <option value="Auditor">Auditor</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[9px] text-slate-500 dark:text-slate-550 uppercase font-semibold">Organization Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AcmeCorp or SpaceCorp"
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-1.8 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Helpful enterprise guidance alert card */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl flex items-start gap-2 select-none">
                    <span className="text-xs text-brand-500 mt-0.5">ℹ️</span>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-normal">
                      Creating a new organization automatically grants you the <strong className="text-slate-700 dark:text-slate-200 font-bold">Admin</strong> role. 
                      Joining an existing organization restricts subsequent registrants from claiming admin clearance to ensure data custody.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || !email}
                className="w-full py-2.5 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-700/50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/10 transition-all flex items-center justify-center gap-1.5"
              >
                {isLoggingIn 
                  ? 'Connecting Secure Gate...' 
                  : isRegistering 
                    ? 'Register Cloud Profile' 
                    : 'Authenticate Secure Profile'}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-3.5 text-[8.5px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Or login via SSO</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-855 hover:border-brand-500/30 text-slate-700 dark:text-slate-350 hover:text-brand-650 dark:hover:text-brand-400 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-xs group"
            >
              <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Primary Platform Workspace
  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-955 flex font-sans text-slate-800 dark:text-slate-100 selection:bg-brand-600 selection:text-white relative transition-colors duration-300">
      
      {/* Mobile Sidebar overlays */}
      {leftSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 transition-opacity duration-300"
          onClick={() => setLeftSidebarOpen(false)}
        />
      )}
      {rightSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 transition-opacity duration-300"
          onClick={() => setRightSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Left) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme}
        setTheme={setTheme}
        isOpen={leftSidebarOpen}
        setIsOpen={setLeftSidebarOpen}
        palette={palette}
        setPalette={setPalette}
        width={leftSidebarWidth}
        activeDoc={activeDoc}
        setActiveDoc={setActiveDoc}
      />

      {leftSidebarOpen && (
        <div 
          onMouseDown={() => setActiveResizer('left')}
          className={`hidden md:block w-1 hover:w-1.5 cursor-col-resize hover:bg-brand-500/50 dark:hover:bg-brand-500/40 transition-all z-20 flex-shrink-0 h-full border-r border-slate-200/80 dark:border-slate-900/60 ${
            activeResizer === 'left' ? 'bg-brand-550 dark:bg-brand-500 w-1.5' : 'bg-transparent'
          }`}
          title="Drag to resize Left Sidebar"
        />
      )}

      {/* Main Workspace Area (Middle) */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/20 z-10 relative transition-colors duration-300">
        
        {/* Header toolbar */}
        <header className="h-14 border-b border-slate-100 dark:border-slate-900/60 bg-white dark:bg-slate-950 px-4 md:px-6 flex items-center justify-between z-10 flex-shrink-0 select-none transition-colors duration-300">
          
          <div className="flex items-center gap-2.5">
            {/* Sidebar toggle buttons */}
            <button
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="p-1.8 hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-lg text-slate-450 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200 transition-all flex-shrink-0"
              title="Toggle Left Sidebar"
            >
              {/* Custom SVG corresponding to Left collapser [| ] */}
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <rect width="18" height="18" x="3" y="3" rx="2.5" />
                <path d="M9 3v18" />
              </svg>
            </button>

            {/* Active Table Selector replacing Active Workspace Scope */}
            {tables.length > 0 ? (
              <div className="flex items-center gap-2 px-2.5 py-1 min-w-0 flex-shrink">
                <Database className="w-3.5 h-3.5 text-slate-400 dark:text-slate-555 flex-shrink-0" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline flex-shrink-0">Dataset:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-1 font-mono uppercase truncate max-w-[125px] sm:max-w-[200px] flex-shrink-0"
                >
                  {tables.map(t => (
                    <option key={t.name} value={t.name} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 lowercase font-mono">
                      {t.name} ({t.rowCount.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1">
                <Database className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No Datasets Loaded</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 100 100" className="w-8 h-8 text-brand-650 dark:text-brand-400 flex-shrink-0" fill="currentColor">
                {/* 3-pointed curved star exactly matching the user's uploaded geometry */}
                <path d="M 50 12 Q 57 54 85 80 Q 50 68 15 80 Q 43 54 50 12 Z" />
                {/* Orbital rings / orbits at each side */}
                <circle cx="50" cy="53" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-30 animate-[spin_10s_linear_infinite]" />
                <circle cx="50" cy="53" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-45" />
                {/* Rings at each side of the star points */}
                <circle cx="50" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="85" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="15" cy="80" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              </svg>
              <div className="text-left block">
                <h1 className="text-xs font-bold text-slate-850 dark:text-slate-100 tracking-wider leading-none">Datums Space</h1>
                <p className="text-[8px] text-brand-500 dark:text-brand-400 font-semibold tracking-widest uppercase mt-0.5 hidden sm:block">Agentic Business Intelligence</p>
              </div>
            </div>
            
            {/* Toggle Right Panel */}
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all flex-shrink-0"
              title="Toggle Right Panel"
            >
              {/* Custom SVG corresponding to Right collapser [ |] */}
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <rect width="18" height="18" x="3" y="3" rx="2.5" />
                <path d="M15 3v18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Tab content panels */}
        <div className={`flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-950/5 relative z-10 flex flex-col transition-colors duration-300 ${activeTab === 'chat' ? 'overflow-hidden p-0' : 'overflow-y-auto p-6'}`}>
          {activeTab === 'chat' && <ChatInterface />}
          
          {activeTab === 'ingest' && (
            <div className="space-y-8 max-w-4xl w-full mx-auto pb-12">
              <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg transition-colors duration-300">
                <StructuredIngestion onImportComplete={() => setActiveTab('chat')} />
              </div>
              <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg transition-colors duration-300">
                <UnstructuredIngestion onImportComplete={() => setActiveTab('chat')} />
              </div>
            </div>
          )}
          
          {activeTab === 'neural' && (
            <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg max-w-5xl w-full mx-auto transition-colors duration-300">
              <NeuralIngestion onImportComplete={() => setActiveTab('chat')} />
            </div>
          )}
          
          {activeTab === 'join' && (
            <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg max-w-5xl w-full mx-auto transition-colors duration-300">
              <RelationalJoinLab onJoinComplete={() => setActiveTab('chat')} />
            </div>
          )}
          
          {activeTab === 'privacy' && (
            <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg max-w-5xl w-full mx-auto transition-colors duration-300">
              <PrivacyLab />
            </div>
          )}
          
          {activeTab === 'audit' && (
            <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg max-w-5xl w-full mx-auto transition-colors duration-300">
              <AuditDossier />
            </div>
          )}
          
          {activeTab === 'spatial' && (
            <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg max-w-5xl w-full mx-auto transition-colors duration-300">
              <SpatialBook />
            </div>
          )}

          {activeTab === 'library' && (
            <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg max-w-5xl w-full mx-auto transition-colors duration-300">
              <Library />
            </div>
          )}
        </div>
      </main>

      {rightSidebarOpen && (
        <div 
          onMouseDown={() => setActiveResizer('right')}
          className={`hidden md:block w-1 hover:w-1.5 cursor-col-resize hover:bg-brand-500/50 dark:hover:bg-brand-500/40 transition-all z-20 flex-shrink-0 h-full border-l border-slate-200/80 dark:border-slate-900/60 ${
            activeResizer === 'right' ? 'bg-brand-550 dark:bg-brand-500 w-1.5' : 'bg-transparent'
          }`}
          title="Drag to resize Right Panel"
        />
      )}

      {/* SQL console Workbench & Schema Inspector (Right) */}
      <ConsolePanel 
        selectedTable={selectedTable}
        isOpen={rightSidebarOpen}
        setIsOpen={setRightSidebarOpen}
        width={rightSidebarWidth}
      />
      
      {/* Full-featured Compliance Document Viewer Modal */}
      {activeDoc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 md:p-10 z-50 select-text animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto flex flex-col justify-between shadow-2xl relative text-slate-855 dark:text-slate-200">
            <button 
              onClick={() => setActiveDoc(null)}
              className="absolute top-4 right-4 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-855 rounded-xl text-xs text-slate-550 hover:text-slate-800 transition-all font-bold select-none animate-pulse"
            >
              ✕ Close
            </button>

            <div className="space-y-4 flex-1">
              <div className="space-y-1 select-none pr-10">
                <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/30 text-brand-650 dark:text-brand-400 border border-brand-100/50 dark:border-brand-500/10 uppercase tracking-widest leading-none">
                  {activeDoc.category} | Updated: {activeDoc.lastUpdated}
                </span>
                <h2 className="text-base font-extrabold text-slate-855 dark:text-slate-100 tracking-tight leading-snug">
                  {activeDoc.title}
                </h2>
              </div>

              <div 
                className="pt-4 border-t border-slate-150 dark:border-slate-850 overflow-y-auto max-h-[55vh]"
                dangerouslySetInnerHTML={{ __html: activeDoc.contentHtml }}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-slate-150 dark:border-slate-850 select-none flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
              <span>🛡️ Local Sandbox Secure Reader</span>
              <button
                onClick={() => setActiveDoc(null)}
                className="py-2 px-6 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-600/10"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Stylized Custom Popups Overlay */}
      <CustomDialogOverlay />
    </div>
  );
};

export default App;
