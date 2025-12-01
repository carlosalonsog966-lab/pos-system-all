import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import Modal from '@/components/Modal';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import { UserService, type User, type UserRole } from '@/services/userService';
import { initializeApiBaseUrl, backendStatus } from '@/lib/api';
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  PowerIcon,
  KeyIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const DEFAULT_PAGE_SIZE = 10;

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Cajero',
};

type UsersPageProps = { testMode?: boolean };

export default function UsersPage({ testMode = false }: UsersPageProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const roleAvatarClasses: Record<UserRole, string> = {
    admin: 'bg-blue-100 text-blue-700',
    manager: 'bg-amber-100 text-amber-700',
    cashier: 'bg-emerald-100 text-emerald-700',
  };

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<null | User>(null);
  const [showReset, setShowReset] = useState<null | User>(null);
  const [showDelete, setShowDelete] = useState<null | User>(null);
  const [showBulkDeactivate, setShowBulkDeactivate] = useState(false);
  // Salud del backend para deshabilitar acciones de escritura/exportación
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');

  const queryParams = useMemo(() => ({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: search.trim() || undefined,
    role: role || undefined,
    isActive: activeOnly ? true : undefined,
  }), [page, search, role, activeOnly]);

  const loadUsers = React.useCallback(async () => {
    let mounted = true;
    setLoading(true);
    setError(null);
    try {
      const res = await UserService.getUsers(queryParams);
      if (!mounted) return;
      setItems(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (e: unknown) {
      if (!mounted) return;
      const err = e as { response?: { status?: number; statusText?: string; data?: { error?: string; message?: string } }; config?: { url?: string; baseURL?: string }; message?: string };
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const backendMsg = err?.response?.data?.error || err?.response?.data?.message;
      const path = err?.config?.url || '/users';
      const base = String(err?.config?.baseURL || '');
      const fullUrl = base ? `${base}${path}` : path;
      if (status === 404) {
        setError(`No se encontró el recurso (${fullUrl}). HTTP 404${statusText ? ` - ${statusText}` : ''}${backendMsg ? `: ${backendMsg}` : ''}`);
      } else {
        setError(err?.message || 'Error al cargar usuarios');
      }
    } finally {
      setLoading(false);
    }
    return () => { mounted = false; };
  }, [queryParams]);

  useEffect(() => {
    if (testMode) return; // evitar carga inicial en modo test
    let cancelled = false;
    (async () => {
      try { await initializeApiBaseUrl(); } catch (e: unknown) { console.debug('initializeApiBaseUrl falló en UsersPage', e); }
      if (!cancelled) await loadUsers();
    })();
    return () => { cancelled = true; };
  }, [loadUsers, testMode]);

  // Monitorear salud del backend y deshabilitar acciones sensibles en modo degradado/caído
  useEffect(() => {
    const cb = (st: 'ok' | 'no_health' | 'down') => setBackendHealthMode(st);
    try {
      if (typeof (backendStatus as any)?.onStatus === 'function') {
        (backendStatus as any).onStatus(cb);
      }
      if (typeof (backendStatus as any)?.startPolling === 'function') {
        (backendStatus as any).startPolling(60000);
      }
    } catch {}
    return () => {
      try {
        if (typeof (backendStatus as any)?.offStatus === 'function') {
          (backendStatus as any).offStatus(cb);
        }
      } catch {}
    };
  }, []);

  const handleRetry = () => {
    loadUsers();
  };

  const refreshList = async () => {
    const res = await UserService.getUsers(queryParams);
    setItems(res.data);
    setTotalPages(res.pagination.totalPages);
  };

  const handleCreate = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    // Permitir creación incluso con backend degradado, pero con advertencia
    if (backendHealthMode === 'down') {
      setError('⚠️ El servidor está experimentando problemas. La operación puede tardar más de lo usual.');
      // Continuar con la operación en lugar de bloquear
    }
    const fd = new FormData(evt.currentTarget);
    const payload = {
      username: String(fd.get('username') || ''),
      email: String(fd.get('email') || ''),
      password: String(fd.get('password') || ''),
      role: String(fd.get('role') || 'cashier') as UserRole,
    };
    try {
      setLoading(true);
      const created = await UserService.createUser(payload);
      // Subida de avatar si se seleccionó una imagen
      const avatarEntry = fd.get('avatar');
      const avatarFile = (avatarEntry instanceof File) ? avatarEntry : null;
      if (avatarFile && created?.id) {
        try {
          await UserService.uploadAvatar(created.id, avatarFile);
        } catch (e: unknown) {
          console.warn('No se pudo subir el avatar en creación:', e);
        }
      }
      setShowCreate(false);
      // Refrescar lista
      await refreshList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'No se pudo crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!showEdit) return;
    if (!isAdmin) {
      setError('Solo el administrador puede editar usuarios');
      return;
    }
    // Permitir edición incluso con backend degradado, pero con advertencia
    if (backendHealthMode === 'down') {
      setError('⚠️ El servidor está experimentando problemas. La operación puede tardar más de lo usual.');
      // Continuar con la operación en lugar de bloquear
    }
    const fd = new FormData(evt.currentTarget);
    const payload = {
      username: String(fd.get('username') || ''),
      email: String(fd.get('email') || ''),
      password: (() => {
        if (!isAdmin) return undefined; // Solo admin puede cambiar contraseña
        const p1 = String(fd.get('password') || '');
        const p2 = String(fd.get('confirmPassword') || '');
        if (!p1 && !p2) return undefined; // no cambiar contraseña
        if (p1.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          return undefined;
        }
        if (p1 !== p2) {
          setError('Las contraseñas no coinciden');
          return undefined;
        }
        return p1;
      })(),
      role: String(fd.get('role') || showEdit.role) as UserRole,
      isActive: fd.get('isActive') ? true : false,
    };
    try {
      setLoading(true);
      await UserService.updateUser(showEdit.id, payload);
      // Subida de avatar si se seleccionó una imagen
      const avatarEntry = fd.get('avatar');
      const avatarFile = (avatarEntry instanceof File) ? avatarEntry : null;
      if (avatarFile) {
        try {
          await UserService.uploadAvatar(showEdit.id, avatarFile);
        } catch (e) {
          console.warn('No se pudo subir el avatar en edición:', e);
        }
      }
      setShowEdit(null);
      await refreshList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'No se pudo actualizar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!isAdmin || !showDelete) return;
    // Permitir eliminación incluso con backend degradado, pero con advertencia
    if (backendHealthMode === 'down') {
      setError('⚠️ El servidor está experimentando problemas. La operación puede tardar más de lo usual.');
      // Continuar con la operación en lugar de bloquear
    }
    try {
      setLoading(true);
      await UserService.deleteUser(showDelete.id);
      setShowDelete(null);
      await refreshList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'No se pudo eliminar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeactivateConfirmed = async () => {
    if (!isAdmin) return;
    // Permitir desactivación masiva incluso con backend degradado, pero con advertencia
    if (backendHealthMode === 'down') {
      setError('⚠️ El servidor está experimentando problemas. La operación puede tardar más de lo usual.');
      // Continuar con la operación en lugar de bloquear
    }
    try {
      setLoading(true);
      await UserService.bulkDeactivateNonAdmin();
      setShowBulkDeactivate(false);
      await refreshList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'No se pudo desactivar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (u: User) => {
    if (!isAdmin) return;
    // Permitir cambio de estado incluso con backend degradado, pero con advertencia
    if (backendHealthMode === 'down') {
      setError('⚠️ El servidor está experimentando problemas. La operación puede tardar más de lo usual.');
      // Continuar con la operación en lugar de bloquear
    }
    try {
      setLoading(true);
      await UserService.setStatus(u.id, !u.isActive);
      const res = await UserService.getUsers(queryParams);
      setItems(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'No se pudo cambiar el estado');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!showReset) return;
    // Permitir reseteo de contraseña incluso con backend degradado, pero con advertencia
    if (backendHealthMode === 'down') {
      setError('⚠️ El servidor está experimentando problemas. La operación puede tardar más de lo usual.');
      // Continuar con la operación en lugar de bloquear
    }
    const fd = new FormData(evt.currentTarget);
    const newPassword = String(fd.get('newPassword') || '');
    const confirm = String(fd.get('confirmNewPassword') || '');
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    try {
      setLoading(true);
      await UserService.resetPassword(showReset.id, newPassword);
      setShowReset(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'No se pudo resetear la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión de usuarios del sistema</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              disabled={false} // Siempre habilitado
              title={backendHealthMode === 'down' ? '⚠️ El servidor tiene problemas - use con precaución' : 'Crear usuario'}
            >
              <PlusIcon className="h-5 w-5" />
              Nuevo Usuario
            </button>
            <button
              onClick={() => setShowBulkDeactivate(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
              title="Desactivar usuarios no admin"
              disabled={false} // Siempre habilitado
              aria-disabled={false}
            >
              <TrashIcon className="h-5 w-5" />
              Eliminar no admin
            </button>
          </div>
        )}
      </div>

      {/* Banner de salud del backend para escrituras - Mensaje más amigable */}
      {backendHealthMode !== 'ok' && (
        <div className={`mt-2 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
          {backendHealthMode === 'down' ? '⚠️ El servidor está experimentando problemas. Las operaciones pueden tardar más de lo usual.' : 'ℹ️ Conexión al servidor inestable. Las operaciones están disponibles pero pueden ser lentas.'}
        </div>
      )}

      {/* Filtros */}
      <div className="mt-4 bg-white p-4 rounded-lg shadow-sm border">
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start justify-between">
            <div>
              <div className="font-medium">Error: {error}</div>
              <div className="text-red-600 mt-1">Sugerencia: verifica conexión al backend y tus permisos (Admin/Manager).</div>
            </div>
            <button
              onClick={handleRetry}
              className="ml-4 inline-flex items-center px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por usuario o email"
              className="w-full pl-10 pr-3 py-2 border rounded-md"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            />
          </div>
          <div>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={role}
              onChange={(e) => { setPage(1); setRole(e.target.value as UserRole | ''); }}
            >
              <option value="">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="cashier">Cajero</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => { setPage(1); setActiveOnly(e.target.checked); }}
            />
            Solo activos
          </label>
        </div>
      </div>

      {/* Tabla (oculta si hay error) */}
      {!error && (
        <div className="mt-4 bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Usuario</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                  {isAdmin && (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rol</th>
                  )}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Último acceso</th>
                  {isAdmin && (
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.username}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${roleAvatarClasses[u.role]}`}
                            title={u.username}
                          >
                            {(u.username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 leading-tight">{u.username}</span>
                          {/* Se puede mostrar info secundaria aquí si se desea */}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{u.email}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-sm text-gray-700">{roleLabels[u.role]}</td>
                    )}
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setShowEdit(u)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:text-blue-800"
                            title="Editar"
                            disabled={backendHealthMode !== 'ok'}
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-gray-700 hover:text-gray-900"
                            title={u.isActive ? 'Desactivar' : 'Activar'}
                            disabled={backendHealthMode !== 'ok'}
                          >
                            <PowerIcon className="h-5 w-5" />
                            {u.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => setShowReset(u)}
                            className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-amber-600 hover:text-amber-800"
                            title="Resetear contraseña"
                            disabled={backendHealthMode !== 'ok'}
                          >
                            <KeyIcon className="h-5 w-5" />
                            Reset
                          </button>
                          <button
                            onClick={() => setShowDelete(u)}
                            className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-800"
                            title="Eliminar usuario"
                            disabled={backendHealthMode !== 'ok'}
                          >
                            <TrashIcon className="h-5 w-5" />
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex justify-between items-center p-3">
            <div className="text-sm text-gray-600">Página {page} de {totalPages}</div>
            <div className="space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`px-3 py-1 rounded border ${page <= 1 ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >Anterior</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={`px-3 py-1 rounded border ${page >= totalPages ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {/* Estados globales */}
      {loading && (
        <div className="mt-4">
          <LoadingSpinner />
        </div>
      )}
      {/* Nota: evitamos duplicar error; el mensaje superior ya lo muestra */}

      {/* Modal crear */}
      {showCreate && (
        <Modal isOpen={showCreate} title="Crear Usuario" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <input name="username" placeholder="Usuario" className="w-full border rounded px-3 py-2" required />
            <input name="email" type="email" placeholder="Email" className="w-full border rounded px-3 py-2" required />
            <input name="password" type="password" placeholder="Contraseña" className="w-full border rounded px-3 py-2" required />
            <select name="role" className="w-full border rounded px-3 py-2" defaultValue="cashier">
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="cashier">Cajero</option>
            </select>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Foto (opcional)</label>
              <input name="avatar" type="file" accept="image/*" className="w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 border rounded">Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white" disabled={false} title={backendHealthMode === 'down' ? '⚠️ El servidor tiene problemas - use con precaución' : 'Crear'}>Crear</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal editar */}
      {showEdit && (
        <Modal isOpen={!!showEdit} title="Editar Usuario" onClose={() => setShowEdit(null)}>
          <form onSubmit={handleEdit} className="space-y-3">
            <input name="username" defaultValue={showEdit.username} placeholder="Usuario" className="w-full border rounded px-3 py-2" required />
            <input name="email" type="email" defaultValue={showEdit.email} placeholder="Email" className="w-full border rounded px-3 py-2" required />
            {/* Cambio de contraseña opcional (solo admin) */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input name="password" type="password" placeholder="Nueva contraseña (opcional)" className="w-full border rounded px-3 py-2" />
                <input name="confirmPassword" type="password" placeholder="Confirmar contraseña" className="w-full border rounded px-3 py-2" />
              </div>
            )}
            <select name="role" defaultValue={showEdit.role} className="w-full border rounded px-3 py-2">
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="cashier">Cajero</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked={showEdit.isActive} />
              Activo
            </label>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Nueva foto (opcional)</label>
              <input name="avatar" type="file" accept="image/*" className="w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowEdit(null)} className="px-3 py-2 border rounded">Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white" disabled={false} title={backendHealthMode === 'down' ? '⚠️ El servidor tiene problemas - use con precaución' : 'Guardar'}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal reset password */}
      {showReset && (
        <Modal isOpen={!!showReset} title="Resetear Contraseña" onClose={() => setShowReset(null)}>
          <form onSubmit={handleResetPassword} className="space-y-3">
            <p className="text-sm text-gray-700">Usuario: <strong>{showReset.username}</strong></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input name="newPassword" type="password" placeholder="Nueva contraseña" className="w-full border rounded px-3 py-2" required />
              <input name="confirmNewPassword" type="password" placeholder="Confirmar contraseña" className="w-full border rounded px-3 py-2" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowReset(null)} className="px-3 py-2 border rounded">Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-amber-600 text-white" disabled={false} title={backendHealthMode === 'down' ? '⚠️ El servidor tiene problemas - use con precaución' : 'Resetear'}>Resetear</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmación eliminar usuario */}
      {showDelete && (
        <ConfirmationModal
          isOpen={!!showDelete}
          title="Eliminar Usuario"
          message={`¿Seguro que deseas eliminar a "${showDelete.username}"? Se desactivará su cuenta.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={handleDeleteConfirmed}
          onClose={() => setShowDelete(null)}
        />
      )}

      {/* Confirmación desactivar no admin */}
      {showBulkDeactivate && (
        <ConfirmationModal
          isOpen={showBulkDeactivate}
          title="Eliminar Usuarios No Admin"
          message="¿Seguro que deseas desactivar todas las cuentas que no son Administrador?"
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={handleBulkDeactivateConfirmed}
          onClose={() => setShowBulkDeactivate(false)}
        />
      )}
    </div>
  );
}
