import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { UserPortal } from './pages/UserPortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { PublicVerification } from './pages/PublicVerification';
import { PublicEventDownload } from './pages/PublicEventDownload';

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
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center font-sans">
          <h2 className="text-base font-bold text-slate-900">Kuch galat ho gaya / Something went wrong</h2>
          <p className="text-xs text-slate-600 max-w-md break-words">
            {this.state.error.message || 'Unexpected error while loading this page.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-100 selection:bg-emerald-800 selection:text-white">
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
  );
}

export default App;