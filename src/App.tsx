import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { UserPortal } from './pages/UserPortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { PublicVerification } from './pages/PublicVerification';
import { PublicEventDownload } from './pages/PublicEventDownload';

function App() {
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