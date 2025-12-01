import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Cerrar sidebar móvil al navegar para evitar overlays persistentes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar para móvil */}
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        mobile
      />

      {/* Sidebar para desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="lg:pl-64 h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
        </div>

        {/* Contenido de la página (scrollable) */}
        <main className="flex-1 overflow-auto py-4 sm:py-6">
          <div className="mx-auto max-w-full px-3 sm:px-6 lg:px-8 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
