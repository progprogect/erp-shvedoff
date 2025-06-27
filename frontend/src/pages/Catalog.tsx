import React, { useState, useMemo } from 'react';
import { Row, Col, Card, Tree, Input, Button, Space, Typography, Tag, Badge, Select, InputNumber, Collapse } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  AppstoreOutlined,
  InboxOutlined,
  BorderOutlined,
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Panel } = Collapse;

// Заглушки данных - в будущем будут загружаться из API
const mockCategories = [
  {
    title: '📁 Лежаки резиновые (4)',
    key: 'lejaki',
    children: [
      { title: '📁 Чешские (4)', key: 'cheshskie' },
      { title: '📁 3-Корончатые (0)', key: '3koron' },
      { title: '📁 Брендовые (0)', key: 'brendovie' }
    ]
  },
  {
    title: '📁 Коврики (1)',
    key: 'kovriki',
    children: [
      { title: '📁 Кольцевые (1)', key: 'kolcevie' },
      { title: '📁 Придверные (0)', key: 'pridvernie' }
    ]
  },
  {
    title: '📁 Рулонные покрытия (1)',
    key: 'rulonnie'
  },
  {
    title: '📁 Крепежные изделия (0)',
    key: 'krepej'
  }
];

const mockProducts = [
  {
    id: 1,
    name: 'Лежак 0 Чеш 1800×1200×30',
    article: 'LCH-1800-1200-30',
    category: 'cheshskie',
    parentCategory: 'lejaki',
    categoryName: 'Чешские',
    dimensions: { length: 1800, width: 1200, thickness: 30 },
    currentStock: 145,
    reservedStock: 23,
    price: 15430,
    updated: '25.06.25'
  },
  {
    id: 2,
    name: 'Лежак 0 Чеш 1800×1200×35',
    article: 'LCH-1800-1200-35',
    category: 'cheshskie',
    parentCategory: 'lejaki',
    categoryName: 'Чешские',
    dimensions: { length: 1800, width: 1200, thickness: 35 },
    currentStock: 89,
    reservedStock: 12,
    price: 16780,
    updated: '24.06.25'
  },
  {
    id: 3,
    name: 'Лежак 0 Чеш 1800×1200×40',
    article: 'LCH-1800-1200-40',
    category: 'cheshskie',
    parentCategory: 'lejaki',
    categoryName: 'Чешские',
    dimensions: { length: 1800, width: 1200, thickness: 40 },
    currentStock: 67,
    reservedStock: 5,
    price: 18920,
    updated: '23.06.25'
  },
  {
    id: 4,
    name: 'Лежак 0 Чеш 1600×1000×30',
    article: 'LCH-1600-1000-30',
    category: 'cheshskie',
    parentCategory: 'lejaki',
    categoryName: 'Чешские',
    dimensions: { length: 1600, width: 1000, thickness: 30 },
    currentStock: 34,
    reservedStock: 8,
    price: 12350,
    updated: '25.06.25'
  },
  {
    id: 5,
    name: 'Коврик кольцевой 1000×1000×20',
    article: 'KVR-RING-1000-20',
    category: 'kolcevie',
    parentCategory: 'kovriki',
    categoryName: 'Кольцевые',
    dimensions: { length: 1000, width: 1000, thickness: 20 },
    currentStock: 89,
    reservedStock: 15,
    price: 8450,
    updated: '24.06.25'
  },
  {
    id: 6,
    name: 'Покрытие рулонное 15000×1500×12',
    article: 'POK-RUL-15000-12',
    category: 'rulonnie',
    parentCategory: null,
    categoryName: 'Рулонные покрытия',
    dimensions: { length: 15000, width: 1500, thickness: 12 },
    currentStock: 12,
    reservedStock: 3,
    price: 45670,
    updated: '23.06.25'
  }
];

const Catalog: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [checkedCategories, setCheckedCategories] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(4); // 4 товара на страницу
  const [showSizeFilters, setShowSizeFilters] = useState(false);
  
  // Фильтры по размерам
  const [sizeFilters, setSizeFilters] = useState({
    lengthMin: null as number | null,
    lengthMax: null as number | null,
    widthMin: null as number | null,
    widthMax: null as number | null,
    thicknessMin: null as number | null,
    thicknessMax: null as number | null,
  });

  const { user } = useAuthStore();

  const getStockStatus = (current: number, reserved: number) => {
    const available = current - reserved;
    if (available <= 0) return { status: 'critical', color: '#ff4d4f', text: 'Закончился' };
    if (available < 20) return { status: 'low', color: '#faad14', text: 'Мало' };
    return { status: 'normal', color: '#52c41a', text: 'В наличии' };
  };

  // Функция для получения всех дочерних категорий
  const getAllChildCategories = (categoryKey: string): string[] => {
    const category = mockCategories.find(cat => cat.key === categoryKey);
    if (!category) return [categoryKey];
    
    if (category.children) {
      const childKeys = category.children.map(child => child.key);
      return [categoryKey, ...childKeys];
    }
    
    return [categoryKey];
  };

  // Обработка выбора категорий
  const handleCategoryCheck = (checkedKeys: any) => {
    let expandedKeys = [...checkedKeys];
    
    // Для каждой выбранной родительской категории добавляем дочерние
    checkedKeys.forEach((key: string) => {
      const childKeys = getAllChildCategories(key);
      expandedKeys = [...expandedKeys, ...childKeys];
    });
    
    // Убираем дубликаты
    expandedKeys = Array.from(new Set(expandedKeys));
    
    setCheckedCategories(expandedKeys);
    setCurrentPage(1); // Сбрасываем на первую страницу при изменении фильтра
  };

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    return mockProducts.filter(product => {
      // Поиск по названию, артикулу и размерам
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const dimensionsString = `${product.dimensions.length}×${product.dimensions.width}×${product.dimensions.thickness}`;
        const searchMatch = 
          product.name.toLowerCase().includes(searchLower) ||
          product.article.toLowerCase().includes(searchLower) ||
          dimensionsString.includes(searchText) ||
          product.categoryName.toLowerCase().includes(searchLower);
        
        if (!searchMatch) return false;
      }
      
      // Фильтр по категории
      if (checkedCategories.length > 0) {
        const productCategories = [product.category];
        if (product.parentCategory) {
          productCategories.push(product.parentCategory);
        }
        
        const hasMatchingCategory = productCategories.some(cat => 
          checkedCategories.includes(cat)
        );
        
        if (!hasMatchingCategory) return false;
      }
      
      // Фильтр по остаткам
      if (stockFilter !== 'all') {
        const stockStatus = getStockStatus(product.currentStock, product.reservedStock);
        if (stockFilter !== stockStatus.status) return false;
      }
      
      // Фильтры по размерам
      const { length, width, thickness } = product.dimensions;
      
      if (sizeFilters.lengthMin && length < sizeFilters.lengthMin) return false;
      if (sizeFilters.lengthMax && length > sizeFilters.lengthMax) return false;
      if (sizeFilters.widthMin && width < sizeFilters.widthMin) return false;
      if (sizeFilters.widthMax && width > sizeFilters.widthMax) return false;
      if (sizeFilters.thicknessMin && thickness < sizeFilters.thicknessMin) return false;
      if (sizeFilters.thicknessMax && thickness > sizeFilters.thicknessMax) return false;
      
      return true;
    });
  }, [searchText, checkedCategories, stockFilter, sizeFilters]);

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
                <Button icon={<PlusOutlined />}>Добавить категорию</Button>
                <Button type="primary" icon={<PlusOutlined />}>Добавить товар</Button>
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
                  treeData={mockCategories}
                />
                {checkedCategories.length > 0 && (
                  <div style={{ marginTop: 12, padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Выбрано категорий: {checkedCategories.length}
                    </Text>
                    <br />
                    <Button 
                      size="small" 
                      style={{ marginTop: 4 }}
                      onClick={() => setCheckedCategories([])}
                    >
                      Сбросить выбор
                    </Button>
                  </div>
                )}
              </Card>
            </Col>

            {/* Список товаров */}
            <Col xs={24} lg={18}>
              <Row gutter={[16, 16]}>
                {paginatedProducts.map((product) => {
                  const stockStatus = getStockStatus(product.currentStock, product.reservedStock);
                  const available = product.currentStock - product.reservedStock;
                  const { length, width, thickness } = product.dimensions;
                  
                  return (
                    <Col xs={24} xl={12} key={product.id}>
                      <Card hoverable size="small">
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ fontSize: '16px' }}>
                            {product.name}
                          </Text>
                          <br />
                          <Tag style={{ marginTop: 4 }}>{product.article}</Tag>
                          <Tag color="blue">{length}×{width}×{thickness} мм</Tag>
                        </div>
                        
                        <Row gutter={16}>
                          <Col span={12}>
                            <Space direction="vertical" size="small">
                              <div>
                                <Badge color={stockStatus.color} />
                                <Text strong>{available} шт</Text>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                  доступно
                                </Text>
                              </div>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {product.categoryName}
                              </Text>
                            </Space>
                          </Col>
                          
                          <Col span={12}>
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <div style={{ textAlign: 'right' }}>
                                <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                                  {product.price.toLocaleString()}₽
                                </Text>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                  за штуку
                                </Text>
                              </div>
                              
                              <Space size="small">
                                <Button size="small">Детали</Button>
                                {(user?.role === 'manager' || user?.role === 'director') && (
                                  <Button size="small" type="primary">Заказать</Button>
                                )}
                              </Space>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  );
                })}
              </Row>

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

              {paginatedProducts.length === 0 && (
                <Card style={{ textAlign: 'center', marginTop: 16 }}>
                  <Text type="secondary">
                    <InboxOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                    Товары не найдены
                  </Text>
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
                <Col span={6}>
                  <Text>💾 Остаток: <Text strong>{filteredProducts.reduce((sum, p) => sum + p.currentStock, 0)}</Text></Text>
                </Col>
                <Col span={6}>
                  <Text>📦 Доступно: <Text strong>{filteredProducts.reduce((sum, p) => sum + (p.currentStock - p.reservedStock), 0)}</Text></Text>
                </Col>
                <Col span={6}>
                  <Text>💰 Стоимость: <Text strong>{(filteredProducts.reduce((sum, p) => sum + (p.price * p.currentStock), 0) / 1000).toFixed(0)}к₽</Text></Text>
                </Col>
                <Col span={6}>
                  <Text>📊 Позиций: <Text strong>{filteredProducts.length}</Text></Text>
                </Col>
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default Catalog; 