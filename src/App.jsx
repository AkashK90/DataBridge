import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DevDashboard from './pages/DevDashboard';
import ClientViewer from './pages/ClientViewer';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DevDashboard />} />
        <Route path="/viewer" element={<ClientViewer />} />
      </Routes>
    </BrowserRouter>
  );
}
