import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserPortal } from './pages/UserPortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { PublicVerification } from './pages/PublicVerification';
import { PublicEventDownload } from './pages/PublicEventDownload';

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;