import React, { useState, useMemo, useEffect } from 'react';
import { Row, Col, Card, Tree, Input, Button, Space, Typography, Tag, Badge, Select, InputNumber, Collapse, message, Spin, Table, Modal } from 'antd';
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

  // Загрузка данных
  useEffect(() => {
    if (token) {
      loadData();
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
      
      // Фильтр по остаткам
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
  }, [products, searchText, checkedCategories, stockFilter, sizeFilters]);

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

  // Проверка есть ли активные фильтры размеров
  const hasSizeFilters = Object.values(sizeFilters).some(value => value !== null);

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
              {/* Основная строка поиска и фильтров */}
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <Search
                    placeholder="Поиск: Лежак, LCH-1800, 1800×1200..."
                    allowClear
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="large"
                  />
                </Col>
                
                <Col xs={24} md={8}>
                  <Space>
                    <Text>📦 Остатки:</Text>
                    <Select value={stockFilter} onChange={setStockFilter} style={{ width: 120 }}>
                      <Option value="all">Все</Option>
                      <Option value="normal">В наличии</Option>
                      <Option value="low">Мало</Option>
                      <Option value="critical">Закончились</Option>
                    </Select>
                  </Space>
                </Col>
                
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'right' }}>
                    <Button
                      icon={<FilterOutlined />}
                      type={showSizeFilters ? 'primary' : 'default'}
                      onClick={() => setShowSizeFilters(!showSizeFilters)}
                    >
                      Фильтры размеров {hasSizeFilters ? '(активны)' : ''}
                    </Button>
                  </div>
                </Col>
              </Row>

              {/* Быстрые размеры */}
              <Row gutter={[8, 8]} align="middle">
                <Col>
                  <Text>📏 Быстрый поиск:</Text>
                </Col>
                {popularSizes.map(size => (
                  <Col key={size}>
                    <Button
                      size="small"
                      type={searchText === size ? 'primary' : 'default'}
                      onClick={() => setSearchText(searchText === size ? '' : size)}
                    >
                      {size}
                    </Button>
                  </Col>
                ))}
                <Col>
                  <Text style={{ marginLeft: 16 }}>🔧 По размеру:</Text>
                </Col>
                {quickSizeRanges.map((range, index) => (
                  <Col key={index}>
                    <Button
                      size="small"
                      onClick={() => applyQuickSizeRange(range)}
                    >
                      {range.label}
                    </Button>
                  </Col>
                ))}
                {hasSizeFilters && (
                  <Col>
                    <Button size="small" icon={<ClearOutlined />} onClick={clearSizeFilters}>
                      Сбросить
                    </Button>
                  </Col>
                )}
              </Row>

              {/* Расширенные фильтры размеров */}
              {showSizeFilters && (
                <Collapse>
                  <Panel header="🎯 Точные диапазоны размеров" key="1">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Text strong>Длина (мм)</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                        <Text strong>Ширина (мм)</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                        <Text strong>Толщина (мм)</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                        <Tag>{product.article}</Tag>
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