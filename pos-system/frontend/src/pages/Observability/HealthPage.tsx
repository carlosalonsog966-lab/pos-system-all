import React from "react";
import HealthPanel from "../../components/Observability/HealthPanel";

export function HealthPage() {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Salud</h1>
        <p className="text-gray-600 text-sm">Estado integral del sistema y métricas de observabilidad.</p>
      </div>
      <HealthPanel />
    </div>
  );
}
export default HealthPage;
