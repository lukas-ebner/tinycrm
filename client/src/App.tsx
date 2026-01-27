import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import LeadsPage from './pages/LeadsPage';
import KanbanPage from './pages/KanbanPage';
import LeadDetailPage from './pages/LeadDetailPage';
import UsersPage from './pages/UsersPage';
import StagesPage from './pages/StagesPage';
import CustomFieldsPage from './pages/CustomFieldsPage';
import PromoCodesPage from './pages/PromoCodesPage';
import ImportPage from './pages/ImportPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/leads" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/leads" replace /> : <LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/leads" replace />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="kanban" element={<KanbanPage />} />

        {/* Admin-only routes */}
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="stages"
          element={
            <AdminRoute>
              <StagesPage />
            </AdminRoute>
          }
        />
        <Route
          path="custom-fields"
          element={
            <AdminRoute>
              <CustomFieldsPage />
            </AdminRoute>
          }
        />
        <Route
          path="promo-codes"
          element={
            <AdminRoute>
              <PromoCodesPage />
            </AdminRoute>
          }
        />
        <Route
          path="import"
          element={
            <AdminRoute>
              <ImportPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/leads" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
