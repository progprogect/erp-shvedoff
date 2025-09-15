export const ORDER_STATUSES = {
  NEW: 'new',
  CONFIRMED: 'confirmed',
  IN_PRODUCTION: 'in_production',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.NEW]: 'Новый',
  [ORDER_STATUSES.CONFIRMED]: 'Подтверждён',
  [ORDER_STATUSES.IN_PRODUCTION]: 'В производстве',
  [ORDER_STATUSES.READY]: 'Готов к отгрузке',
  [ORDER_STATUSES.COMPLETED]: 'Отгружен',
  [ORDER_STATUSES.CANCELLED]: 'Отменён'
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.NEW]: '#1890ff',
  [ORDER_STATUSES.CONFIRMED]: '#13c2c2',
  [ORDER_STATUSES.IN_PRODUCTION]: '#fa8c16',
  [ORDER_STATUSES.READY]: '#52c41a',
  [ORDER_STATUSES.COMPLETED]: '#52c41a',
  [ORDER_STATUSES.CANCELLED]: '#ff4d4f'
};

// Валидные переходы между статусами
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUSES.NEW]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.IN_PRODUCTION, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.IN_PRODUCTION]: [ORDER_STATUSES.READY, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.READY]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.COMPLETED]: [], // финальный статус
  [ORDER_STATUSES.CANCELLED]: [] // финальный статус
};

// Функция для получения текста статуса
export const getOrderStatusText = (status: OrderStatus): string => {
  return ORDER_STATUS_LABELS[status] || status;
};

// Функция для получения цвета статуса
export const getOrderStatusColor = (status: OrderStatus): string => {
  return ORDER_STATUS_COLORS[status] || '#d9d9d9';
};
