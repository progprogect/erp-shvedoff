export const SHIPMENT_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused'
} as const;

export type ShipmentStatus = typeof SHIPMENT_STATUSES[keyof typeof SHIPMENT_STATUSES];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  [SHIPMENT_STATUSES.PENDING]: 'В очереди',
  [SHIPMENT_STATUSES.COMPLETED]: 'Выполнена',
  [SHIPMENT_STATUSES.CANCELLED]: 'Отменена',
  [SHIPMENT_STATUSES.PAUSED]: 'На паузе'
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  [SHIPMENT_STATUSES.PENDING]: '#1890ff',
  [SHIPMENT_STATUSES.COMPLETED]: '#52c41a',
  [SHIPMENT_STATUSES.CANCELLED]: '#f5222d',
  [SHIPMENT_STATUSES.PAUSED]: '#fa8c16'
};

// Валидные переходы между статусами
export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [SHIPMENT_STATUSES.PENDING]: [SHIPMENT_STATUSES.COMPLETED, SHIPMENT_STATUSES.CANCELLED, SHIPMENT_STATUSES.PAUSED],
  [SHIPMENT_STATUSES.PAUSED]: [SHIPMENT_STATUSES.PENDING, SHIPMENT_STATUSES.CANCELLED],
  [SHIPMENT_STATUSES.COMPLETED]: [], // финальный статус
  [SHIPMENT_STATUSES.CANCELLED]: [] // финальный статус
}; 