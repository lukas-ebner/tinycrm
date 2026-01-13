import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutGrid,
  Users,
  Settings,
  Upload,
  LogOut,
  List,
  Columns3,
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    { path: '/leads', label: 'Leads (List)', icon: List },
    { path: '/kanban', label: 'Kanban', icon: Columns3 },
  ];

  const adminItems = [
    { path: '/users', label: 'Users', icon: Users },
    { path: '/stages', label: 'Stages', icon: LayoutGrid },
    { path: '/custom-fields', label: 'Custom Fields', icon: Settings },
    { path: '/import', label: 'CSV Import', icon: Upload },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 shadow-md">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-amber-600">tinyCRM</h1>
          <p className="text-sm text-gray-600 mt-1">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.role}</p>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                  isActive(item.path)
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase px-3">
                  Admin
                </p>
              </div>
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                      isActive(item.path)
                        ? 'bg-amber-600 text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-200 w-full transition-colors duration-150"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
