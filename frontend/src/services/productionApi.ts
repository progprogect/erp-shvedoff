import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../config/api';
import axios from 'axios'; // Added for searchProducts

// Функция для получения токена
const getToken = () => {
  return useAuthStore.getState().token;
};

// Типы для производственных заданий
export interface ProductionTask {
  id: number;
  orderId?: number;
  productId: number;
  requestedQuantity: number;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  priority: number;
  sortOrder: number;
  // Планирование производства
  plannedStartDate?: string; // дата начала производства
  plannedEndDate?: string; // дата завершения производства
  planningStatus?: 'draft' | 'confirmed' | 'started' | 'completed'; // статус планирования
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  producedQuantity: number;
  qualityQuantity: number;
  defectQuantity: number;
  createdBy?: number;
  assignedTo?: number;
  startedBy?: number;
  completedBy?: number;
  cancelledBy?: number;
  cancelReason?: string;
  notes?: string;
  updatedAt: string;
  
  // Relations
  order?: {
    id: number;
    orderNumber: string;
    customerName: string;
    priority: string;
    deliveryDate?: string;
  };
  product: {
    id: number;
    name: string;
    code?: string;
    article?: string;
    productType?: 'carpet' | 'other' | 'pur' | 'roll_covering';
    category: {
      id: number;
      name: string;
    };
    surface?: {
      id: number;
      name: string;
    };
    logo?: {
      id: number;
      name: string;
    };
    material?: {
      id: number;
      name: string;
    };
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
    };
    weight?: number;
    grade?: 'usual' | 'premium';
    borderType?: 'with_border' | 'without_border';
    matArea?: number;
    puzzleOptions?: {
      sides?: '1_side' | '2_sides';
      type?: 'old' | 'new';
      enabled?: boolean;
    };
    // Дополнительные характеристики для ковров
    carpetEdgeType?: 'straight_cut' | 'overlock' | 'binding';
    carpetEdgeSides?: number;
    carpetEdgeStrength?: 'normal' | 'high' | 'low';
    bottomType?: {
      id: number;
      name: string;
    };
    // Характеристики для рулонных покрытий
    rollComposition?: Array<{
      carpet: {
        id: number;
        name: string;
      };
      quantity: number;
      sortOrder: number;
    }>;
    // Дополнительные поля
    pressType?: 'not_selected' | 'hydraulic' | 'mechanical';
    // Поля паззла из БД
    puzzleType?: {
      id: number;
      name: string;
      code: string;
    };
    puzzleSides?: number;
    tags?: string[];
    notes?: string;
    manager?: {
      id: number;
      username: string;
      fullName: string;
    };
  };
  createdByUser?: {
    id: number;
    username: string;
    fullName: string;
  };
  assignedToUser?: {
    id: number;
    username: string;
    fullName: string;
  };
  startedByUser?: {
    id: number;
    username: string;
    fullName: string;
  };
  completedByUser?: {
    id: number;
    username: string;
    fullName: string;
  };
}

export interface ProductionTaskExtra {
  id: number;
  task_id: number;
  product_id: number;
  quantity: number;
  notes?: string;
  product: {
    id: number;
    name: string;
    sku: string;
  };
}

export interface ProductionQueueItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  priority: number;
  status: 'queued' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  order: {
    id: number;
    customer_name: string;
  };
  product: {
    id: number;
    name: string;
    sku: string;
  };
}

export interface ProductionStats {
  urgentItems: number;
  overdueItems: number;
}

export interface ProductionFilters {
  status?: string;
  priority?: number;
  page?: number;
  offset?: number;
}

// Типы
export interface CreateProductionTaskRequest {
  orderId?: number;
  productId: number;
  requestedQuantity: number;
  priority?: number;
  notes?: string;
  assignedTo?: number;
  // Планирование производства (обязательные поля)
  plannedStartDate: string; // дата начала производства
  plannedEndDate: string; // дата завершения производства
}

export interface UpdateProductionTaskRequest {
  requestedQuantity?: number;
  priority?: number;
  notes?: string;
  assignedTo?: number;
  // Планирование производства
  plannedStartDate?: string; // дата начала производства
  plannedEndDate?: string; // дата завершения производства
}

export interface CompleteTaskRequest {
  producedQuantity: number;
  qualityQuantity: number;
  defectQuantity: number;
  notes?: string;
}

export interface CompleteTasksByProductRequest {
  productId: number;
  producedQuantity: number;
  qualityQuantity: number;
  defectQuantity: number;
  productionDate?: string;
  notes?: string;
}

export interface GetProductionTasksParams {
  status?: string;
  limit?: number;
  offset?: number;
  startDate?: string; // для календарной фильтрации
  endDate?: string;   // для календарной фильтрации
}

// Типы для планирования
export interface PlanningValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface OverlapInfo {
  taskId: number;
  productName: string;
  overlapDays: number;
  startDate: string;
  endDate: string;
}

export interface AlternativeDateSuggestion {
  startDate: string;
  endDate: string;
  reason: string;
  confidence: number; // 0-1
}

export interface OptimalPlanningSuggestion {
  suggestedStartDate?: string;
  suggestedDuration: number;
  confidence: number;
  reasoning: string;
}

export interface PlanningOverlapsResponse {
  overlaps: OverlapInfo[];
  suggestions: AlternativeDateSuggestion[];
}

// Новые типы для календарного планирования
export interface DayStatistics {
  dayDate: string;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  totalQuantity: number;
  totalEstimatedHours: number;
}

export interface CalendarTask {
  id: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  productName: string;
  requestedQuantity: number;
  status: string;
  priority: number;
  orderId?: number;
  orderNumber?: string;
  customerName?: string;
}

// Интерфейс для результата поиска товаров
export interface ProductSearchResult {
  id: number;
  name: string;
  article: string;
  categoryName?: string;
  price?: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
}

// Интерфейс для ответа частичного выполнения задания
export interface PartialCompleteTaskResponse {
  task: ProductionTask;
  wasCompleted: boolean;
  remainingQuantity: number;
  overproductionQuantity: number;
  overproductionQuality: number;
}

// Функции API для производственных заданий
export const getProductionTasks = async (params: GetProductionTasksParams = {}): Promise<{ success: boolean; data: ProductionTask[] }> => {
  const token = localStorage.getItem('token');
  const query = new URLSearchParams();
  
  if (params.status) query.append('status', params.status);
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.offset) query.append('offset', params.offset.toString());

  const response = await fetch(`${API_BASE_URL}/production/tasks?${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка загрузки заданий');
  }

  return response.json();
};

// Получить задания по товарам
export const getTasksByProduct = async (status?: string): Promise<{ success: boolean; data: any[] }> => {
  const token = localStorage.getItem('token');
  const query = status ? `?status=${status}` : '';
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/by-product${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка загрузки заданий по товарам');
  }

  return response.json();
};

// Начать задание
export const startTask = async (taskId: number): Promise<{ success: boolean; data: ProductionTask; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка запуска задания');
  }

  return response.json();
};

// Завершить задание
export const completeTask = async (taskId: number, data: CompleteTaskRequest): Promise<{ success: boolean; data: ProductionTask; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка завершения задания');
  }

  return response.json();
};

// Частичное выполнение задания (WBS 2 - Adjustments Задача 4.1)
export const partialCompleteTask = async (taskId: number, data: CompleteTaskRequest): Promise<{ success: boolean; data: PartialCompleteTaskResponse; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/partial-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка регистрации выпуска');
  }

  return response.json();
};

// Массовая регистрация выпуска продукции (WBS 2 - Adjustments Задача 4.2)
export const bulkRegisterProduction = async (data: {
  items: Array<{
    article: string;
    producedQuantity: number;
    qualityQuantity?: number;
    defectQuantity?: number;
  }>;
  productionDate?: string;
  notes?: string;
}): Promise<{ success: boolean; data: any[]; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/bulk-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка массовой регистрации производства');
  }

  return response.json();
};

// Массовое завершение заданий по товару
export const completeTasksByProduct = async (data: CompleteTasksByProductRequest): Promise<{ success: boolean; data: any; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/complete-by-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка массового завершения заданий');
  }

  return response.json();
};

export const reorderProductionTasks = async (taskIds: number[]) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/reorder`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskIds }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const suggestProductionTasks = async (orderId: number) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/suggest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Создать производственное задание
export const createProductionTask = async (data: CreateProductionTaskRequest): Promise<{ success: boolean; data: ProductionTask; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка создания задания');
  }

  return response.json();
};

// Редактировать производственное задание
export const updateProductionTask = async (taskId: number, data: UpdateProductionTaskRequest): Promise<{ success: boolean; data: ProductionTask; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка обновления задания');
  }

  return response.json();
};

// Изменить статус задания
export const updateTaskStatus = async (taskId: number, status: string): Promise<{ success: boolean; data: ProductionTask; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка изменения статуса задания');
  }

  return response.json();
};

// Новые методы для управления системой
export const recalculateProductionNeeds = async () => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/recalculate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const getSyncStatistics = async () => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/sync/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const notifyReadyOrders = async () => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/notify-ready`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const syncOrdersToTasks = async () => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/sync/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Совместимость со старым API
export const productionApi = {
  // Новые методы для производственных заданий
  getTasks: getProductionTasks,
  getTasksByProduct: getTasksByProduct,
  startTask: startTask,
  completeTask: completeTask,
  reorderTasks: reorderProductionTasks,
  suggestTasks: suggestProductionTasks,
  
  // Новые методы управления системой
  recalculateNeeds: recalculateProductionNeeds,
  getSyncStats: getSyncStatistics,
  notifyReady: notifyReadyOrders,
  syncOrders: syncOrdersToTasks,

  // Старые методы для очереди производства
  getQueue: async (params: any = {}) => {
    const token = getToken();
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetch(`${API_BASE_URL}/production/queue?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data || [] };
  },

  getStats: async () => {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}/production/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data || { urgentItems: 0, overdueItems: 0 } };
  },

  updateStatus: async (id: number, status: string, notes?: string) => {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}/production/queue/${id}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  },

  autoQueue: async () => {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}/production/auto-queue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data || [] };
  },

  addToQueue: async (productId: number, quantity: number, priority: number = 1, notes?: string) => {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}/production/queue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        quantity,
        priority,
        notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  },
};

// Удаление производственного задания
export const deleteProductionTask = async (taskId: number): Promise<{ success: boolean; message: string }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка удаления задания');
  }

  return response.json();
};

// Основной экспорт для удобства использования
export default {
  getTasks: getProductionTasks,
  getTasksByProduct: getTasksByProduct,
  createTask: createProductionTask,
  updateTask: updateProductionTask,
  deleteTask: deleteProductionTask,
  startTask: startTask,
  completeTask: completeTask,
  completeTasksByProduct: completeTasksByProduct,
  reorderTasks: reorderProductionTasks,
  suggestTasks: suggestProductionTasks,
  syncTasks: syncOrdersToTasks,
  getSyncStats: getSyncStatistics,
  recalculateNeeds: recalculateProductionNeeds,
  notifyReady: notifyReadyOrders
}; 

// Получить производственные задания по товару
export const getProductionTasksByProduct = async (productId: number): Promise<{ success: boolean; data: ProductionTask[]; message: string }> => {
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/production/tasks/by-product/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при получении производственных заданий по товару');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching production tasks by product:', error);
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Ошибка при получении производственных заданий'
    };
  }
};

// === НОВЫЕ API ФУНКЦИИ ДЛЯ КАЛЕНДАРНОГО ПЛАНИРОВАНИЯ ===

// Получить задания за период для календаря  
export const getTasksByDateRange = async (startDate: string, endDate: string): Promise<{ success: boolean; data: CalendarTask[] }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/calendar?startDate=${startDate}&endDate=${endDate}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка загрузки календарных заданий');
  }

  return response.json();
};

// Получить статистику по дням за период
export const getDayStatistics = async (startDate: string, endDate: string): Promise<{ success: boolean; data: DayStatistics[] }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/statistics/daily?startDate=${startDate}&endDate=${endDate}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка загрузки статистики');
  }

  return response.json();
};

// Обновить календарное планирование задания
export const updateTaskSchedule = async (taskId: number, scheduleData: {
  plannedStartDate?: string;
  plannedEndDate?: string;
}): Promise<{ success: boolean; data: ProductionTask }> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/schedule`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(scheduleData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка обновления планирования');
  }

  return response.json();
};

// === ДОПОЛНИТЕЛЬНЫЕ КАЛЕНДАРНЫЕ ФУНКЦИИ ===

// Получить детальную статистику с разбивкой по товарам
export const getDetailedStatistics = async (
  startDate: string, 
  endDate: string, 
  period: 'day' | 'week' | 'month' = 'day'
): Promise<{ success: boolean; data: any[] }> => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Нет токена авторизации');
  }

  const response = await fetch(`${API_BASE_URL}/production/statistics/detailed?startDate=${startDate}&endDate=${endDate}&period=${period}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
}; 

// Поиск товаров для массовой регистрации (новая функция)
export const searchProducts = async (query: string): Promise<{ success: boolean; data: ProductSearchResult[] }> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Нет токена авторизации');
  }

  const response = await axios.get(`${API_BASE_URL}/products/search`, {
    params: { q: query },
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

// Экспорт производственных заданий в Excel (Задача 9.2)
export const exportProductionTasks = async (filters?: any): Promise<void> => {
  const token = getToken();
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/production/tasks/export`,
      { filters },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        responseType: 'blob' // Важно для получения файла
      }
    );

    // Создаем ссылку для скачивания файла
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Извлекаем имя файла из заголовков ответа
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'production-tasks-export.xlsx';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error exporting production tasks:', error);
    throw new Error('Ошибка при экспорте производственных заданий');
  }
};

// Новые API функции для планирования
export const getOptimalPlanningSuggestions = async (
  productId: number, 
  quantity: number
): Promise<OptimalPlanningSuggestion> => {
  const token = getToken();
  
  const response = await axios.get(`${API_BASE_URL}/production/planning/suggest`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: { productId, quantity }
  });
  
  return response.data.data;
};

export const checkPlanningOverlaps = async (
  plannedStartDate: string,
  plannedEndDate: string,
  excludeTaskId?: number
): Promise<PlanningOverlapsResponse> => {
  const token = getToken();
  
  const response = await axios.get(`${API_BASE_URL}/production/planning/overlaps`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: { 
      plannedStartDate, 
      plannedEndDate, 
      ...(excludeTaskId && { excludeTaskId }) 
    }
  });
  
  return response.data.data;
}; 