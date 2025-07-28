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
import { logosApi } from '../services/logosApi';
import { puzzleTypesApi } from '../services/puzzleTypesApi';
import { materialsApi } from '../services/materialsApi';
import { surfacesApi } from '../services/surfacesApi';
import CreateProductModal from '../components/CreateProductModal';
import CreateCategoryModal from '../components/CreateCategoryModal';
import DeleteCategoryModal from '../components/DeleteCategoryModal';

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
  const [pageSize] = useState(4); // 4 товара на страницу
  const [showSizeFilters, setShowSizeFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [createProductModalVisible, setCreateProductModalVisible] = useState(false);
  const [createCategoryModalVisible, setCreateCategoryModalVisible] = useState(false);
  const [deleteCategoryModalVisible, setDeleteCategoryModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Новые фильтры для WBS 2 - Adjustments Задача 2.1
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [selectedSurfaces, setSelectedSurfaces] = useState<number[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [weightFilter, setWeightFilter] = useState({
    min: null as number | null,
    max: null as number | null
  });
  const [onlyInStock, setOnlyInStock] = useState(false);
  
  // Расширенные фильтры для системного архитектора
  const [selectedLogos, setSelectedLogos] = useState<number[]>([]);
  const [selectedPuzzleTypes, setSelectedPuzzleTypes] = useState<number[]>([]);
  const [selectedPuzzleSides, setSelectedPuzzleSides] = useState<string[]>([]);
  const [stockRangeFilter, setStockRangeFilter] = useState({
    min: null as number | null,
    max: null as number | null
  });
  
  // Справочники для фильтров
  const [materials, setMaterials] = useState<any[]>([]);
  const [surfaces, setSurfaces] = useState<any[]>([]);
  const [logos, setLogos] = useState<any[]>([]);
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

  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const { message } = App.useApp();

  // Загрузка данных
  useEffect(() => {
    if (token) {
      loadData();
      loadReferences();
    }
  }, [token]);

  const loadData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      // Загружаем категории и товары параллельно
      const [categoriesResponse, productsResponse] = await Promise.all([
        catalogApi.getCategories(),
        catalogApi.getProducts({ page: 1, limit: 100 })
      ]);

      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data);
      }

      if (productsResponse.success) {
        setProducts(productsResponse.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных каталога:', error);
      message.error('Ошибка загрузки данных каталога');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка справочников для фильтров (унифицированная для системного архитектора)
  const loadReferences = async () => {
    if (!token) return;
    
    setLoadingReferences(true);
    try {
      const [materialsResponse, surfacesResponse, logosResponse, puzzleTypesResponse] = await Promise.all([
        materialsApi.getMaterials(token),
        surfacesApi.getSurfaces(token),
        logosApi.getLogos(token),
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

      if (puzzleTypesResponse.success) {
        setPuzzleTypes(puzzleTypesResponse.data);
        console.log('🧩 Типы паззлов загружены:', puzzleTypesResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки типов паззлов:', puzzleTypesResponse);
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

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    return products.filter((product: Product) => {
      // Поиск по названию, артикулу и размерам
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const dimensionsString = product.dimensions 
          ? `${product.dimensions.length}×${product.dimensions.width}×${product.dimensions.thickness}` 
          : '';
        const searchMatch = 
          product.name.toLowerCase().includes(searchLower) ||
          (product.article && product.article.toLowerCase().includes(searchLower)) ||
          dimensionsString.includes(searchText) ||
          (product.categoryName && product.categoryName.toLowerCase().includes(searchLower));
        
        if (!searchMatch) return false;
      }
      
      // Фильтр по категории
      if (checkedCategories.length > 0) {
        if (!checkedCategories.includes(product.categoryId)) {
          return false;
        }
      }
      
      // Фильтр "Только в наличии" (WBS 2 - Adjustments Задача 2.1)
      if (onlyInStock) {
        const available = product.availableStock || ((product.currentStock || 0) - (product.reservedStock || 0));
        if (available <= 0) return false;
      }
      
      // Фильтр по остаткам (старый)
      if (stockFilter !== 'all') {
        const available = product.availableStock || ((product.currentStock || 0) - (product.reservedStock || 0));
        const norm = product.normStock || 0;
        
        let statusMatch = false;
        switch (stockFilter) {
          case 'critical':
            statusMatch = available <= 0;
            break;
          case 'low':
            statusMatch = available > 0 && available < norm * 0.5;
            break;
          case 'normal':
            statusMatch = available > 0; // ИСПРАВЛЕНО: только товары которые есть в наличии
            break;
        }
        
        if (!statusMatch) return false;
      }
      
      // Фильтр по материалам (WBS 2 - Adjustments Задача 2.1)
      if (selectedMaterials.length > 0) {
        if (!product.materialId || !selectedMaterials.includes(product.materialId)) {
          return false;
        }
      }
      
      // Фильтр по поверхностям (WBS 2 - Adjustments Задача 2.1)
      if (selectedSurfaces.length > 0) {
        if (!product.surfaceId || !selectedSurfaces.includes(product.surfaceId)) {
          return false;
        }
      }
      
      // Фильтр по сорту товара (WBS 2 - Adjustments Задача 2.1)
      if (selectedGrades.length > 0) {
        const grade = product.grade || 'usual';
        if (!selectedGrades.includes(grade)) {
          return false;
        }
      }
      
      // Фильтр по весу (WBS 2 - Adjustments Задача 2.1)
      if (weightFilter.min !== null || weightFilter.max !== null) {
        const weight = product.weight ? parseFloat(product.weight.toString()) : 0;
        if (weightFilter.min !== null && weight < weightFilter.min) return false;
        if (weightFilter.max !== null && weight > weightFilter.max) return false;
      }
      
      // Фильтр по логотипам (расширение для системного архитектора)
      if (selectedLogos.length > 0) {
        if (!product.logoId || !selectedLogos.includes(product.logoId)) {
          return false;
        }
      }
      
      // Фильтр по типам паззлов (условный, только для поверхности "Паззл")
      if (selectedPuzzleTypes.length > 0 || selectedPuzzleSides.length > 0) {
        if (!product.puzzleOptions || !product.puzzleOptions.enabled) {
          return false;
        }
        
        // Фильтр по типу паззла
        if (selectedPuzzleTypes.length > 0) {
          const puzzleType = puzzleTypes.find(pt => pt.code === product.puzzleOptions?.type);
          if (!puzzleType || !selectedPuzzleTypes.includes(puzzleType.id)) {
            return false;
          }
        }
        
        // Фильтр по количеству сторон паззла
        if (selectedPuzzleSides.length > 0) {
          if (!product.puzzleOptions.sides || !selectedPuzzleSides.includes(product.puzzleOptions.sides)) {
            return false;
          }
        }
      }
      
      // Фильтр по диапазону остатков (замена onlyInStock)
      if (stockRangeFilter.min !== null || stockRangeFilter.max !== null) {
        const available = product.availableStock || ((product.currentStock || 0) - (product.reservedStock || 0));
        if (stockRangeFilter.min !== null && available < stockRangeFilter.min) return false;
        if (stockRangeFilter.max !== null && available > stockRangeFilter.max) return false;
      }
      
      // Фильтры по размерам
      if (product.dimensions) {
        const { length, width, thickness } = product.dimensions;
        
        if (sizeFilters.lengthMin && length < sizeFilters.lengthMin) return false;
        if (sizeFilters.lengthMax && length > sizeFilters.lengthMax) return false;
        if (sizeFilters.widthMin && width < sizeFilters.widthMin) return false;
        if (sizeFilters.widthMax && width > sizeFilters.widthMax) return false;
        if (sizeFilters.thicknessMin && thickness < sizeFilters.thicknessMin) return false;
        if (sizeFilters.thicknessMax && thickness > sizeFilters.thicknessMax) return false;
      }
      
      return true;
    });
  }, [products, searchText, checkedCategories, stockFilter, sizeFilters, selectedMaterials, selectedSurfaces, selectedGrades, weightFilter, onlyInStock, selectedLogos, selectedPuzzleTypes, selectedPuzzleSides, stockRangeFilter, puzzleTypes]);

  // Пагинация
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

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
    setWeightFilter({ min: null, max: null });
    setOnlyInStock(false);
    
    // Новые фильтры
    setSelectedLogos([]);
    setSelectedPuzzleTypes([]);
    setSelectedPuzzleSides([]);
    setStockRangeFilter({ min: null, max: null });
    
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
    setCurrentPage(1);
  };

  // Сброс фильтров товарных характеристик
  const clearProductFilters = () => {
    setSelectedGrades([]);
    setWeightFilter({ min: null, max: null });
    setSelectedPuzzleTypes([]);
    setSelectedPuzzleSides([]);
    setCurrentPage(1);
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
    weightFilter.min !== null || 
    weightFilter.max !== null ||
    selectedLogos.length > 0 ||
    selectedPuzzleTypes.length > 0 ||
    selectedPuzzleSides.length > 0 ||
    stockRangeFilter.min !== null ||
    stockRangeFilter.max !== null;
  
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
      (selectedPuzzleTypes.length > 0 ? 1 : 0) +
      (selectedPuzzleSides.length > 0 ? 1 : 0) +
      (selectedGrades.length > 0 ? 1 : 0) +
      (weightFilter.min !== null || weightFilter.max !== null ? 1 : 0) +
      (stockRangeFilter.min !== null || stockRangeFilter.max !== null ? 1 : 0) +
      (onlyInStock ? 1 : 0)
    );
  };

  // Проверка есть ли любые активные фильтры
  const hasActiveFilters = getActiveFiltersCount() > 0;

  const canEdit = user?.role === 'director' || user?.role === 'manager';

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
            
            {canEdit && (
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

                                              {/* Условные фильтры для паззлов (системный архитектор) */}
                      <Col span={6}>
                        <Text strong>Тип паззла</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            mode="multiple"
                            value={selectedPuzzleTypes}
                            onChange={setSelectedPuzzleTypes}
                            placeholder="Выберите типы паззлов"
                            style={{ width: '100%' }}
                            loading={loadingReferences}
                            disabled={!selectedSurfaces.some(surfaceId => {
                              const surface = surfaces.find(s => s.id === surfaceId);
                              return surface?.name === 'Паззл';
                            })}
                          >
                            {puzzleTypes.map(type => (
                              <Option key={type.id} value={type.id}>
                                🧩 {type.name}
                              </Option>
                            ))}
                          </Select>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Text strong>Стороны паззла</Text>
                          <Select
                            mode="multiple"
                            value={selectedPuzzleSides}
                            onChange={setSelectedPuzzleSides}
                            placeholder="Количество сторон"
                            style={{ width: '100%', marginTop: 4 }}
                            disabled={!selectedSurfaces.some(surfaceId => {
                              const surface = surfaces.find(s => s.id === surfaceId);
                              return surface?.name === 'Паззл';
                            })}
                          >
                            <Option value="1_side">🧩 1 сторона</Option>
                            <Option value="2_sides">🧩 2 стороны</Option>
                            <Option value="3_sides">🧩 3 стороны</Option>
                            <Option value="4_sides">🧩 4 стороны</Option>
                          </Select>
                        </div>
                      </Col>

                      {/* Быстрые размеры */}
                      <Col span={6}>
                        <Text strong>Быстрые размеры</Text>
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {popularSizes.map(size => (
                            <Button
                              key={size}
                              size="small"
                              type={searchText === size ? 'primary' : 'default'}
                              onClick={() => setSearchText(searchText === size ? '' : size)}
                              style={{ textAlign: 'left' }}
                            >
                              📏 {size}
                            </Button>
                          ))}
                        </div>
                      </Col>

                      {/* Диапазоны размеров */}
                      <Col span={6}>
                        <Text strong>По категории размера</Text>
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {quickSizeRanges.map((range, index) => (
                            <Button
                              key={index}
                              size="small"
                              onClick={() => applyQuickSizeRange(range)}
                              style={{ textAlign: 'left' }}
                            >
                              📐 {range.label}
                            </Button>
                          ))}
                          {hasSizeFilters && (
                            <Button size="small" icon={<ClearOutlined />} onClick={clearSizeFilters} danger>
                              Сбросить размеры
                            </Button>
                          )}
                        </div>
                      </Col>
                    </Row>

                    {/* Точные диапазоны размеров */}
                    <div style={{ marginTop: 16 }}>
                      <Text strong>Точные диапазоны размеров (мм)</Text>
                      <Row gutter={16} style={{ marginTop: 8 }}>
                        <Col span={8}>
                          <Text>Длина</Text>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <InputNumber
                              placeholder="от"
                              value={sizeFilters.lengthMin}
                              onChange={(value) => setSizeFilters({...sizeFilters, lengthMin: value})}
                              style={{ width: '50%' }}
                              min={0}
                            />
                            <InputNumber
                              placeholder="до"
                              value={sizeFilters.lengthMax}
                              onChange={(value) => setSizeFilters({...sizeFilters, lengthMax: value})}
                              style={{ width: '50%' }}
                              min={0}
                            />
                          </div>
                        </Col>
                        <Col span={8}>
                          <Text>Ширина</Text>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <InputNumber
                              placeholder="от"
                              value={sizeFilters.widthMin}
                              onChange={(value) => setSizeFilters({...sizeFilters, widthMin: value})}
                              style={{ width: '50%' }}
                              min={0}
                            />
                            <InputNumber
                              placeholder="до"
                              value={sizeFilters.widthMax}
                              onChange={(value) => setSizeFilters({...sizeFilters, widthMax: value})}
                              style={{ width: '50%' }}
                              min={0}
                            />
                          </div>
                        </Col>
                        <Col span={8}>
                          <Text>Толщина</Text>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <InputNumber
                              placeholder="от"
                              value={sizeFilters.thicknessMin}
                              onChange={(value) => setSizeFilters({...sizeFilters, thicknessMin: value})}
                              style={{ width: '50%' }}
                              min={0}
                            />
                            <InputNumber
                              placeholder="до"
                              value={sizeFilters.thicknessMax}
                              onChange={(value) => setSizeFilters({...sizeFilters, thicknessMax: value})}
                              style={{ width: '50%' }}
                              min={0}
                            />
                          </div>
                        </Col>
                      </Row>
                    </div>

                    {/* Кнопки управления фильтрами */}
                    {hasActiveFilters && (
                      <div style={{ 
                        marginTop: 20, 
                        padding: '12px 16px', 
                        backgroundColor: '#f8f9fa', 
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                      }}>
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <div>
                            <Text type="secondary" style={{ fontSize: '14px' }}>
                              🎯 Активных фильтров: <Text strong>{getActiveFiltersCount()}</Text>
                            </Text>
                          </div>
                          <Button 
                            type="primary"
                            danger
                            icon={<ClearOutlined />} 
                            onClick={clearAllFilters}
                            size="middle"
                          >
                            Сбросить все
                          </Button>
                        </div>
                        
                        {/* Быстрый сброс групп фильтров */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {(stockFilter !== 'all' || onlyInStock || stockRangeFilter.min !== null || stockRangeFilter.max !== null) && (
                            <Button 
                              size="small" 
                              onClick={clearStockFilters}
                              icon={<ClearOutlined />}
                            >
                              📦 Остатки
                            </Button>
                          )}
                          {(selectedMaterials.length > 0 || selectedSurfaces.length > 0 || selectedLogos.length > 0) && (
                            <Button 
                              size="small" 
                              onClick={clearMaterialFilters}
                              icon={<ClearOutlined />}
                            >
                              🧱 Материалы
                            </Button>
                          )}
                          {(selectedGrades.length > 0 || weightFilter.min !== null || weightFilter.max !== null || selectedPuzzleTypes.length > 0 || selectedPuzzleSides.length > 0) && (
                            <Button 
                              size="small" 
                              onClick={clearProductFilters}
                              icon={<ClearOutlined />}
                            >
                              🏷️ Характеристики
                            </Button>
                          )}
                          {hasSizeFilters && (
                            <Button 
                              size="small" 
                              onClick={clearSizeFilters}
                              icon={<ClearOutlined />}
                            >
                              📏 Размеры
                            </Button>
                          )}
                          {checkedCategories.length > 0 && (
                            <Button 
                              size="small" 
                              onClick={() => {
                                setCheckedCategories([]);
                                setCurrentPage(1);
                              }}
                              icon={<ClearOutlined />}
                            >
                              📂 Категории
                            </Button>
                          )}
                          {searchText && (
                            <Button 
                              size="small" 
                              onClick={() => {
                                setSearchText('');
                                setCurrentPage(1);
                              }}
                              icon={<ClearOutlined />}
                            >
                              🔍 Поиск
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
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
                      {user?.role === 'director' && checkedCategories.length === 1 && (
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
              <Table
                dataSource={paginatedProducts}
                pagination={false}
                size="small"
                rowKey="id"
                scroll={{ x: 800 }}
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
                      const { length, width, thickness } = dimensions;
                      return (
                        <Tag color="blue">
                          {length}×{width}×{thickness}
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
                      const stockStatus = getStockStatus(currentStock, reservedStock);
                      const available = currentStock - reservedStock;
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

                        {canEdit && (
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
    </div>
  );
};

export default Catalog; 