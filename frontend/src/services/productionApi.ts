import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = 'http://localhost:5001/api';

// Функция для получения токена
const getToken = () => {
  return useAuthStore.getState().token;
};

// Типы для производственных заданий
export interface ProductionTask {
  id: number;
  orderId: number;
  productId: number;
  requestedQuantity: number;
  approvedQuantity?: number;
  producedQuantity?: number;
  qualityQuantity?: number;
  defectQuantity?: number;
  status: 'suggested' | 'approved' | 'rejected' | 'postponed' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  order: {
    id: number;
    customerName: string;
    status: string;
    orderNumber: string;
    manager?: {
      fullName: string;
    };
  };
  product: {
    id: number;
    name: string;
    article?: string;
    category?: {
      name: string;
    };
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

// Функции API для производственных заданий
export const getProductionTasks = async (params: { limit?: number; offset?: number; status?: string } = {}) => {
  const token = getToken();
  const queryParams = new URLSearchParams();
  
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.status) queryParams.append('status', params.status);

  const response = await fetch(`${API_BASE_URL}/production/tasks?${queryParams}`, {
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

export const getProductionTasksByProduct = async () => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/by-product`, {
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

export const approveProductionTask = async (taskId: number, approvedQuantity: number, notes?: string) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ approved_quantity: approvedQuantity, notes }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const rejectProductionTask = async (taskId: number, notes?: string) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const postponeProductionTask = async (taskId: number, notes?: string) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/postpone`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const startProductionTask = async (taskId: number, notes?: string) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const completeProductionTask = async (
  taskId: number, 
  data: {
    produced_quantity: number;
    quality_quantity: number;
    defect_quantity: number;
    notes?: string;
    extras?: Array<{ product_id: number; quantity: number; notes?: string }>;
  }
) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
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

export const createProductionTask = async (data: {
  orderId: number;
  productId: number;
  requestedQuantity: number;
  priority?: number;
  notes?: string;
  assignedTo?: number;
}) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}/production/tasks/suggest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
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
  getTasksByProduct: getProductionTasksByProduct,
  approveTask: approveProductionTask,
  rejectTask: rejectProductionTask,
  postponeTask: postponeProductionTask,
  startTask: startProductionTask,
  completeTask: completeProductionTask,
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

export default productionApi; 