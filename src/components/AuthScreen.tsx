import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, Phone, User, ArrowRight, Sun, Moon, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, signup, loginWithGoogle, loginAsDemoUser, resetPassword, isConfigured } = useAuth();
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
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-screen-container"
      className={`min-h-screen flex flex-col justify-center items-center px-4 py-8 sm:py-12 transition-colors duration-200 ${
        isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'
      }`}
    >
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6">
        <button
          id="theme-toggle-auth-btn"
          type="button"
          onClick={toggleTheme}
          className={`p-2.5 rounded-lg border transition-all ${
            isDark
              ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:text-white'
              : 'border-[#2A2926] bg-[#F5F2EA] text-[#0B0B0B] hover:text-[#B08D57]'
          }`}
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-[#B08D57]" /> : <Moon className="w-4 h-4 text-[#6F5738]" />}
        </button>
      </div>

      <div className="w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#6F5738]/40 border border-[#B08D57]/40 p-0.5 shadow-lg mb-3">
            <div className={`w-full h-full rounded-[14px] flex items-center justify-center font-bold text-2xl tracking-tight ${
              isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'
            }`}>
              <span className="text-[#B08D57]">K</span>
              <span className="text-[#6F5738]">R</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            KR
          </h1>
          <p className="text-sm font-semibold text-[#B08D57] mt-0.5 tracking-wide">
            Konvexa Rupxa
          </p>
          <p className="text-xs font-medium mt-1 text-[#6F5738] dark:text-[#A6A29A]">
            Your money, clearly mapped.
          </p>
        </div>

        {/* Auth Card */}
        <div
          id="auth-card"
          className={`rounded-2xl border p-6 sm:p-8 transition-colors ${
            isDark
              ? 'bg-[#0B0B0B] border-[#2A2926] shadow-2xl shadow-black/80'
              : 'bg-[#F5F2EA] border-[#2A2926] shadow-xl'
          }`}
        >
          {/* Tab Navigation */}
          {mode !== 'forgot' && (
            <div className={`grid grid-cols-2 p-1 rounded-xl mb-6 border ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926]'
            }`}>
              <button
                id="switch-login-tab"
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === 'login'
                    ? isDark
                      ? 'bg-[#2A2926] text-white shadow-sm'
                      : 'bg-[#0B0B0B] text-white shadow-sm'
                    : 'text-[#6F5738] hover:text-[#0B0B0B] dark:text-[#A6A29A] dark:hover:text-white'
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
                }}
                className={`py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === 'signup'
                    ? isDark
                      ? 'bg-[#2A2926] text-white shadow-sm'
                      : 'bg-[#0B0B0B] text-white shadow-sm'
                    : 'text-[#6F5738] hover:text-[#0B0B0B] dark:text-[#A6A29A] dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1 text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Reset Password
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                Enter your registered email address and we'll send reset instructions.
              </p>
            </div>
          )}

          {/* Feedback alerts */}
          {error && (
            <div
              id="auth-error-alert"
              className="mb-5 p-3.5 rounded-xl border border-[#6F5738]/40 bg-[#6F5738]/20 text-[#0B0B0B] dark:text-white text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B08D57]" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              id="auth-success-alert"
              className="mb-5 p-3.5 rounded-xl border border-[#B08D57]/40 bg-[#B08D57]/10 text-[#0B0B0B] dark:text-white text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#B08D57]" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name for Signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                  <input
                    id="signup-fullname-input"
                    type="text"
                    required
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                        : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                      : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                  }`}
                />
              </div>
            </div>

            {/* Phone Number for Signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                  <input
                    id="signup-phone-input"
                    type="tel"
                    required
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                        : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
                  Used for securely adding you to split groups.
                </p>
              </div>
            )}

            {/* Password */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A]">
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
                      className="text-xs text-[#B08D57] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                        : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Confirm Password for Signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                  <input
                    id="signup-confirmpassword-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                      isDark
                        ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                        : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
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
              className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#0B0B0B]/30 border-t-[#0B0B0B] rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? 'Sign In to Konvexa Rupxa'
                      : mode === 'signup'
                      ? 'Create My Account'
                      : 'Send Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Google Sign-In with Firebase Auth */}
            {mode !== 'forgot' && (
              <div className="pt-2">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-[#2A2926]" />
                  <span className="flex-shrink mx-3 text-xs text-[#6F5738] dark:text-[#A6A29A]">or</span>
                  <div className="flex-grow border-t border-[#2A2926]" />
                </div>
                <button
                  id="google-login-btn"
                  type="button"
                  onClick={async () => {
                    try {
                      setError(null);
                      await loginWithGoogle();
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium border flex items-center justify-center gap-2.5 transition-colors shadow-sm ${
                    isDark
                      ? 'border-[#2A2926] bg-[#0B0B0B] hover:bg-[#2A2926] text-white'
                      : 'border-[#2A2926] bg-[#F5F2EA] hover:bg-[#2A2926]/10 text-[#0B0B0B]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>

                {/* Instant Demo Account option */}
                <button
                  id="demo-login-btn"
                  type="button"
                  onClick={async () => {
                    try {
                      setError(null);
                      await loginAsDemoUser();
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className="w-full text-center text-xs text-[#B08D57] hover:underline mt-2.5 py-1"
                >
                  Explore with Demo Account
                </button>
              </div>
            )}

            {/* Back to login if in forgot mode */}
            {mode === 'forgot' && (
              <button
                id="back-to-login-btn"
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`w-full text-center text-xs mt-3 transition-colors ${
                  isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#6F5738] hover:text-[#0B0B0B]'
                }`}
              >
                Back to Sign In
              </button>
            )}
          </form>
        </div>

        {/* Security & Database Status Footer */}
        <div className="mt-8 text-center flex items-center justify-center gap-2 text-xs text-[#6F5738] dark:text-[#A6A29A]">
          <Shield className="w-3.5 h-3.5 text-[#B08D57]" />
          <span>Connected to Firebase Auth & Cloud Firestore</span>
        </div>
      </div>
    </div>
  );
};
