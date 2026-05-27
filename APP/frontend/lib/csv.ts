
import { HistoryEntry } from './warehouseData';

export const downloadHistoryCSV = (history: HistoryEntry[]) => {
  if (!history || history.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  // Definir cabeceras
  const headers = ['Fecha', 'Hora', 'Código Artículo', 'Acción', 'Origen', 'Destino', 'ID Evento'];

  // Convertir datos a filas CSV
  // Sanear campos para evitar CSV Injection y romper formato
  const sanitizeField = (value: any): string => {
    if (value === null || value === undefined) return '';
    let str = String(value).trim();

    // 1. Protección Anti-Injection: Si empieza por =, +, -, @, añadir ' delante
    if (/^[=+\-@]/.test(str)) {
      str = "'" + str;
    }

    // 2. Escapar comillas dobles (Excel usa "" para una comilla literal dentro de comillas)
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = history.map(entry => {
    const dateObj = new Date(entry.timestamp);
    const date = dateObj.toLocaleDateString('es-ES');
    const time = dateObj.toLocaleTimeString('es-ES');

    return [
      sanitizeField(date),
      sanitizeField(time),
      sanitizeField(entry.barcode),
      sanitizeField(translateAction(entry.action)),
      sanitizeField(entry.fromLocation || '-'),
      sanitizeField(entry.toLocation || '-'),
      sanitizeField(entry.id)
    ].join(',');
  });

  // Unir cabeceras y filas
  const csvContent = [headers.join(','), ...rows].join('\n');

  // Crear Blob con BOM para que Excel reconozca UTF-8
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Crear link de descarga
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `historial_almacen_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const translateAction = (action: string): string => {
  const map: Record<string, string> = {
    'assigned': 'Asignación',
    'relocated': 'Movimiento',
    'removed': 'Eliminación',
    'copied': 'Copia'
  };
  return map[action] || action;
};


