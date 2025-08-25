import React, { useState, useMemo, useEffect } from 'react';
import { Row, Col, Card, Tree, Input, Button, Space, Typography, Tag, Badge, Select, InputNumber, Collapse, Spin, Table, Modal, Checkbox, App } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  AppstoreOutlined,
  InboxOutlined,
  BorderOutlined,
  FilterOutlined,
  ClearOutlined,
  ReloadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { catalogApi, Category, Product, ProductFilters } from '../services/catalogApi';
import { materialsApi } from '../services/materialsApi';
import { surfacesApi } from '../services/surfacesApi';
import { logosApi } from '../services/logosApi';
import carpetEdgeTypesApi from '../services/carpetEdgeTypesApi';
import bottomTypesApi from '../services/bottomTypesApi';
import { puzzleTypesApi } from '../services/puzzleTypesApi';
import CreateProductModal from '../components/CreateProductModal';
import CreateCategoryModal from '../components/CreateCategoryModal';
import DeleteCategoryModal from '../components/DeleteCategoryModal';
import usePermissions from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Panel } = Collapse;

// Функция форматирования категорий для Tree компонента с товарами
const formatCategoriesForTree = (categories: Category[], allProducts: Product[]): any[] => {
  return categories.map(category => {
    // Найдем товары этой категории
    const categoryProducts = allProducts.filter(product => product.categoryId === category.id);
    
    // Создаем дочерние элементы: сначала подкатегории, затем товары
    const children = [];
    
    // Добавляем подкатегории
    if (category.children && category.children.length > 0) {
      children.push(...formatCategoriesForTree(category.children, allProducts));
    }
    
    // Добавляем товары
    categoryProducts.forEach(product => {
      const dimensions = product.dimensions ? 
        `${product.dimensions.length}×${product.dimensions.width}×${product.dimensions.thickness}` : 
        'без размеров';
      const available = (product.currentStock || 0) - (product.reservedStock || 0);
      const stockIcon = available > 0 ? '✅' : '❌';
      
      children.push({
        title: `${stockIcon} ${product.name} (${dimensions})`,
        key: `product-${product.id}`,
        isLeaf: true,
        data: { type: 'product', product }
      });
    });

    return {
      title: `📁 ${category.name} (${categoryProducts.length})`,
      key: category.id,
      data: { type: 'category', category },
      children: children.length > 0 ? children : undefined
    };
  });
};



const Catalog: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [checkedCategories, setCheckedCategories] = useState<number[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(1000); // Увеличено для отображения всех товаров
  const [showSizeFilters, setShowSizeFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);  // Общее количество товаров
  const [createProductModalVisible, setCreateProductModalVisible] = useState(false);
  const [createCategoryModalVisible, setCreateCategoryModalVisible] = useState(false);
  const [deleteCategoryModalVisible, setDeleteCategoryModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Новые фильтры для WBS 2 - Adjustments Задача 2.1
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [selectedSurfaces, setSelectedSurfaces] = useState<number[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedBorderTypes, setSelectedBorderTypes] = useState<string[]>([]); // Задача 7.1
  const [weightFilter, setWeightFilter] = useState({
    min: null as number | null,
    max: null as number | null
  });
  const [onlyInStock, setOnlyInStock] = useState(false);
  
  // Сортировка (Задача 7.2)
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  
  // Расширенные фильтры для системного архитектора
  const [selectedLogos, setSelectedLogos] = useState<number[]>([]);
  const [stockRangeFilter, setStockRangeFilter] = useState({
    min: null as number | null,
    max: null as number | null
  });
  
  // Новые фильтры для края ковра
  const [selectedCarpetEdgeTypes, setSelectedCarpetEdgeTypes] = useState<string[]>([]);
  const [selectedCarpetEdgeSides, setSelectedCarpetEdgeSides] = useState<number[]>([]);
  const [selectedCarpetEdgeStrength, setSelectedCarpetEdgeStrength] = useState<string[]>([]);
  
  // Фильтр по низу ковра
  const [selectedBottomTypeIds, setSelectedBottomTypeIds] = useState<number[]>([]);
  const [selectedPuzzleTypeIds, setSelectedPuzzleTypeIds] = useState<number[]>([]);
  
  // Справочники для фильтров
  const [materials, setMaterials] = useState<any[]>([]);
  const [surfaces, setSurfaces] = useState<any[]>([]);
  const [logos, setLogos] = useState<any[]>([]);
  const [carpetEdgeTypes, setCarpetEdgeTypes] = useState<any[]>([]);
  const [bottomTypes, setBottomTypes] = useState<any[]>([]);
  const [puzzleTypes, setPuzzleTypes] = useState<any[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  
  // Фильтры по размерам
  const [sizeFilters, setSizeFilters] = useState({
    lengthMin: null as number | null,
    lengthMax: null as number | null,
    widthMin: null as number | null,
    widthMax: null as number | null,
    thicknessMin: null as number | null,
    thicknessMax: null as number | null,
  });

  // Состояния для переноса товаров между категориями (Задача 7.3)
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movingProducts, setMovingProducts] = useState(false);

  // Состояния для экспорта каталога (Задача 9.2)
  const [exportingCatalog, setExportingCatalog] = useState(false);

  const { user, token } = useAuthStore();
  const { canCreate, canEdit, canDelete, canManage } = usePermissions();
  const navigate = useNavigate();
  const { message } = App.useApp();

  // Загрузка данных
  useEffect(() => {
    if (token) {
      loadData();
      loadReferences();
    }
  }, [token]);

  // Перезагрузка товаров при изменении фильтров
  useEffect(() => {
    if (token) {
      loadProducts();
    }
  }, [searchText, checkedCategories, stockFilter, selectedMaterials, selectedSurfaces,
      selectedLogos, selectedGrades, weightFilter, onlyInStock, selectedBorderTypes,
      selectedCarpetEdgeTypes, selectedCarpetEdgeSides, selectedCarpetEdgeStrength,
      selectedBottomTypeIds, selectedPuzzleTypeIds, sizeFilters, sortBy, sortOrder, currentPage]);

  const loadData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      // Загружаем только категории в начале
      const categoriesResponse = await catalogApi.getCategories();

      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data);
      }
      
      // Товары загружаем через loadProducts с фильтрами
      await loadProducts();
    } catch (error) {
      console.error('Ошибка загрузки данных каталога:', error);
      message.error('Ошибка загрузки данных каталога');
    } finally {
      setLoading(false);
    }
  };

  // Новая функция для загрузки товаров с фильтрами
  const loadProducts = async () => {
    if (!token) return;
    
    try {
      const filters: ProductFilters = {
        search: searchText,
        categoryId: checkedCategories.length === 1 ? checkedCategories[0] : undefined,
        stockStatus: stockFilter === 'all' ? undefined : 
          stockFilter === 'critical' ? 'out_of_stock' : 
          stockFilter === 'low' ? 'low_stock' : 
          stockFilter === 'normal' ? 'in_stock' : undefined,
        materialIds: selectedMaterials.length > 0 ? selectedMaterials : undefined,
        surfaceIds: selectedSurfaces.length > 0 ? selectedSurfaces : undefined,
        logoIds: selectedLogos.length > 0 ? selectedLogos : undefined,
        grades: selectedGrades.length > 0 ? selectedGrades : undefined,
        weightMin: weightFilter.min || undefined,
        weightMax: weightFilter.max || undefined,
        onlyInStock,
        borderTypes: selectedBorderTypes.length > 0 ? selectedBorderTypes : undefined,
        carpetEdgeTypes: selectedCarpetEdgeTypes.length > 0 ? selectedCarpetEdgeTypes : undefined,
        carpetEdgeSides: selectedCarpetEdgeSides.length > 0 ? selectedCarpetEdgeSides : undefined,
        carpetEdgeStrength: selectedCarpetEdgeStrength.length > 0 ? selectedCarpetEdgeStrength : undefined,
        bottomTypeIds: selectedBottomTypeIds.length > 0 ? selectedBottomTypeIds : undefined,
        puzzleTypeIds: selectedPuzzleTypeIds.length > 0 ? selectedPuzzleTypeIds : undefined,
        lengthMin: sizeFilters.lengthMin || undefined,
        lengthMax: sizeFilters.lengthMax || undefined,
        widthMin: sizeFilters.widthMin || undefined,
        widthMax: sizeFilters.widthMax || undefined,
        thicknessMin: sizeFilters.thicknessMin || undefined,
        thicknessMax: sizeFilters.thicknessMax || undefined,
        sortBy,
        sortOrder
      };

      // Добавляем логирование для отладки
      console.log('🔍 Применяемые фильтры:', filters);
      console.log('📊 Выбранные материалы:', selectedMaterials);
      console.log('🎨 Выбранные поверхности:', selectedSurfaces);
      console.log('🔽 Выбранные низы ковра:', selectedBottomTypeIds);
      console.log('✂️ Выбранные края ковра:', selectedCarpetEdgeTypes);

      const productsResponse = await catalogApi.getProducts({ 
        ...filters, 
        page: currentPage, 
        limit: pageSize
      });

      if (productsResponse.success) {
        console.log('✅ Товары загружены:', productsResponse.data.length);
        console.log('📊 Всего товаров:', productsResponse.pagination?.total);
        setProducts(productsResponse.data);
        setTotalProducts(productsResponse.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
      message.error('Ошибка загрузки товаров');
    }
  };

  // Загрузка справочников для фильтров (унифицированная для системного архитектора)
  const loadReferences = async () => {
    if (!token) return;
    
    setLoadingReferences(true);
    try {
      const [materialsResponse, surfacesResponse, logosResponse, carpetEdgeTypesResponse, bottomTypesResponse, puzzleTypesResponse] = await Promise.all([
        materialsApi.getMaterials(token),
        surfacesApi.getSurfaces(token),
        logosApi.getLogos(token),
        carpetEdgeTypesApi.getCarpetEdgeTypes(token),
        bottomTypesApi.getBottomTypes(token),
        puzzleTypesApi.getPuzzleTypes(token)
      ]);

      if (materialsResponse.success) {
        setMaterials(materialsResponse.data);
        console.log('📦 Материалы загружены:', materialsResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки материалов:', materialsResponse);
      }

      if (surfacesResponse.success) {
        setSurfaces(surfacesResponse.data);
        console.log('🎨 Поверхности загружены:', surfacesResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки поверхностей:', surfacesResponse);
      }

      if (logosResponse.success) {
        setLogos(logosResponse.data);
        console.log('🏷️ Логотипы загружены:', logosResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки логотипов:', logosResponse);
      }

      if (carpetEdgeTypesResponse.success) {
        setCarpetEdgeTypes(carpetEdgeTypesResponse.data);
        console.log('✂️ Типы края ковра загружены:', carpetEdgeTypesResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки типов края ковра:', carpetEdgeTypesResponse);
      }

      if (bottomTypesResponse.success) {
        setBottomTypes(bottomTypesResponse.data);
        console.log('👇 Типы низов ковра загружены:', bottomTypesResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки типов низов ковра:', bottomTypesResponse);
      }

      if (puzzleTypesResponse.success) {
        setPuzzleTypes(puzzleTypesResponse.data);
        console.log('🧩 Типы паззла загружены:', puzzleTypesResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки типов паззла:', puzzleTypesResponse);
      }
    } catch (error) {
      console.error('❌ Критическая ошибка загрузки справочников:', error);
      message.error('Ошибка загрузки справочников для фильтров');
    } finally {
      setLoadingReferences(false);
    }
  };

  const getStockStatus = (current: number, reserved: number) => {
    const available = current - reserved;
    if (available < 0) return { status: 'negative', color: '#ff4d4f', text: 'Перезаказ' };
    if (available <= 0) return { status: 'critical', color: '#ff4d4f', text: 'Закончился' };
    if (available < 20) return { status: 'low', color: '#faad14', text: 'Мало' };
    return { status: 'normal', color: '#52c41a', text: 'В наличии' };
  };

  // Функция для получения всех дочерних категорий
  const getAllChildCategories = (categoryId: number): number[] => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return [categoryId];
    
    if (category.children) {
      const childIds = category.children.map(child => child.id);
      return [categoryId, ...childIds];
    }
    
    return [categoryId];
  };

  // Обработка выбора категорий
  const handleCategoryCheck = (checkedKeys: any) => {
    // Фильтруем только категории (не товары)
    const categoryKeys = checkedKeys.filter((key: any) => !key.toString().startsWith('product-'));
    
    let expandedKeys = [...categoryKeys];
    
    // Для каждой выбранной родительской категории добавляем дочерние
    categoryKeys.forEach((key: number) => {
      const childKeys = getAllChildCategories(key);
      expandedKeys = [...expandedKeys, ...childKeys];
    });
    
    // Убираем дубликаты
    expandedKeys = Array.from(new Set(expandedKeys));
    
    setCheckedCategories(expandedKeys);
    setCurrentPage(1); // Сбрасываем на первую страницу при изменении фильтра
  };

  // Обработка клика по элементам дерева
  const handleTreeSelect = (selectedKeys: any, info: any) => {
    if (selectedKeys.length > 0) {
      const selectedKey = selectedKeys[0];
      
      // Если это товар - переходим к его карточке
      if (selectedKey.toString().startsWith('product-')) {
        const productId = selectedKey.replace('product-', '');
        navigate(`/catalog/products/${productId}`);
      }
    }
  };

  // Товары уже отфильтрованы на backend, используем как есть
  const filteredProducts = products;

  // Пагинация теперь происходит на backend
  const paginatedProducts = filteredProducts;
  const totalPages = Math.ceil(totalProducts / pageSize);

  // Популярные размеры для быстрого поиска
  const popularSizes = ['1800×1200', '1600×1000', '1000×1000'];
  
  // Быстрые фильтры размеров
  const quickSizeRanges = [
    { label: 'Большие (>1500мм)', lengthMin: 1500, widthMin: 1000 },
    { label: 'Средние (1000-1500мм)', lengthMin: 1000, lengthMax: 1500, widthMin: 800, widthMax: 1500 },
    { label: 'Малые (<1000мм)', lengthMax: 1000, widthMax: 1000 },
  ];

  // Применение быстрого фильтра размеров
  const applyQuickSizeRange = (range: any) => {
    setSizeFilters({
      lengthMin: range.lengthMin || null,
      lengthMax: range.lengthMax || null,
      widthMin: range.widthMin || null,
      widthMax: range.widthMax || null,
      thicknessMin: null,
      thicknessMax: null,
    });
    setCurrentPage(1);
  };

  // Очистка всех фильтров (расширенная для системного архитектора)
  const clearAllFilters = () => {
    setSearchText('');
    setCheckedCategories([]);
    setStockFilter('all');
    setSizeFilters({
      lengthMin: null,
      lengthMax: null,
      widthMin: null,
      widthMax: null,
      thicknessMin: null,
      thicknessMax: null,
    });
    setSelectedMaterials([]);
    setSelectedSurfaces([]);
    setSelectedGrades([]);
    setSelectedBorderTypes([]); // Задача 7.1
    setWeightFilter({ min: null, max: null });
    setOnlyInStock(false);
    
    // Новые фильтры
    setSelectedLogos([]);
    setStockRangeFilter({ min: null, max: null });
    
    // Фильтры края ковра
    setSelectedCarpetEdgeTypes([]);
    setSelectedCarpetEdgeSides([]);
    setSelectedCarpetEdgeStrength([]);
    
    // Фильтр по низу ковра
    setSelectedBottomTypeIds([]);

    setCurrentPage(1);
  };

  // Сброс фильтров размеров
  const clearSizeFilters = () => {
    setSizeFilters({
      lengthMin: null,
      lengthMax: null,
      widthMin: null,
      widthMax: null,
      thicknessMin: null,
      thicknessMax: null,
    });
    setCurrentPage(1);
  };

  // Сброс фильтров материалов и поверхностей
  const clearMaterialFilters = () => {
    setSelectedMaterials([]);
    setSelectedSurfaces([]);
    setSelectedLogos([]);
    setSelectedBorderTypes([]); // Задача 7.1
    setCurrentPage(1);
  };

  // Сброс фильтров товарных характеристик
  const clearProductFilters = () => {
    setSearchText('');
    setCheckedCategories([]);
    setStockFilter('all');
    setSelectedMaterials([]);
    setSelectedSurfaces([]);
    setSelectedLogos([]);
    setSelectedGrades([]);
    setWeightFilter({ min: null, max: null });
    setOnlyInStock(false);
    setSelectedBorderTypes([]);
    setSelectedCarpetEdgeTypes([]);
    setSelectedCarpetEdgeSides([]);
    setSelectedCarpetEdgeStrength([]);
    setSelectedBottomTypeIds([]);
    setSelectedPuzzleTypeIds([]);
    setSizeFilters({
      lengthMin: null,
      lengthMax: null,
      widthMin: null,
      widthMax: null,
      thicknessMin: null,
      thicknessMax: null,
    });
  };

  // Сброс фильтров остатков
  const clearStockFilters = () => {
    setStockFilter('all');
    setOnlyInStock(false);
    setStockRangeFilter({ min: null, max: null });
    setCurrentPage(1);
  };

  // Проверка есть ли активные фильтры размеров
  const hasSizeFilters = Object.values(sizeFilters).some(value => value !== null);
  
  // Проверка активности расширенных фильтров (расширенная для системного архитектора)
  const hasAdvancedFilters = 
    onlyInStock || 
    selectedMaterials.length > 0 || 
    selectedSurfaces.length > 0 || 
    selectedGrades.length > 0 || 
    selectedBorderTypes.length > 0 || // Задача 7.1
    weightFilter.min !== null || 
    weightFilter.max !== null ||
    selectedLogos.length > 0 ||
    stockRangeFilter.min !== null ||
    stockRangeFilter.max !== null ||
    // Новые фильтры края ковра
    selectedCarpetEdgeTypes.length > 0 ||
    selectedCarpetEdgeSides.length > 0 ||
    selectedCarpetEdgeStrength.length > 0 ||
    // Фильтр по низу ковра
    selectedBottomTypeIds.length > 0 ||
    // Новые фильтры для паззла
    selectedPuzzleTypeIds.length > 0;
  
  // Подсчет активных фильтров
  const getActiveFiltersCount = () => {
    return (
      (searchText ? 1 : 0) +
      (stockFilter !== 'all' ? 1 : 0) +
      (checkedCategories.length > 0 ? 1 : 0) +
      (hasSizeFilters ? 1 : 0) +
      (selectedMaterials.length > 0 ? 1 : 0) +
      (selectedSurfaces.length > 0 ? 1 : 0) +
      (selectedLogos.length > 0 ? 1 : 0) +
      (selectedGrades.length > 0 ? 1 : 0) +
      (weightFilter.min !== null || weightFilter.max !== null ? 1 : 0) +
      (stockRangeFilter.min !== null || stockRangeFilter.max !== null ? 1 : 0) +
      (onlyInStock ? 1 : 0) +
      // Новые фильтры для края ковра
      (selectedCarpetEdgeTypes.length > 0 ? 1 : 0) +
      (selectedCarpetEdgeSides.length > 0 ? 1 : 0) +
      (selectedCarpetEdgeStrength.length > 0 ? 1 : 0) +
      // Фильтр по низу ковра
      (selectedBottomTypeIds.length > 0 ? 1 : 0) +
      // Новые фильтры для паззла
      (selectedPuzzleTypeIds.length > 0 ? 1 : 0)
    );
  };

  // Проверка есть ли любые активные фильтры
  const hasActiveFilters = getActiveFiltersCount() > 0;

  // Используем хук разрешений вместо жестко закодированных ролей
  const canEditCatalog = canEdit('catalog');

  // Функция удаления товара
  const handleDeleteProduct = (product: Product) => {
    Modal.confirm({
      title: 'Подтверждение удаления',
      content: (
        <div>
          <p>Вы действительно хотите удалить товар?</p>
          <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginTop: '12px' }}>
            <Text strong>{product.name}</Text>
            <br />
            <Text type="secondary">Артикул: {product.article || 'Не указан'}</Text>
            <br />
            <Text type="secondary">Категория: {product.categoryName}</Text>
          </div>
          <div style={{ marginTop: '12px', color: '#ff4d4f' }}>
            <Text type="danger">
              ⚠️ Внимание: Товар будет деактивирован и скрыт из каталога. 
              Это действие можно отменить только через панель администрирования.
            </Text>
          </div>
        </div>
      ),
      okText: 'Удалить',
      cancelText: 'Отмена',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await catalogApi.deleteProduct(product.id);
          if (response.success) {
            message.success('Товар успешно удален');
            loadData(); // Перезагружаем данные
          } else {
            message.error(response.message || 'Ошибка удаления товара');
          }
        } catch (error: any) {
          console.error('Error deleting product:', error);
          message.error('Ошибка удаления товара');
        }
      }
    });
  };

  // Функция переноса товаров между категориями (Задача 7.3)
  const handleMoveProducts = async (targetCategoryId: number) => {
    if (selectedProducts.length === 0) {
      message.warning('Не выбраны товары для перемещения');
      return;
    }

    setMovingProducts(true);
    try {
      const response = await catalogApi.moveProducts(selectedProducts, targetCategoryId);
      
      if (response.success) {
        message.success(response.message || `Успешно перемещено ${selectedProducts.length} товаров`);
        setSelectedProducts([]); // Очищаем выбор
        setMoveModalVisible(false); // Закрываем модальное окно
        loadProducts(); // Перезагружаем товары
      } else {
        message.error(response.message || 'Ошибка при перемещении товаров');
      }
    } catch (error: any) {
      console.error('Error moving products:', error);
      message.error('Ошибка при перемещении товаров');
    } finally {
      setMovingProducts(false);
    }
  };

  // Функция экспорта каталога в Excel (Задача 9.2)
  const handleExportCatalog = async (selectedOnly: boolean = false) => {
    setExportingCatalog(true);
    try {
      // Формируем фильтры на основе текущих настроек
      const currentFilters: any = {
        search: searchText || undefined,
        categoryId: checkedCategories.length === 1 ? checkedCategories[0] : undefined,
        stockStatus: stockFilter !== 'all' ? 
          (stockFilter === 'critical' ? 'out_of_stock' as const: 
           stockFilter === 'low' ? 'low_stock' as const: 
           stockFilter === 'normal' ? 'in_stock' as const: undefined) : undefined,
        materialIds: selectedMaterials.length > 0 ? selectedMaterials : undefined,
        surfaceIds: selectedSurfaces.length > 0 ? selectedSurfaces : undefined,
        logoIds: selectedLogos.length > 0 ? selectedLogos : undefined,
        grades: selectedGrades.length > 0 ? selectedGrades : undefined,
        weightMin: weightFilter.min || undefined,
        weightMax: weightFilter.max || undefined,
        onlyInStock: onlyInStock || undefined,
        borderTypes: selectedBorderTypes.length > 0 ? selectedBorderTypes : undefined,
        // Новые фильтры для края ковра
        carpetEdgeTypes: selectedCarpetEdgeTypes.length > 0 ? selectedCarpetEdgeTypes : undefined,
        carpetEdgeSides: selectedCarpetEdgeSides.length > 0 ? selectedCarpetEdgeSides : undefined,
        carpetEdgeStrength: selectedCarpetEdgeStrength.length > 0 ? selectedCarpetEdgeStrength : undefined,
        // Фильтр по низу ковра
        bottomTypeIds: selectedBottomTypeIds.length > 0 ? selectedBottomTypeIds : undefined,
        sortBy,
        sortOrder
      };

      await catalogApi.exportCatalog({
        productIds: selectedOnly ? selectedProducts : undefined,
        filters: selectedOnly ? undefined : currentFilters
      });
      
      message.success(
        selectedOnly 
          ? `Экспорт ${selectedProducts.length} выбранных товаров завершен`
          : 'Экспорт каталога завершен'
      );
      
      // Очищаем выбор после экспорта выбранных товаров
      if (selectedOnly) {
        setSelectedProducts([]);
      }
      
    } catch (error: any) {
      console.error('Error exporting catalog:', error);
      message.error('Ошибка при экспорте каталога');
    } finally {
      setExportingCatalog(false);
    }
  };

  // Функция открытия модального окна удаления категории
  const handleDeleteCategory = (category: Category) => {
    setSelectedCategory(category);
    setDeleteCategoryModalVisible(true);
  };

  // Получение плоского списка категорий
  const getFlatCategories = (cats: Category[]): Category[] => {
    let result: Category[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children) {
        result.push(...getFlatCategories(cat.children));
      }
    });
    return result;
  };

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                <AppstoreOutlined style={{ marginRight: 12 }} />
                Каталог товаров
              </Title>
              <Text type="secondary">
                Поиск по названию, артикулу, размерам или категории
              </Text>
            </div>
            
            {canEditCatalog && (
              <Space>
                <Button 
                  icon={<PlusOutlined />}
                  onClick={() => setCreateCategoryModalVisible(true)}
                >
                  Добавить категорию
                </Button>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setCreateProductModalVisible(true)}
                >
                  Добавить товар
                </Button>
              </Space>
            )}
          </div>
        </Col>

        {/* Фильтры */}
        <Col span={24}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* Упрощенная строка поиска */}
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={16}>
                  <Search
                    placeholder="Поиск по названию, артикулу или размеру (например: Лежак, LCH-1800, 1800×1200)..."
                    allowClear
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="large"
                  />
                </Col>
                
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'right' }}>
                    <Button
                      icon={<FilterOutlined />}
                      type={showSizeFilters ? 'primary' : 'default'}
                      onClick={() => setShowSizeFilters(!showSizeFilters)}
                      size="large"
                    >
                      Расширенный фильтр {hasActiveFilters ? `(активно: ${getActiveFiltersCount()})` : ''}
                    </Button>
                  </div>
                </Col>
              </Row>

              {/* Расширенный фильтр */}
              {showSizeFilters && (
                <Collapse>
                  <Panel header="🎯 Расширенный фильтр товаров" key="1">
                    <Row gutter={16}>
                      {/* Фильтры по остаткам */}
                      <Col span={6}>
                        <Text strong>Наличие на складе</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select value={stockFilter} onChange={setStockFilter} style={{ width: '100%' }}>
                            <Option value="all">📦 Все товары</Option>
                            <Option value="normal">✅ В наличии</Option>
                            <Option value="low">⚠️ Мало</Option>
                            <Option value="critical">❌ Закончились</Option>
                          </Select>
                          <div style={{ marginTop: 8 }}>
                            <Checkbox 
                              checked={onlyInStock} 
                              onChange={(e: any) => setOnlyInStock(e.target.checked)}
                            >
                              🎯 Только в наличии
                            </Checkbox>
                          </div>
                        </div>
                      </Col>

                      {/* Фильтр по материалам (WBS 2 - Adjustments Задача 2.1) */}
                      <Col span={6}>
                        <Text strong>Материал</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedMaterials}
                            onChange={setSelectedMaterials}
                            placeholder="Выберите материалы"
                            style={{ width: '100%' }}
                            loading={loadingReferences}
                          >
                            {materials.map(material => (
                              <Option key={material.id} value={material.id}>
                                🧱 {material.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                      </Col>

                      {/* Фильтр по поверхностям (WBS 2 - Adjustments Задача 2.1) */}
                      <Col span={6}>
                        <Text strong>Поверхность</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedSurfaces}
                            onChange={setSelectedSurfaces}
                            placeholder="Выберите поверхности"
                            style={{ width: '100%' }}
                            loading={loadingReferences}
                          >
                            {surfaces.map(surface => (
                              <Option key={surface.id} value={surface.id}>
                                🎨 {surface.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                      </Col>

                      {/* Фильтр по сорту (WBS 2 - Adjustments Задача 2.1) */}
                      <Col span={6}>
                        <Text strong>Сорт товара</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedGrades}
                            onChange={setSelectedGrades}
                            placeholder="Выберите сорт"
                            style={{ width: '100%' }}
                          >
                            <Option value="usual">⭐ Обычный</Option>
                            <Option value="grade_2">⚠️ Второй сорт</Option>
                          </Select>
                        </div>
                      </Col>
                      
                      {/* Фильтр по логотипам (системный архитектор) */}
                      <Col span={6}>
                        <Text strong>Логотип</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedLogos}
                            onChange={setSelectedLogos}
                            placeholder="Выберите логотипы"
                            style={{ width: '100%' }}
                            loading={loadingReferences}
                          >
                            {logos.map(logo => (
                              <Option key={logo.id} value={logo.id}>
                                🏷️ {logo.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                      </Col>
                    </Row>

                    {/* Вторая строка фильтров */}
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      {/* Фильтр по весу (WBS 2 - Adjustments Задача 2.1) */}
                      <Col span={6}>
                        <Text strong>Вес (кг)</Text>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <InputNumber
                            placeholder="От"
                            value={weightFilter.min}
                            onChange={(value) => setWeightFilter(prev => ({ ...prev, min: value }))}
                            min={0}
                            step={0.1}
                            style={{ width: '100%' }}
                          />
                          <span>–</span>
                          <InputNumber
                            placeholder="До"
                            value={weightFilter.max}
                            onChange={(value) => setWeightFilter(prev => ({ ...prev, max: value }))}
                            min={0}
                            step={0.1}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Col>
                      
                      {/* Фильтр по наличию борта (Задача 7.1) */}
                      <Col span={6}>
                        <Text strong>Наличие борта</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedBorderTypes}
                            onChange={setSelectedBorderTypes}
                            placeholder="Выберите тип борта"
                            style={{ width: '100%' }}
                          >
                            <Option value="with_border">🔲 С бортом</Option>
                            <Option value="without_border">⚪ Без борта</Option>
                          </Select>
                        </div>
                      </Col>
                      
                      {/* Фильтр по краю ковра */}
                      <Col span={6}>
                        <Text strong>Край ковра</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedCarpetEdgeTypes}
                            onChange={setSelectedCarpetEdgeTypes}
                            placeholder="Выберите тип края"
                            style={{ width: '100%' }}
                            loading={loadingReferences}
                          >
                            {carpetEdgeTypes.map(type => (
                              <Option key={type.code} value={type.code}>
                                ✂️ {type.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                      </Col>
                      
                      {/* Фильтр по диапазону остатков (системный архитектор) */}
                      <Col span={6}>
                        <Text strong>Остатки на складе (шт)</Text>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <InputNumber
                            placeholder="От"
                            value={stockRangeFilter.min}
                            onChange={(value) => setStockRangeFilter(prev => ({ ...prev, min: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                          <span>–</span>
                          <InputNumber
                            placeholder="До"
                            value={stockRangeFilter.max}
                            onChange={(value) => setStockRangeFilter(prev => ({ ...prev, max: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Checkbox
                            checked={onlyInStock}
                            onChange={(e) => setOnlyInStock(e.target.checked)}
                          >
                            Только в наличии
                          </Checkbox>
                        </div>
                      </Col>

                                              {/* Условные фильтры для паззлового края ковра */}
                      <Col span={6}>
                        <Text strong>Количество сторон паззла</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedCarpetEdgeSides}
                            onChange={setSelectedCarpetEdgeSides}
                            placeholder="Количество сторон"
                            style={{ width: '100%' }}
                            disabled={!selectedCarpetEdgeTypes.includes('puzzle')}
                          >
                            <Option value={1}>🧩 1 сторона</Option>
                            <Option value={2}>🧩 2 стороны</Option>
                            <Option value={3}>🧩 3 стороны</Option>
                            <Option value={4}>🧩 4 стороны</Option>
                          </Select>
                        </div>
                      </Col>
                      
                      {/* Фильтр по усилению края */}
                      <Col span={6}>
                        <Text strong>Усиление края</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedCarpetEdgeStrength}
                            onChange={setSelectedCarpetEdgeStrength}
                            placeholder="Выберите усиление"
                            style={{ width: '100%' }}
                          >
                            <Option value="normal">⚪ Обычный</Option>
                            <Option value="reinforced">🔒 Усиленный</Option>
                          </Select>
                        </div>
                      </Col>
                      
                      {/* Фильтр по низу ковра */}
                      <Col span={6}>
                        <Text strong>Низ ковра</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedBottomTypeIds}
                            onChange={setSelectedBottomTypeIds}
                            placeholder="Выберите низ ковра"
                            style={{ width: '100%' }}
                          >
                            {bottomTypes.map(type => (
                              <Option key={type.id} value={type.id}>
                                🔽 {type.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                      </Col>

                      {/* Фильтр по типам паззла */}
                      <Col span={6}>
                        <Text strong>Тип паззла</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedPuzzleTypeIds}
                            onChange={setSelectedPuzzleTypeIds}
                            placeholder="Выберите тип паззла"
                            style={{ width: '100%' }}
                          >
                            {puzzleTypes.map(type => (
                              <Option key={type.id} value={type.id}>
                                🧩 {type.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                      </Col>
                    </Row>

                    {/* Третья строка фильтров */}
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      {/* Фильтры по размерам */}
                      <Col span={8}>
                        <Text strong>Длина (мм)</Text>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <InputNumber
                            placeholder="От"
                            value={sizeFilters.lengthMin}
                            onChange={(value) => setSizeFilters(prev => ({ ...prev, lengthMin: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                          <span>–</span>
                          <InputNumber
                            placeholder="До"
                            value={sizeFilters.lengthMax}
                            onChange={(value) => setSizeFilters(prev => ({ ...prev, lengthMax: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Col>
                      
                      <Col span={8}>
                        <Text strong>Ширина (мм)</Text>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <InputNumber
                            placeholder="От"
                            value={sizeFilters.widthMin}
                            onChange={(value) => setSizeFilters(prev => ({ ...prev, widthMin: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                          <span>–</span>
                          <InputNumber
                            placeholder="До"
                            value={sizeFilters.widthMax}
                            onChange={(value) => setSizeFilters(prev => ({ ...prev, widthMax: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Col>
                      
                      <Col span={8}>
                        <Text strong>Высота (мм)</Text>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <InputNumber
                            placeholder="От"
                            value={sizeFilters.thicknessMin}
                            onChange={(value) => setSizeFilters(prev => ({ ...prev, thicknessMin: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                          <span>–</span>
                          <InputNumber
                            placeholder="До"
                            value={sizeFilters.thicknessMax}
                            onChange={(value) => setSizeFilters(prev => ({ ...prev, thicknessMax: value }))}
                            min={0}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Col>
                    </Row>
                  </Panel>
                </Collapse>
              )}

              {/* Индикатор результатов */}
              <Row>
                <Col span={24}>
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <Text type="secondary">
                      📊 Найдено: <Text strong>{filteredProducts.length}</Text> товаров
                      {checkedCategories.length > 0 && (
                        <Text type="secondary"> в выбранных категориях</Text>
                      )}
                      {hasSizeFilters && (
                        <Text type="secondary"> с фильтрами размеров</Text>
                      )}
                    </Text>
                  </div>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>

        {/* Основной контент */}
        <Col span={24}>
          <Row gutter={16}>
            {/* Категории с множественным выбором */}
            <Col xs={24} lg={6}>
              <Card title="📂 Категории" size="small">
                <Tree
                  checkable
                  showLine
                  defaultExpandedKeys={['lejaki', 'kovriki']}
                  checkedKeys={checkedCategories}
                  onCheck={handleCategoryCheck}
                  onSelect={handleTreeSelect}
                  treeData={formatCategoriesForTree(categories, products)}
                />
                {checkedCategories.length > 0 && (
                  <div style={{ marginTop: 12, padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Выбрано категорий: {checkedCategories.length}
                    </Text>
                    <br />
                    <Space style={{ marginTop: 4 }}>
                      <Button 
                        size="small" 
                        onClick={() => setCheckedCategories([])}
                      >
                        Сбросить выбор
                      </Button>
                                              {canDelete('catalog') && checkedCategories.length === 1 && (
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const categoryToDelete = getFlatCategories(categories).find(cat => cat.id === checkedCategories[0]);
                            if (categoryToDelete) {
                              handleDeleteCategory(categoryToDelete);
                            }
                          }}
                          title="Удалить выбранную категорию"
                        >
                          Удалить
                        </Button>
                      )}
                    </Space>
                  </div>
                )}
              </Card>


            </Col>

            {/* Список товаров */}
            <Col xs={24} lg={18}>
              {/* Элементы управления сортировкой (Задача 7.2) */}
              <Card size="small" style={{ marginBottom: 16 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space>
                      <Text strong>Сортировка:</Text>
                      <Select
                        value={sortBy}
                        onChange={setSortBy}
                        style={{ width: 180 }}
                        size="small"
                      >
                        <Option value="name">📝 По названию</Option>
                        <Option value="matArea">📏 По площади (размеру)</Option>
                        <Option value="price">💰 По цене</Option>
                        <Option value="weight">⚖️ По весу</Option>
                      </Select>
                      <Select
                        value={sortOrder}
                        onChange={setSortOrder}
                        style={{ width: 120 }}
                        size="small"
                      >
                        <Option value="ASC">🔼 По возрастанию</Option>
                        <Option value="DESC">🔽 По убыванию</Option>
                      </Select>
                    </Space>
                  </Col>
                  <Col>
                    <Space>
                      {selectedProducts.length > 0 && (
                        <>
                          <Button
                            type="primary"
                            size="small"
                            icon={<AppstoreOutlined />}
                            onClick={() => setMoveModalVisible(true)}
                            disabled={selectedProducts.length === 0}
                            loading={movingProducts}
                          >
                            Переместить в категорию ({selectedProducts.length})
                          </Button>
                          <Button
                            size="small"
                            icon={<InboxOutlined />}
                            onClick={() => handleExportCatalog(true)}
                            loading={exportingCatalog}
                            disabled={selectedProducts.length === 0}
                          >
                            Экспорт выбранных ({selectedProducts.length})
                          </Button>
                        </>
                      )}
                      
                      {/* Кнопка экспорта всего каталога с фильтрами (Задача 9.2) */}
                      <Button
                        size="small"
                        icon={<InboxOutlined />}
                        onClick={() => handleExportCatalog(false)}
                        loading={exportingCatalog}
                        title="Экспорт текущего списка товаров с примененными фильтрами"
                      >
                        📊 Экспорт каталога
                      </Button>
                      
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        📊 Найдено: <Text strong>{totalProducts}</Text> товаров
                      </Text>
                    </Space>
                  </Col>
                </Row>
              </Card>
              
              <Table
                dataSource={paginatedProducts}
                pagination={false}
                size="small"
                rowKey="id"
                scroll={{ x: 800 }}
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedProducts,
                  onChange: (selectedRowKeys: React.Key[]) => {
                    setSelectedProducts(selectedRowKeys as number[]);
                  },
                  onSelectAll: (selected: boolean, selectedRows: Product[], changeRows: Product[]) => {
                    if (selected) {
                      const allProductIds = paginatedProducts.map(p => p.id);
                      setSelectedProducts(allProductIds);
                    } else {
                      setSelectedProducts([]);
                    }
                  },
                }}
                columns={[
                  {
                    title: 'Товар',
                    key: 'product',
                    width: 300,
                    render: (_: any, product: Product) => (
                      <div>
                        <Text strong>{product.name}</Text>
                        <br />
                        <Space>
                          <Tag>{product.article}</Tag>
                          {product.grade === 'grade_2' && (
                            <Tag color="orange">⚠️ Второй сорт</Tag>
                          )}
                        </Space>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {product.categoryName}
                        </Text>
                      </div>
                    ),
                  },
                  {
                    title: 'Размеры (мм)',
                    key: 'dimensions',
                    width: 140,
                    render: (_: any, product: Product) => {
                      const dimensions = product.dimensions || { length: 0, width: 0, thickness: 0 };
                      return (
                        <Tag color="blue">
                          {dimensions.length}×{dimensions.width}×{dimensions.thickness}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Остатки',
                    key: 'stock',
                    width: 120,
                    align: 'center' as const,
                    render: (_: any, product: Product) => {
                      const currentStock = product.stock?.currentStock || product.currentStock || 0;
                      const reservedStock = product.stock?.reservedStock || product.reservedStock || 0;
                      const available = (product.currentStock || 0) - (product.reservedStock || 0);
                      const stockStatus = getStockStatus(available, product.normStock || 0);
                      return (
                        <div>
                          <Badge color={stockStatus.color} />
                          <Text strong style={{ color: available < 0 ? '#ff4d4f' : 'inherit' }}>
                            {available < 0 ? '⚠️ ' : ''}{available} шт
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            всего: {currentStock}
                          </Text>
                          {available < 0 && (
                            <>
                              <br />
                              <Text type="danger" style={{ fontSize: '10px' }}>
                                Перезаказ: {Math.abs(available)} шт
                              </Text>
                            </>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Цена',
                    key: 'price',
                    width: 120,
                    align: 'right' as const,
                    render: (_: any, product: Product) => (
                      <div>
                        <Text strong style={{ color: '#1890ff' }}>
                          {product.price ? product.price.toLocaleString() : '—'}₽
                        </Text>
                        {product.price && (
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                            за шт
                          </Text>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: 'Действия',
                    key: 'actions',
                    width: 160,
                    align: 'center' as const,
                    render: (_: any, product: Product) => (
                      <Space size="small">
                        <Button 
                          size="small"
                          onClick={() => navigate(`/catalog/products/${product.id}`)}
                        >
                          Детали
                        </Button>

                        {canEditCatalog && (
                          <Button 
                            size="small" 
                            danger
                            onClick={() => handleDeleteProduct(product)}
                          >
                            Удалить
                          </Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />

              {/* Пагинация */}
              {totalPages > 1 && (
                <Card style={{ marginTop: 16, textAlign: 'center' }} size="small">
                  <Space>
                    <Button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      ← Пред
                    </Button>
                    
                    <Text>Страница {currentPage} из {totalPages}</Text>
                    
                    <Button 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      След →
                    </Button>
                  </Space>
                </Card>
              )}

              {/* Сообщения о состоянии */}
              {!loading && products.length === 0 && (
                <Card style={{ textAlign: 'center', marginTop: 16 }}>
                  <Text type="secondary">
                    <InboxOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                    Товары в каталоге отсутствуют
                  </Text>
                </Card>
              )}

              {!loading && paginatedProducts.length === 0 && products.length > 0 && (
                <Card style={{ textAlign: 'center', marginTop: 16 }}>
                  <Text type="secondary">
                    <InboxOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                    По заданным критериям товары не найдены
                  </Text>
                  {(searchText || checkedCategories.length > 0 || stockFilter !== 'all' || hasSizeFilters) && (
                    <Button onClick={() => {
                      setSearchText('');
                      setCheckedCategories([]);
                      setStockFilter('all');
                      setSizeFilters({
                        lengthMin: null, lengthMax: null,
                        widthMin: null, widthMax: null,
                        thicknessMin: null, thicknessMax: null,
                      });
                      setCurrentPage(1);
                    }}>
                      Сбросить все фильтры
                    </Button>
                  )}
                </Card>
              )}
              
              {!loading && products.length === 0 && (
                <Card style={{ textAlign: 'center', marginTop: 16 }}>
                  <Text type="secondary">
                    <InboxOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                    Каталог товаров пуст
                  </Text>
                  <Text type="secondary">
                    Добавьте товары через кнопку "Добавить товар"
                  </Text>
                </Card>
              )}
            </Col>
          </Row>
        </Col>

        {/* Компактная сводка */}
        {filteredProducts.length > 0 && (
          <Col span={24}>
            <Card size="small">
              <Row gutter={16}>
                <Col span={8}>
                  <Text>💾 Остаток: <Text strong>{filteredProducts.reduce((sum, p) => sum + (p.currentStock || 0), 0)}</Text></Text>
                </Col>
                <Col span={8}>
                  <Text>📦 Доступно: <Text strong>{filteredProducts.reduce((sum, p) => sum + ((p.currentStock || 0) - (p.reservedStock || 0)), 0)}</Text></Text>
                </Col>
                <Col span={8}>
                  <Text>📊 Позиций: <Text strong>{filteredProducts.length}</Text></Text>
                </Col>
              </Row>
            </Card>
          </Col>
        )}
      </Row>

      {/* Модальное окно создания товара */}
      <CreateProductModal
        visible={createProductModalVisible}
        categories={categories}
        onClose={() => setCreateProductModalVisible(false)}
        onSuccess={() => {
          loadData(); // Перезагружаем данные после создания товара
        }}
      />

      {/* Модальное окно создания категории */}
      <CreateCategoryModal
        visible={createCategoryModalVisible}
        categories={categories}
        onClose={() => setCreateCategoryModalVisible(false)}
        onSuccess={() => {
          loadData(); // Перезагружаем данные после создания категории
        }}
      />

      {/* Модальное окно удаления категории */}
      <DeleteCategoryModal
        visible={deleteCategoryModalVisible}
        category={selectedCategory}
        categories={categories}
        onClose={() => {
          setDeleteCategoryModalVisible(false);
          setSelectedCategory(null);
        }}
        onSuccess={() => {
          loadData(); // Перезагружаем данные после удаления категории
        }}
      />

      {/* Модальное окно переноса товаров между категориями (Задача 7.3) */}
      <Modal
        title="Переместить товары в категорию"
        open={moveModalVisible}
        onCancel={() => !movingProducts && setMoveModalVisible(false)}
        footer={null}
        width={600}
        closable={!movingProducts}
        maskClosable={!movingProducts}
      >
        {movingProducts ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <Text style={{ display: 'block', marginTop: 16 }}>
              Перемещение товаров...
            </Text>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text>
                Выбрано товаров: <Text strong>{selectedProducts.length}</Text>
              </Text>
            </div>
            
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Выберите категорию назначения:
            </Text>
            
            <div style={{ 
              border: '1px solid #d9d9d9', 
              borderRadius: '6px', 
              padding: '12px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <Tree
                showLine
                defaultExpandedKeys={categories.map(c => c.id.toString())}
                onSelect={(selectedKeys) => {
                  if (selectedKeys.length > 0) {
                    const categoryId = parseInt(selectedKeys[0] as string);
                    handleMoveProducts(categoryId);
                  }
                }}
                treeData={categories.map(category => ({
                  title: `📁 ${category.name}`,
                  key: category.id.toString(),
                  children: category.children?.map(child => ({
                    title: `📁 ${child.name}`,
                    key: child.id.toString()
                  }))
                }))}
              />
            </div>
            
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button onClick={() => setMoveModalVisible(false)}>
                Отмена
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Catalog; 