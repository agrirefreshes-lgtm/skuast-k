import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { UserPortal } from './pages/UserPortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { PublicVerification } from './pages/PublicVerification';
import { PublicEventDownload } from './pages/PublicEventDownload';

function App() {
  // Basic security measures to deter casual inspection
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-100 selection:bg-emerald-800 selection:text-white">
        {/* Universal University Header */}
        <Navbar />

        {/* Dynamic Page Views */}
        <main className="flex-1">
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
        </main>

        {/* Universal University Footer */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;