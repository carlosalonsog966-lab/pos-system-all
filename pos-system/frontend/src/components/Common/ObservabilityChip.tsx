import React from 'react';

type ObservabilityChipProps = {
  label: string;
  value: number;
  warnKey?: string; // e.g., 'SALES_WARN_COUNT'
  critKey?: string; // e.g., 'SALES_CRIT_COUNT'
  unit?: string; // e.g., 'ms'
  title?: string; // tooltip
};

const ObservabilityChip: React.FC<ObservabilityChipProps> = ({ label, value, warnKey, critKey, unit = '', title }) => {
  const readOverridesObject = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem('observability:thresholdOverrides') || '{}') || {}; } catch { return {}; }
  };
  const overridesObj = readOverridesObject();

  const readLocalKey = (key?: string): number | undefined => {
    if (!key) return undefined;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    } catch { return undefined; }
  };

  const readEnvNum = (key?: string): number | undefined => {
    if (!key) return undefined;
    try { const v = (import.meta as any).env?.[`VITE_${key}`]; const n = Number(v ?? NaN); return Number.isFinite(n) ? n : undefined; } catch { return undefined; }
  };

  const warnLocal = readLocalKey(warnKey);
  const critLocal = readLocalKey(critKey);
  const warn = (typeof warnLocal === 'number') ? warnLocal : ((warnKey && typeof overridesObj[warnKey] === 'number') ? overridesObj[warnKey] : readEnvNum(warnKey));
  const crit = (typeof critLocal === 'number') ? critLocal : ((critKey && typeof overridesObj[critKey] === 'number') ? overridesObj[critKey] : readEnvNum(critKey));

  let cls = 'text-gray-700 bg-gray-50 border-gray-200';
  let labelTip = '';
  if (typeof crit === 'number' && value >= crit) { cls = 'text-red-700 bg-red-50 border-red-200'; labelTip = 'Crítico'; }
  else if (typeof warn === 'number' && value >= warn) { cls = 'text-yellow-700 bg-yellow-50 border-yellow-200'; labelTip = 'Warn'; }

  const sourceNote = (typeof warnLocal === 'number' || typeof critLocal === 'number')
    ? 'override local'
    : (typeof overridesObj[warnKey || ''] === 'number' || typeof overridesObj[critKey || ''] === 'number')
      ? 'preset'
      : 'env';
  const tooltip = title || (warnKey && critKey
    ? `Valor: ${value}${unit ? unit : ''} · warn≥${warn ?? '—'}${unit} · crit≥${crit ?? '—'}${unit} · fuente: ${sourceNote}`
    : `Valor: ${value}${unit}`);

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${cls}`} title={labelTip ? `${labelTip} · ${tooltip}` : tooltip}>
      <span className="font-mono">{label}</span>
      <span className="font-semibold">{value}{unit}</span>
    </span>
  );
};

export default ObservabilityChip;
