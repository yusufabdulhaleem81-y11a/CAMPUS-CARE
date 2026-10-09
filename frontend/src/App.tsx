import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth, homeForRole } from './lib/auth';
import type { Role } from './lib/auth';
import { Loading } from './components/ui';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import EmergencyRequest from './pages/EmergencyRequest';

import PortalHome from './pages/PortalHome';
import BookAppointment from './pages/BookAppointment';
import PortalVisits from './pages/PortalVisits';
import PortalResults from './pages/PortalResults';
import PortalMore from './pages/PortalMore';

import Reception from './pages/Reception';
import Queue from './pages/Queue';
import PatientFiles from './pages/PatientFiles';
import Encounter from './pages/Encounter';
import Lab from './pages/Lab';
import Pharmacy from './pages/Pharmacy';
import EmergencyBoard from './pages/EmergencyBoard';
import StaffRoom from './pages/StaffRoom';
import Management from './pages/Management';
import Surveillance from './pages/Surveillance';
import Admin from './pages/Admin';

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={homeForRole[profile.role]} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/emergency-request" element={<EmergencyRequest />} />

          <Route path="/portal" element={<RequireAuth roles={['student']}><PortalHome /></RequireAuth>} />
          <Route path="/portal/book" element={<RequireAuth roles={['student']}><BookAppointment /></RequireAuth>} />
          <Route path="/portal/visits" element={<RequireAuth roles={['student']}><PortalVisits /></RequireAuth>} />
          <Route path="/portal/results" element={<RequireAuth roles={['student']}><PortalResults /></RequireAuth>} />
          <Route path="/portal/more" element={<RequireAuth roles={['student']}><PortalMore /></RequireAuth>} />

          <Route path="/reception" element={<RequireAuth roles={['receptionist', 'admin', 'super_admin']}><Reception /></RequireAuth>} />
          <Route path="/queue" element={<RequireAuth roles={['receptionist', 'nurse', 'doctor', 'admin', 'super_admin']}><Queue /></RequireAuth>} />
          <Route path="/patients" element={<RequireAuth><PatientFiles /></RequireAuth>} />
          <Route path="/encounters/:id" element={<RequireAuth><Encounter /></RequireAuth>} />
          <Route path="/lab" element={<RequireAuth roles={['laboratory', 'doctor', 'admin', 'super_admin']}><Lab /></RequireAuth>} />
          <Route path="/pharmacy" element={<RequireAuth roles={['pharmacist', 'admin', 'super_admin']}><Pharmacy /></RequireAuth>} />
          <Route path="/emergency" element={<RequireAuth><EmergencyBoard /></RequireAuth>} />
          <Route path="/staff-room" element={<RequireAuth><StaffRoom /></RequireAuth>} />
          <Route path="/management" element={<RequireAuth roles={['hospital_head', 'admin', 'super_admin']}><Management /></RequireAuth>} />
          <Route path="/surveillance" element={<RequireAuth roles={['hospital_head', 'admin', 'super_admin']}><Surveillance /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin', 'super_admin']}><Admin /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
