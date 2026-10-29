import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  User,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
  Layers,
  CheckCircle2,
  Loader2
} from 'lucide-react';

const Login = () => {
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user');
  const { user, loading, logout } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-950 text-white overflow-hidden">
        <div className="flex flex-col items-center gap-2.5">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-medium">Loading Lingam Spares...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated
  if (user) {
    if (isLoggingIn) {
      const target = user.role === 'Admin' ? '/admin' : '/cashier';
      return <Navigate to={target} replace />;
    }

    return (
      <div className="h-screen max-h-screen w-full flex flex-col justify-between items-center bg-gray-950 selection:bg-blue-600 selection:text-white px-4 py-4 relative overflow-hidden">
        {/* Ambient Dark Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-zinc-950 to-black pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="h-2" />

        {/* Centered Welcome Card */}
        <div className="relative z-10 w-full max-w-[390px] my-auto p-6 sm:p-7 space-y-4.5 rounded-2xl bg-zinc-900/85 backdrop-blur-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-6 h-6 text-blue-400" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white">Welcome Back</h2>
            <p className="text-xs text-zinc-400">
              Active session for <span className="text-zinc-200 font-semibold">{user.email}</span>
            </p>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between">
            <div className="text-left space-y-0.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Active Role</p>
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                {user.role === 'Admin' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Store className="w-3.5 h-3.5 text-blue-400" />
                )}
                {user.role}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => setIsLoggingIn(true)}
              className="w-full h-10 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.99] transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2"
            >
              Continue to Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => logout()}
              className="w-full h-9 px-4 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 transition-all border border-white/5"
            >
              Logout & Switch Account
            </button>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="relative z-10 text-center text-zinc-600 text-[11px] tracking-wider py-1">
          &copy; Flipflex 2025 • Lingam Spares ERP
        </div>
      </div>
    );
  }

  const isCashier = loginType === 'user';

  return (
    <div className="h-screen max-h-screen w-full flex flex-col justify-between items-center bg-gray-950 selection:bg-blue-600 selection:text-white px-4 py-3 sm:py-5 relative overflow-hidden">
      {/* Background Gradients & Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-zinc-950 to-black pointer-events-none" />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full blur-[130px] pointer-events-none transition-colors duration-700 ${
          isCashier ? 'bg-blue-600/12' : 'bg-red-600/12'
        }`}
      />

      {/* Top Spacer for Optical Balance */}
      <div className="h-1 sm:h-2" />

      {/* Main Single-Frame Card */}
      <div className="relative z-10 w-full max-w-[390px] my-auto bg-zinc-900/85 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] p-6 sm:p-7 space-y-4">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 shadow-inner">
            <Layers className={`w-5 h-5 transition-colors duration-300 ${isCashier ? 'text-blue-400' : 'text-red-400'}`} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Lingam Spares
            </h1>
            <p className="text-[11px] text-zinc-400 font-medium tracking-wider uppercase">
              Enterprise Billing & Inventory OS
            </p>
          </div>
        </div>

        {/* Role Switcher (Cashier / Admin) */}
        <div className="p-1 bg-black/50 rounded-xl border border-white/10 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setLoginType('user')}
            className={`min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all duration-200 ${
              isCashier
                ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Store className={`w-3.5 h-3.5 ${isCashier ? 'text-blue-400' : 'text-zinc-500'}`} />
            Cashier
          </button>

          <button
            type="button"
            onClick={() => setLoginType('admin')}
            className={`min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all duration-200 ${
              !isCashier
                ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${!isCashier ? 'text-red-400' : 'text-zinc-500'}`} />
            Admin
          </button>
        </div>

        {/* Form Component */}
        {isCashier ? (
          <LoginForm
            expectedRole="Cashier"
            buttonText="Sign In to Cashier"
            buttonClass="bg-blue-600 hover:bg-blue-500 shadow-blue-600/25 focus:ring-blue-500"
            accentColor="blue"
            setIsLoggingIn={setIsLoggingIn}
          />
        ) : (
          <LoginForm
            expectedRole="Admin"
            buttonText="Access Admin Console"
            buttonClass="bg-red-600 hover:bg-red-500 shadow-red-600/25 focus:ring-red-500"
            accentColor="red"
            setIsLoggingIn={setIsLoggingIn}
          />
        )}

        {/* Security Badge */}
        <div className="pt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>256-Bit SSL Encrypted System Access</span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center text-zinc-600 text-[11px] tracking-wider py-1">
        &copy; Flipflex 2025 • Lingam Spares
      </div>
    </div>
  );
};

interface LoginFormProps {
  expectedRole: 'Admin' | 'Cashier';
  buttonText: string;
  buttonClass: string;
  accentColor: 'blue' | 'red';
  setIsLoggingIn: (val: boolean) => void;
}

const LoginForm = ({ expectedRole, buttonText, buttonClass, accentColor, setIsLoggingIn }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isBlue = accentColor === 'blue';

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    setIsLoggingIn(true);

    if (!email.includes('@') || email.length < 5) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      setIsLoggingIn(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      setIsLoggingIn(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const docRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        if (expectedRole === 'Admin' && firebaseUser.email !== 'admin@mail.com') {
          await auth.signOut();
          throw new Error("Access denied: You do not have Administrator privileges.");
        }

        await setDoc(docRef, {
          email: firebaseUser.email,
          role: expectedRole,
          createdAt: new Date()
        });
      } else {
        const userData = docSnap.data();
        if (userData.role !== expectedRole) {
          await auth.signOut();
          throw new Error(`Access denied: You are not authorized as a ${expectedRole}.`);
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Incorrect email or password.");
      setIsLoading(false);
      setIsLoggingIn(false);
    }
  };

  return (
    <form className="space-y-3.5" onSubmit={handleLogin}>
      {/* Email Input */}
      <div className="space-y-1 text-left">
        <label htmlFor="email" className="block text-[11px] font-semibold text-zinc-300 tracking-wider uppercase">
          {expectedRole} Email
        </label>
        <div className="relative group">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 group-focus-within:text-zinc-300 transition-colors">
            <User className="h-4 w-4" />
          </div>
          <input
            type="email"
            id="email"
            className={`block w-full h-10 pr-3 pl-9 text-xs text-white bg-black/40 border border-zinc-800 rounded-xl placeholder-zinc-500 focus:outline-none focus:ring-4 transition-all ${
              isBlue
                ? 'focus:border-blue-500 focus:ring-blue-500/20'
                : 'focus:border-red-500 focus:ring-red-500/20'
            }`}
            placeholder={`Enter your ${expectedRole.toLowerCase()} email`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-1 text-left">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-[11px] font-semibold text-zinc-300 tracking-wider uppercase">
            Password
          </label>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert("Please contact your system administrator to reset your credentials.");
            }}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
          >
            Forgot?
          </a>
        </div>
        <div className="relative group">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 group-focus-within:text-zinc-300 transition-colors">
            <Lock className="h-4 w-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            className={`block w-full h-10 pr-10 pl-9 text-xs text-white bg-black/40 border border-zinc-800 rounded-xl placeholder-zinc-500 focus:outline-none focus:ring-4 transition-all ${
              isBlue
                ? 'focus:border-blue-500 focus:ring-blue-500/20'
                : 'focus:border-red-500 focus:ring-red-500/20'
            }`}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-2.5 rounded-xl text-xs font-medium text-red-300 bg-red-500/10 border border-red-500/20 text-center animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className={`group w-full h-10 flex items-center justify-center px-4 rounded-xl text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-md active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${buttonClass}`}
      >
        {isLoading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Authenticating...
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            {buttonText}
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
          </span>
        )}
      </button>
    </form>
  );
};

export default Login;
