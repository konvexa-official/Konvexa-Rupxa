import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, Phone, User, ArrowRight, Sun, Moon, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { formatFirebaseAuthError } from '../lib/authErrors';

export const AuthScreen: React.FC = () => {
  const { login, signup, resetPassword } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'signup') {
        await signup({
          fullName,
          email,
          phone,
          password,
          confirmPassword,
        });
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccessMsg('Password reset instructions sent. Please check your email.');
      }
    } catch (err: unknown) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-screen-container"
      className={`min-h-screen flex flex-col justify-center items-center px-4 py-8 sm:py-12 transition-colors duration-200 ${
        isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#FAF8F5] text-black'
      }`}
    >
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6">
        <button
          id="theme-toggle-auth-btn"
          type="button"
          onClick={toggleTheme}
          className={`p-2.5 rounded-xl border transition-all ${
            isDark
              ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:text-white'
              : 'border-[#E6DFC8] bg-white text-black hover:border-[#D4AF37]'
          }`}
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4 text-[#C59B27]" />}
        </button>
      </div>

      <div className="w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#DFB15B] to-[#C59B27] border-2 border-[#D4AF37] p-0.5 shadow-lg shadow-amber-900/10 mb-3">
            <div className="w-full h-full rounded-[14px] flex items-center justify-center font-black text-2xl tracking-tight text-black">
              <span>KR</span>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            KR
          </h1>
          <p className="text-sm font-black text-[#8C6B1F] dark:text-[#E6CA65] mt-0.5 tracking-wide">
            Konvexa Rupxa
          </p>
          <p className="text-xs font-medium mt-1 text-[#292524] dark:text-[#A6A29A]">
            Your money, clearly mapped.
          </p>
        </div>

        {/* Auth Card */}
        <div
          id="auth-card"
          className={`rounded-2xl border p-6 sm:p-8 transition-colors ${
            isDark
              ? 'bg-[#0B0B0B] border-[#2A2926] shadow-2xl shadow-black/80'
              : 'bg-white border-[#E6DFC8] shadow-xl'
          }`}
        >
          {/* Tab Navigation */}
          {mode !== 'forgot' && (
            <div className={`grid grid-cols-2 p-1 rounded-xl mb-6 border ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}>
              <button
                id="switch-login-tab"
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-xs'
                    : isDark
                    ? 'text-[#A6A29A] hover:text-white'
                    : 'text-black/70 hover:text-black'
                }`}
              >
                Log In
              </button>
              <button
                id="switch-signup-tab"
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-xs'
                    : isDark
                    ? 'text-[#A6A29A] hover:text-white'
                    : 'text-black/70 hover:text-black'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-xl font-black mb-1 text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Reset Password
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Enter your registered email address and we&apos;ll send reset instructions.
              </p>
            </div>
          )}

          {/* Feedback alerts */}
          {error && (
            <div
              id="auth-error-alert"
              className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5 mb-5 font-bold animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <span>{error}</span>
                {error.includes('Email and password sign-in is currently unavailable') && (
                  <p className="text-[11px] font-normal text-rose-700 mt-1">
                    To resolve: in your Firebase Console, navigate to <strong>Build → Authentication → Sign-in method</strong>, and enable the <strong>Email/Password</strong> provider.
                  </p>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div
              id="auth-success-alert"
              className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2.5 mb-5 font-bold animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name for Signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
                  <input
                    id="signup-fullname-input"
                    type="text"
                    required
                    placeholder="Aditya Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                  }`}
                />
              </div>
            </div>

            {/* Phone for Signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
                  <input
                    id="signup-phone-input"
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] mt-1 font-medium">
                  Used for securely adding you to split groups.
                </p>
              </div>
            )}

            {/* Password */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A]">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      id="forgot-password-link"
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Confirm Password for Signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
                  <input
                    id="signup-confirmpassword-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md border border-[#B38A22]/40 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? 'Sign In to Konvexa Rupxa'
                      : mode === 'signup'
                      ? 'Create My Account'
                      : 'Send Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          {/* Bottom helper */}
          {mode === 'forgot' && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline"
              >
                ← Back to Login
              </button>
            </div>
          )}

          {/* Security footnote */}
          <div className="mt-6 pt-5 border-t border-[#E6DFC8] dark:border-[#2A2926] flex items-center justify-center gap-1.5 text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
            <Shield className="w-3.5 h-3.5 text-[#C59B27]" />
            <span>Secured with Firebase Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
};
