import React, { useState, useEffect } from 'react';
import { AgencyService, Agency } from '@/services/agencyService';
import { GuideService, Guide } from '@/services/guideService';
import { EmployeeService, Employee } from '@/services/employeeService';
import { api } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import LoadingSpinner from '@/components/Common/LoadingSpinner';

interface TourismSettingsProps {
  onDataLoaded?: (data: { agencies: Agency[]; guides: Guide[]; employees: Employee[] }) => void;
}

const TourismSettings: React.FC<TourismSettingsProps> = ({ onDataLoaded }) => {
  const { showSuccess, showError, showWarning } = useNotificationStore();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const loadTourismData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const check = await api.get('/meta/endpoints', { params: { base: '/guides', method: 'GET' } } as any);
        const eps = (check.data?.endpoints || check.data || []);
        if (!Array.isArray(eps) || eps.length === 0) {
          showWarning('Módulo de turismo no disponible');
          setAgencies([]);
          setGuides([]);
          setEmployees([]);
          setLoading(false);
          return;
        }
        
        const results = await Promise.allSettled([
          AgencyService.getActiveAgencies(),
          GuideService.getActiveGuides(),
          EmployeeService.listEmployees(),
        ]);

        const agList = results[0].status === 'fulfilled' ? results[0].value : [];
        const guList = results[1].status === 'fulfilled' ? results[1].value : [];
        const empList = results[2].status === 'fulfilled' ? results[2].value : [];

        // Limitar cantidad para evitar sobrecarga
        const MAX_ITEMS = 50;
        const limitedAgencies = agList.slice(0, MAX_ITEMS);
        const limitedGuides = Array.from(new Map(guList.map(g => [g.id, g])).values()).slice(0, MAX_ITEMS);
        const limitedEmployees = empList.slice(0, MAX_ITEMS);

        setAgencies(limitedAgencies);
        setGuides(limitedGuides);
        setEmployees(limitedEmployees);

        if (onDataLoaded) {
          onDataLoaded({
            agencies: limitedAgencies,
            guides: limitedGuides,
            employees: limitedEmployees
          });
        }

        if (results.some(r => r.status === 'rejected')) {
          showWarning('Algunos catálogos no se cargaron completamente.');
        } else {
          showSuccess('Datos de turismo cargados exitosamente.');
        }
      } catch (error) {
        console.error('Error cargando datos de turismo:', error);
        showError('Error al cargar datos de turismo');
      } finally {
        setLoading(false);
      }
    };

    loadTourismData();
  }, [onDataLoaded, showError, showSuccess, showWarning]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const results = await Promise.allSettled([
        AgencyService.getActiveAgencies(),
        GuideService.getActiveGuides(),
        EmployeeService.listEmployees(),
      ]);

      const agList = results[0].status === 'fulfilled' ? results[0].value : [];
      const guList = results[1].status === 'fulfilled' ? results[1].value : [];
      const empList = results[2].status === 'fulfilled' ? results[2].value : [];

      const MAX_ITEMS = 50;
      const limitedAgencies = agList.slice(0, MAX_ITEMS);
      const limitedGuides = Array.from(new Map(guList.map(g => [g.id, g])).values()).slice(0, MAX_ITEMS);
      const limitedEmployees = empList.slice(0, MAX_ITEMS);

      setAgencies(limitedAgencies);
      setGuides(limitedGuides);
      setEmployees(limitedEmployees);

      if (onDataLoaded) {
        onDataLoaded({
          agencies: limitedAgencies,
          guides: limitedGuides,
          employees: limitedEmployees
        });
      }

      if (results.some(r => r.status === 'rejected')) {
        showWarning('Algunos catálogos no se sincronizaron completamente.');
      } else {
        showSuccess('Datos de turismo sincronizados exitosamente.');
      }
    } catch (error) {
      console.error('Error sincronizando datos de turismo:', error);
      showError('Error al sincronizar datos de turismo');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Cargando datos de turismo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Gestión de Turismo</h3>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing && <LoadingSpinner size="sm" className="mr-2" />}
          Sincronizar Datos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agencias */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Agencias ({agencies.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {agencies.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay agencias activas</p>
            ) : (
              agencies.map((agency) => (
                <div key={agency.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{agency.name}</p>
                    <p className="text-xs text-gray-500">{agency.code}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    agency.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {agency.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Guías */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Guías ({guides.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {guides.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay guías activos</p>
            ) : (
              guides.map((guide) => (
                <div key={guide.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{guide.name}</p>
                    <p className="text-xs text-gray-500">{guide.code}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    guide.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {guide.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Empleados */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Empleados ({employees.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay empleados activos</p>
            ) : (
              employees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                    <p className="text-xs text-gray-500">{employee.code}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {employee.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourismSettings;