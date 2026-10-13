import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { UserPortal } from './pages/UserPortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { PublicVerification } from './pages/PublicVerification';
import { PublicEventDownload } from './pages/PublicEventDownload';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { PromptProvider } from './components/PromptDialog';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Prevents a fully blank/white screen if any page throws during render.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 font-sans">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Something went wrong</h2>
              <p className="text-sm text-slate-500">
                An unexpected error interrupted this page. Your data is safe — please reload to continue.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Error detail</p>
              <p className="text-xs text-slate-600 font-mono break-words">
                {this.state.error.message || 'Unknown error'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f5132] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <PromptProvider>
          <Router>
            <div className="min-h-screen flex flex-col app-aurora selection:bg-emerald-800 selection:text-white">
              {/* Universal University Header */}
              <Navbar />

              {/* Dynamic Page Views */}
              <main className="flex-1">
                <ErrorBoundary>
                  <Routes>
                    {/* Main University Home Search */}
                    <Route path="/" element={<UserPortal />} />

                    {/* Dedicated Public Event Slug Landing Page */}
                    <Route path="/event/:eventSlug" element={<PublicEventDownload />} />

                    {/* Admin Dashboard */}
                    <Route path="/admin" element={<AdminDashboard />} />

                    {/* QR Scan Verification Gateway */}
                    <Route path="/verify" element={<PublicVerification />} />
                  </Routes>
                </ErrorBoundary>
              </main>

              {/* Universal University Footer */}
              <Footer />
            </div>
          </Router>
        </PromptProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;