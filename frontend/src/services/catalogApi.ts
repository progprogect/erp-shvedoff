import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

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
  surfaceName?: string;
  logoName?: string;
  materialName?: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  inProductionQuantity?: number;
  stockStatus?: 'critical' | 'low' | 'normal';
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
  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getCategories(token: string): Promise<ApiResponse<Category[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/categories`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async getProducts(filters: ProductFilters & { page?: number; limit?: number }, token: string): Promise<ApiResponse<Product[]>> {
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
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    const response = await axios.get(
      `${API_BASE_URL}/products?${params.toString()}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async getProduct(id: number, token: string): Promise<ApiResponse<Product>> {
    const response = await axios.get(
      `${API_BASE_URL}/products/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async createProduct(productData: Partial<Product>, token: string): Promise<ApiResponse<Product>> {
    const response = await axios.post(
      `${API_BASE_URL}/products`,
      productData,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async updateProduct(id: number, productData: Partial<Product>, token: string): Promise<ApiResponse<Product>> {
    const response = await axios.put(
      `${API_BASE_URL}/products/${id}`,
      productData,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deleteProduct(id: number, token: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/products/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async createCategory(categoryData: { name: string; parentId?: number; description?: string }, token: string): Promise<ApiResponse<Category>> {
    const response = await axios.post(
      `${API_BASE_URL}/categories`,
      categoryData,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deleteCategory(id: number, token: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/categories/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deleteCategoryWithAction(id: number, options: CategoryDeleteOptions, token: string): Promise<CategoryDeleteResult> {
    const response = await axios.post(
      `${API_BASE_URL}/categories/${id}/delete-with-action`,
      options,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async getCategoryDetails(id: number, token: string): Promise<ApiResponse<Category & { productsCount: number }>> {
    const response = await axios.get(
      `${API_BASE_URL}/categories/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }
}

export const catalogApi = new CatalogApi(); 