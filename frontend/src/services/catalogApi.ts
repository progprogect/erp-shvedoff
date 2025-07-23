import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface Category {
  id: number;
  name: string;
  parentId?: number;
  description?: string;
  path?: string;
  sortOrder: number;
  children?: Category[];
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  article?: string;
  categoryId: number;
  managerId?: number;
  surfaceId?: number;
  logoId?: number;
  materialId?: number;
  dimensions?: {
    length: number;
    width: number;
    thickness: number;
  };
  characteristics?: {
    surface?: string;
    material?: string;
  };
  puzzleOptions?: {
    sides?: '1_side' | '2_sides' | '3_sides' | '4_sides';
    type?: string;
    enabled?: boolean;
  };
  matArea?: number; // Площадь мата в м² (автоматический расчет + коррекция)
  weight?: number; // Вес товара в кг (опционально)
  grade: 'usual' | 'grade_2'; // Сорт товара: обычный по умолчанию
  tags?: string[];
  price?: number;
  normStock: number;
  notes?: string;
  photos?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName?: string;
  categoryPath?: string;
  manager?: {
    id: number;
    fullName?: string;
    username: string;
    role: string;
  };
  surfaceName?: string;
  logoName?: string;
  materialName?: string;
  // Поля для обратной совместимости
  currentStock?: number;
  reservedStock?: number;
  availableStock?: number;
  inProductionQuantity?: number;
  stockStatus?: 'critical' | 'low' | 'normal';
  // Новая структура stock
  stock?: {
    currentStock: number;
    reservedStock: number;
    availableStock?: number;
    inProductionQuantity?: number;
  };
}

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  lengthMin?: number;
  lengthMax?: number;
  widthMin?: number;
  widthMax?: number;
  thicknessMin?: number;
  thicknessMax?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CategoryDeleteOptions {
  productAction: 'delete' | 'move';
  targetCategoryId?: number;
  childAction?: 'delete' | 'move' | 'promote';
  targetParentId?: number;
}

export interface CategoryDeleteResult {
  success: boolean;
  message: string;
  details: {
    productsProcessed: number;
    productAction: string;
    childCategoriesProcessed: number;
    childAction?: string;
  };
}

class CatalogApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getCategories(): Promise<ApiResponse<Category[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/categories`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getProducts(filters: ProductFilters & { page?: number; limit?: number }): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams();
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.categoryId) {
      params.append('categoryId', filters.categoryId.toString());
    }
    if (filters.stockStatus) {
      params.append('stockStatus', filters.stockStatus);
    }
    
    // Рассчитываем offset из page
    const limit = filters.limit || 50;
    if (filters.page) {
      const offset = (filters.page - 1) * limit;
      params.append('offset', offset.toString());
    }
    params.append('limit', limit.toString());

    const response = await axios.get(
      `${API_BASE_URL}/catalog/products?${params.toString()}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getProduct(id: number): Promise<ApiResponse<Product>> {
    const response = await axios.get(
      `${API_BASE_URL}/catalog/products/${id}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getUsers(): Promise<ApiResponse<{ id: number; fullName?: string; username: string; role: string }[]>> {
    const response = await axios.get(`${API_BASE_URL}/users/list`, 
      this.getAuthHeaders()
    );
    return response.data;
  }

  async createProduct(productData: Partial<Product>): Promise<ApiResponse<Product>> {
    const response = await axios.post(
      `${API_BASE_URL}/catalog/products`,
      productData,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<ApiResponse<Product>> {
    const response = await axios.put(
      `${API_BASE_URL}/catalog/products/${id}`,
      productData,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async deleteProduct(id: number): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/catalog/products/${id}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async createCategory(categoryData: { name: string; parentId?: number; description?: string }): Promise<ApiResponse<Category>> {
    const response = await axios.post(
      `${API_BASE_URL}/categories`,
      categoryData,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async deleteCategory(id: number): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/categories/${id}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async deleteCategoryWithAction(id: number, options: CategoryDeleteOptions): Promise<CategoryDeleteResult> {
    const response = await axios.post(
      `${API_BASE_URL}/categories/${id}/delete-with-action`,
      options,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getCategoryDetails(id: number): Promise<ApiResponse<Category & { productsCount: number }>> {
    const response = await axios.get(
      `${API_BASE_URL}/categories/${id}`,
      this.getAuthHeaders()
    );
    return response.data;
  }
}

export const catalogApi = new CatalogApi(); 