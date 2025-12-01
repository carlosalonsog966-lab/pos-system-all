import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  XMarkIcon,
  QrCodeIcon,
  CloudArrowUpIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  QueueListIcon,
  Cog8ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requiredRoles?: string[];
}

// Navegación principal (visible para todos con permisos básicos)
const primaryNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Ventas', href: '/sales', icon: ShoppingCartIcon },
  { name: 'Caja', href: '/cash-register', icon: CreditCardIcon },
  { name: 'Joyas', href: '/products', icon: CubeIcon },
  { name: 'Inventario', href: '/inventory', icon: ClipboardDocumentListIcon },
  { name: 'Clientes', href: '/clients', icon: UserGroupIcon },
  { name: 'Códigos QR/Barras', href: '/codes', icon: QrCodeIcon },
  { 
    name: 'Rankings', 
    href: '/rankings', 
    icon: TrophyIcon,
    requiredRoles: ['admin', 'manager', 'employee']
  },
];

// Sección de administración: agrupa enlaces avanzados
const adminNavigation: NavigationItem[] = [
  {
    name: 'Usuarios',
    href: '/users',
    icon: UsersIcon,
    requiredRoles: ['admin', 'manager']
  },
  {
    name: 'Reportes',
    href: '/reports',
    icon: ChartBarIcon,
    requiredRoles: ['admin', 'manager']
  },
  {
    name: 'Configuración',
    href: '/settings',
    icon: CogIcon,
    requiredRoles: ['admin']
  },
  {
    name: 'Respaldos',
    href: '/backup',
    icon: CloudArrowUpIcon,
    requiredRoles: ['admin']
  },
  {
    name: 'Observabilidad',
    href: '/observability',
    icon: ExclamationTriangleIcon,
    requiredRoles: ['admin', 'manager']
  },
  {
    name: 'Salud',
    href: '/observability/health',
    icon: ExclamationTriangleIcon,
    requiredRoles: ['admin', 'manager']
  },
  {
    name: 'Jobs',
    href: '/jobs',
    icon: QueueListIcon,
    requiredRoles: ['admin', 'manager']
  },
  {
    name: 'Driver Dual Test',
    href: '/dual-driver-test',
    icon: Cog8ToothIcon,
    requiredRoles: ['admin']
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  mobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ open = true, onClose, mobile = false }) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [adminOpen, setAdminOpen] = React.useState(true);

  const filteredPrimary = primaryNavigation.filter(item => {
    if (!item.requiredRoles) return true;
    return user && item.requiredRoles.includes(user.role);
  });

  const filteredAdmin = adminNavigation.filter(item => {
    if (!item.requiredRoles) return true;
    return user && item.requiredRoles.includes(user.role);
  });

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <span className="ml-3 text-white font-semibold text-lg">
            Joyería POS
          </span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex flex-1 flex-col px-6 pb-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {filteredPrimary.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      data-testid={`nav-${item.href.replace(/^\//,'').replace(/\//g,'-')}`}
                      onClick={mobile ? onClose : undefined}
                      className={`
                        group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-200
                        ${isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }
                      `}
                    >
                      <item.icon
                        className={`h-6 w-6 shrink-0 ${
                          isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                        }`}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>

          {/* Sección Administrador */}
          {filteredAdmin.length > 0 && (
            <li>
              <div
                className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mt-4 mb-2"
              >
                <span>Administrador</span>
                <button
                  type="button"
                  onClick={() => setAdminOpen(!adminOpen)}
                  className="text-gray-400 hover:text-white"
                  aria-label={adminOpen ? 'Cerrar sección Administrador' : 'Abrir sección Administrador'}
                >
                  {adminOpen ? (
                    <span className="inline-block">−</span>
                  ) : (
                    <span className="inline-block">+</span>
                  )}
                </button>
              </div>
              {adminOpen && (
                <ul role="list" className="-mx-2 space-y-1">
                  {filteredAdmin.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          data-testid={`nav-${item.href.replace(/^\//,'').replace(/\//g,'-')}`}
                          onClick={mobile ? onClose : undefined}
                          className={`
                            group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-200
                            ${isActive
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }
                          `}
                        >
                          <item.icon
                            className={`h-6 w-6 shrink-0 ${
                              isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                            }`}
                          />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          )}
        </ul>
      </nav>

      {/* Información del usuario */}
      <div className="px-6 pb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-400 capitalize">
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <Transition.Root show={open} as={React.Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose || (() => {})}>
          <Transition.Child
            as={React.Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={React.Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={React.Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={onClose}
                    >
                      <span className="sr-only">Cerrar sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    );
  }

  return <SidebarContent />;
};

export default Sidebar;
