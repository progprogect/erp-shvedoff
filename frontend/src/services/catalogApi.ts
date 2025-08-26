import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { PuzzleType } from './puzzleTypesApi';
import { BottomType } from './bottomTypesApi';

export interface Product {
  id: number;
  name: string;
  article?: string;
  categoryId?: number;
  category?: Category;
  managerId?: number;
  surfaceId?: number;
  surface?: Surface;
  logoId?: number;
  logo?: Logo;
  materialId?: number;
  material?: Material;
  bottomTypeId?: number;
  bottomType?: BottomType;
  dimensions?: {
    length: number;
    width: number;
    thickness: number;
  };
  characteristics?: any;
  puzzleOptions?: any;
  matArea?: number;
  weight?: number;
  grade?: string;
  borderType?: string;
  tags?: string[];
  price?: number;
  costPrice?: number;
  normStock?: number;
  notes?: string;
  photos?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Новые поля для края ковра
  carpetEdgeType?: string;
  carpetEdgeSides?: number;
  carpetEdgeStrength?: string;
  // Поля паззла (для обратной совместимости)
  puzzleTypeId?: number;
  puzzleType?: PuzzleType;
  puzzleSides?: number;
  // Поля для остатков
  currentStock?: number;
  reservedStock?: number;
  availableStock?: number;
  inProductionQuantity?: number;
  // Поля для отображения
  categoryName?: string;
  categoryPath?: string;
  // Структура stock
  stock?: {
    currentStock: number;
    reservedStock: number;
    availableStock?: number;
    inProductionQuantity?: number;
  };
}

// Базовые типы для связанных сущностей
export interface Category {
  id: number;
  name: string;
  parentId?: number;
  description?: string;
  children?: Category[];
  path?: string;
}

interface Surface {
  id: number;
  name: string;
  description?: string;
}

interface Logo {
  id: number;
  name: string;
  description?: string;
}

interface Material {
  id: number;
  name: string;
  description?: string;
}

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  // Фильтры по краю ковра
  carpetEdgeTypes?: string[];
  carpetEdgeSides?: number[];
  carpetEdgeStrength?: string[];
  // Фильтр по низу ковра
  bottomTypeIds?: number[];
  // Фильтр по типам паззла
  puzzleTypeIds?: number[];
  // Фильтры по габаритам
  lengthMin?: number;
  lengthMax?: number;
  widthMin?: number;
  widthMax?: number;
  thicknessMin?: number;
  thicknessMax?: number;
  // Новые фильтры для полноценной фильтрации
  materialIds?: number[];    // материалы
  surfaceIds?: number[];     // поверхности
  logoIds?: number[];        // логотипы
  grades?: string[];         // сорта товаров
  weightMin?: number;        // минимальный вес
  weightMax?: number;        // максимальный вес
  matAreaMin?: number;       // минимальная площадь
  matAreaMax?: number;       // максимальная площадь
  onlyInStock?: boolean;     // только товары в наличии
  borderTypes?: string[];    // типы бортов (Задача 7.1)
  sortBy?: string;           // поле сортировки
  sortOrder?: 'ASC' | 'DESC'; // направление сортировки
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

    // Новые фильтры
    if (filters.materialIds && filters.materialIds.length > 0) {
      filters.materialIds.forEach(id => params.append('materialIds', id.toString()));
    }
    if (filters.surfaceIds && filters.surfaceIds.length > 0) {
      filters.surfaceIds.forEach(id => params.append('surfaceIds', id.toString()));
    }
    if (filters.logoIds && filters.logoIds.length > 0) {
      filters.logoIds.forEach(id => params.append('logoIds', id.toString()));
    }
    if (filters.bottomTypeIds && filters.bottomTypeIds.length > 0) {
      filters.bottomTypeIds.forEach(id => {
        params.append('bottomTypeIds', id.toString());
      });
    }

    // Фильтр по типам паззла
    if (filters.puzzleTypeIds && filters.puzzleTypeIds.length > 0) {
      filters.puzzleTypeIds.forEach(id => {
        params.append('puzzleTypeIds', id.toString());
      });
    }

    // Фильтры по габаритам
    if (filters.lengthMin !== undefined) {
      params.append('lengthMin', filters.lengthMin.toString());
    }
    if (filters.lengthMax !== undefined) {
      params.append('lengthMax', filters.lengthMax.toString());
    }
    if (filters.widthMin !== undefined) {
      params.append('widthMin', filters.widthMin.toString());
    }
    if (filters.widthMax !== undefined) {
      params.append('widthMax', filters.widthMax.toString());
    }
    if (filters.thicknessMin !== undefined) {
      params.append('thicknessMin', filters.thicknessMin.toString());
    }
    if (filters.thicknessMax !== undefined) {
      params.append('thicknessMax', filters.thicknessMax.toString());
    }
    if (filters.grades && filters.grades.length > 0) {
      filters.grades.forEach(grade => params.append('grades', grade));
    }
    if (filters.weightMin !== undefined) {
      params.append('weightMin', filters.weightMin.toString());
    }
    if (filters.weightMax !== undefined) {
      params.append('weightMax', filters.weightMax.toString());
    }
    if (filters.matAreaMin !== undefined) {
      params.append('matAreaMin', filters.matAreaMin.toString());
    }
    if (filters.matAreaMax !== undefined) {
      params.append('matAreaMax', filters.matAreaMax.toString());
    }
    if (filters.onlyInStock) {
      params.append('onlyInStock', 'true');
    }
    if (filters.borderTypes && filters.borderTypes.length > 0) {
      filters.borderTypes.forEach(type => params.append('borderTypes', type));
    }
    
    // Новые фильтры для края ковра
    if (filters.carpetEdgeTypes && filters.carpetEdgeTypes.length > 0) {
      filters.carpetEdgeTypes.forEach(type => params.append('carpetEdgeTypes', type));
    }
    if (filters.carpetEdgeSides && filters.carpetEdgeSides.length > 0) {
      filters.carpetEdgeSides.forEach(side => params.append('carpetEdgeSides', side.toString()));
    }
    if (filters.carpetEdgeStrength && filters.carpetEdgeStrength.length > 0) {
      filters.carpetEdgeStrength.forEach(strength => params.append('carpetEdgeStrength', strength));
    }
    
    if (filters.sortBy) {
      params.append('sortBy', filters.sortBy);
    }
    if (filters.sortOrder) {
      params.append('sortOrder', filters.sortOrder);
    }
    
    // Рассчитываем offset из page
    const limit = filters.limit || 1000; // Увеличен лимит для отображения всех товаров
    if (filters.page) {
      const offset = (filters.page - 1) * limit;
      params.append('offset', offset.toString());
    }
    params.append('limit', limit.toString());

    // Добавляем логирование для отладки
    console.log('🌐 API запрос:', `${API_BASE_URL}/catalog/products?${params.toString()}`);
    console.log('🔍 Параметры фильтрации:', Object.fromEntries(params.entries()));

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

  // Перенос товаров между категориями (Задача 7.3)
  async moveProducts(productIds: number[], targetCategoryId: number): Promise<ApiResponse<{
    movedProductIds: number[];
    targetCategoryId: number;
    targetCategoryName: string;
  }>> {
    const response = await axios.post(
      `${API_BASE_URL}/catalog/products/move`,
      {
        productIds,
        targetCategoryId
      },
      this.getAuthHeaders()
    );
    return response.data;
  }

  // Экспорт каталога в Excel (Задача 9.2)
  async exportCatalog(options: {
    productIds?: number[];
    filters?: ProductFilters;
  }): Promise<void> {
    const response = await axios.post(
      `${API_BASE_URL}/catalog/export`,
      {
        productIds: options.productIds,
        filters: options.filters
      },
      {
        ...this.getAuthHeaders(),
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
    let filename = 'catalog-export.xlsx';
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
  }

  // Предварительный просмотр артикула
  async previewArticle(productData: any): Promise<{
    success: boolean;
    data: {
      article: string;
      validation: {
        isValid: boolean;
        errors: string[];
      };
    };
  }> {
    const response = await axios.post(
      `${API_BASE_URL}/catalog/products/preview-article`,
      productData,
      this.getAuthHeaders()
    );
    return response.data;
  }
}

export const catalogApi = new CatalogApi(); 