
import { InboundOrder, LeadTimeMetrics } from './warehouseData';

export const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

export const computeLeadTimeMetrics = (order: InboundOrder): LeadTimeMetrics => {
    const t0 = new Date(order.fecha_solicitud).getTime();
    const t1 = order.fecha_prometida ? new Date(order.fecha_prometida).getTime() : null;
    const t2 = order.fecha_recepcion_muelle ? new Date(order.fecha_recepcion_muelle).getTime() : null;
    const t3 = order.fecha_disponible_estanteria ? new Date(order.fecha_disponible_estanteria).getTime() : null;

    const toDays = (ms: number | null) => ms !== null ? parseFloat((ms / MILLISECONDS_IN_DAY).toFixed(2)) : null;

    // T_ext: Muelle - Solicitud
    const leadTimeExternal = (t2 && t0) ? (t2 - t0) : null;

    // T_int: Disponible - Muelle
    const leadTimeInternal = (t3 && t2) ? (t3 - t2) : null;

    // T_total: Disponible - Solicitud
    const leadTimeTotal = (t3 && t0) ? (t3 - t0) : null;

    // Deviation: Muelle - Prometida
    const deviation = (t2 && t1) ? (t2 - t1) : null;

    return {
        orderNumber: order.orderNumber,
        supplierName: order.supplierName,
        leadTimeTotalDays: toDays(leadTimeTotal),
        leadTimeExternalDays: toDays(leadTimeExternal),
        leadTimeInternalDays: toDays(leadTimeInternal),
        deviationDays: toDays(deviation),
        isLate: deviation ? deviation > 0 : false,
        isBottleneckInternal: leadTimeInternal ? (leadTimeTotal ? (leadTimeInternal / leadTimeTotal > 0.3) : false) : false
    };
};
