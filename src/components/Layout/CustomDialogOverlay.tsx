import React, { useState, useEffect } from 'react';
import { Info, Check, X, AlertTriangle } from 'lucide-react';
import eventBus from '../../services/EventBus';
import type { DialogRequest } from '../../services/DialogService';

export const CustomDialogOverlay: React.FC = () => {
  const [activeDialog, setActiveDialog] = useState<DialogRequest | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleShowDialog = (dialog: DialogRequest) => {
      setActiveDialog(dialog);
      // Trigger entrance animation next frame
      setTimeout(() => {
        setIsVisible(true);
      }, 20);
    };

    const unsub = eventBus.on('SHOW_DIALOG', handleShowDialog);

    // Escape key handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDialog) {
        handleResolve(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDialog]);

  const handleResolve = (approved: boolean) => {
    if (!activeDialog) return;
    setIsVisible(false);
    
    // Wait for exit animation
    setTimeout(() => {
      activeDialog.onResolve(approved);
      setActiveDialog(null);
    }, 200);
  };

  if (!activeDialog) return null;

  const isConfirm = activeDialog.type === 'confirm';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible 
          ? 'bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-[6px] opacity-100' 
          : 'bg-slate-950/0 backdrop-blur-0 opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`w-full max-w-md bg-white/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-850/85 rounded-2xl p-6 shadow-2xl transition-all duration-300 transform select-none ${
          isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'
        }`}
      >
        {/* Header Section */}
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center ${
              isConfirm
                ? 'bg-amber-100/80 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                : 'bg-brand-50/80 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400'
            }`}
          >
            {isConfirm ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide font-sans mb-1.5">
              {activeDialog.title}
            </h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed font-sans select-text">
              {activeDialog.message}
            </p>
          </div>
        </div>

        {/* Buttons Action Bar */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          {isConfirm ? (
            <>
              <button
                type="button"
                onClick={() => handleResolve(false)}
                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleResolve(true)}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-650 text-white rounded-xl text-xs font-bold tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleResolve(true)}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-650 text-white rounded-xl text-xs font-bold tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomDialogOverlay;
