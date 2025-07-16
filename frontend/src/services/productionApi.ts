import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = 'http://localhost:5001/api';

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
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  sortOrder: number;
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
    code: string;
    category: {
      id: number;
      name: string;
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
}

export interface UpdateProductionTaskRequest {
  requestedQuantity?: number;
  priority?: number;
  notes?: string;
  assignedTo?: number;
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
  const response = await fetch('/api/production/tasks/suggest', {
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
  const response = await fetch(`/api/production/tasks/${taskId}`, {
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