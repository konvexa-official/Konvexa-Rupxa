import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    // Check if dismissed before in this session
    const isDismissed = sessionStorage.getItem('rupxa_pwa_dismissed');
    if (isDismissed) return;

    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS users, show banner after 4 seconds if not installed
    let iosTimer: NodeJS.Timeout | null = null;
    if (isIosDevice) {
      iosTimer = setTimeout(() => {
        setIsVisible(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosInstructions(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('rupxa_pwa_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <>
      <aside aria-label="Install Rupxa App" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg transition-all animate-in fade-in slide-in-from-top-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0B0B]/95 text-white border border-[#D4AF37]/50 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#DFB15B] to-[#C59B27] text-black border border-[#B38A22]/50 flex items-center justify-center font-black text-sm shrink-0 shadow-md">
              ₹
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-xs sm:text-sm text-white tracking-tight flex items-center gap-1.5">
                <span>Install Rupxa App</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#D4AF37]/20 text-[#E6CA65] border border-[#D4AF37]/40 uppercase tracking-widest">
                  PWA
                </span>
              </h4>
              <p className="text-[11px] text-[#A6A29A] truncate">
                Instant offline tracking & fast UPI payments on your home screen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-md transition-all border border-[#B38A22]/50"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              className="p-1.5 text-[#A6A29A] hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Safari Instructions Modal */}
      {showIosInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0B0B0B] border border-[#D4AF37]/40 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2926] pb-3">
              <h3 className="font-black text-base text-[#E6CA65]">Install on iPhone / iPad</h3>
              <button
                onClick={() => setShowIosInstructions(false)}
                className="text-[#A6A29A] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#E6DFC8]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161616] border border-[#2A2926]">
                <div className="p-2 rounded-lg bg-[#D4AF37]/20 text-[#E6CA65] shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block text-white font-bold mb-0.5">1. Tap Share</strong>
                  Tap the Safari <strong>Share</strong> button in the bottom navigation bar.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161616] border border-[#2A2926]">
                <div className="p-2 rounded-lg bg-[#D4AF37]/20 text-[#E6CA65] shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block text-white font-bold mb-0.5">2. Add to Home Screen</strong>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosInstructions(false)}
              className="w-full py-2.5 rounded-xl font-black text-xs text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
