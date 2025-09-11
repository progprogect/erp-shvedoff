import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен авторизации к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ArticleRegenerateResult {
  productId: number;
  currentSku: string | null;
  newSku: string | null;
  canApply: boolean;
  reason?: 'MISSING_PARAMS' | 'SKU_CONFLICT' | 'UNKNOWN';
  details?: string[];
}

export interface ArticleRegenerateResponse {
  success: boolean;
  data: {
    results: ArticleRegenerateResult[];
    canApplyCount: number;
    cannotApplyCount: number;
  };
}

export interface ArticleApplyItem {
  productId: number;
  newSku: string;
  currentSku?: string;
}

export interface ArticleApplyResponse {
  success: boolean;
  data: {
    updated: number;
    failed: number;
    updatedItems: Array<{ productId: number; newSku: string }>;
    failedItems: Array<{ productId: number; error: string }>;
  };
}

export const articlesApi = {
  // Dry-run для проверки возможности обновления артикулов
  async dryRun(productIds: number[]): Promise<ArticleRegenerateResponse> {
    const response = await api.post('/catalog/regenerate/dry-run', {
      productIds
    });
    return response.data;
  },

  // Apply для применения обновлений артикулов
  async apply(items: ArticleApplyItem[]): Promise<ArticleApplyResponse> {
    const response = await api.post('/catalog/regenerate/apply', {
      items
    });
    return response.data;
  }
};
