import React from 'react';
import { CircleHelp, Monitor, Tablet, Truck, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  KIOSK: Tablet,
  CARRETILLERO: Truck,
  ADMIN: Monitor,
};

/** Icono (Lucide) del tipo de dispositivo en los paneles de conexiones / WiFi. */
const DeviceTypeIcon: React.FC<{ type?: string; className?: string }> = ({ type, className = 'w-5 h-5' }) => {
  const Icon = (type && ICONS[type]) || CircleHelp;
  return <Icon className={`inline-block shrink-0 text-slate-400 ${className}`} aria-label={type || 'Desconocido'} />;
};

export default DeviceTypeIcon;
