import React, { useState } from 'react';
import { Row, Col, Card, Tree, Input, Button, Space, Typography, Tag, Divider, Badge, Select, InputNumber, Collapse } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
  AppstoreOutlined,
  InboxOutlined,
  BorderOutlined,
  ColumnWidthOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Panel } = Collapse;

// Заглушки данных - в будущем будут загружаться из API
const mockCategories = [
  {
    title: '📁 Лежаки резиновые (347)',
    key: 'category-1',
    children: [
      {
        title: '📁 Чешские (0 Чеш) (45)',
        key: 'category-1-1',
        children: [
          { title: '📁 Стандартные 1800×1200 (12)', key: 'category-1-1-1' },
          { title: '📁 Нестандартные размеры (8)', key: 'category-1-1-2' }
        ]
      },
      { title: '📁 3-Корончатые (3Кор) (28)', key: 'category-1-2' },
      {
        title: '📁 Брендовые (156)',
        key: 'category-1-3',
        children: [
          { title: '📁 GEA (34)', key: 'category-1-3-1' },
          { title: '📁 Agrotek (28)', key: 'category-1-3-2' },
          { title: '📁 Верблюд (41)', key: 'category-1-3-3' }
        ]
      }
    ]
  },
  {
    title: '📁 Коврики (89)',
    key: 'category-2',
    children: [
      { title: '📁 Кольцевые (34)', key: 'category-2-1' },
      { title: '📁 Придверные (28)', key: 'category-2-2' }
    ]
  },
  {
    title: '📁 Рулонные покрытия (45)',
    key: 'category-3'
  },
  {
    title: '📁 Крепежные изделия (67)',
    key: 'category-4',
    children: [
      { title: '📁 Дюбели (45)', key: 'category-4-1' }
    ]
  }
];

const mockProducts = [
  {
    id: 1,
    name: 'Лежак 0 Чеш 1800×1200×30',
    article: 'LCH-1800-1200-30',
    category: 'Чешские',
    dimensions: {
      length: 1800,  // длина мм
      width: 1200,   // ширина мм  
      thickness: 30  // толщина мм
    },
    currentStock: 145,
    reservedStock: 23,
    normStock: 100,
    price: 15430,
    updated: '25.06.25',
    characteristics: 'Стандартный размер, высокое качество'
  },
  {
    id: 2,
    name: 'Лежак 0 Чеш 1800×1200×35',
    article: 'LCH-1800-1200-35',
    category: 'Чешские',
    dimensions: {
      length: 1800,
      width: 1200,
      thickness: 35
    },
    currentStock: 89,
    reservedStock: 12,
    normStock: 50,
    price: 16780,
    updated: '24.06.25',
    characteristics: 'Усиленная модель, повышенная толщина'
  },
  {
    id: 3,
    name: 'Лежак 0 Чеш 1800×1200×40',
    article: 'LCH-1800-1200-40',
    category: 'Чешские',
    dimensions: {
      length: 1800,
      width: 1200,
      thickness: 40
    },
    currentStock: 67,
    reservedStock: 5,
    normStock: 80,
    price: 18920,
    updated: '23.06.25',
    characteristics: 'Максимальная прочность'
  },
  {
    id: 4,
    name: 'Лежак 0 Чеш 1600×1000×30',
    article: 'LCH-1600-1000-30',
    category: 'Чешские',
    dimensions: {
      length: 1600,
      width: 1000,
      thickness: 30
    },
    currentStock: 34,
    reservedStock: 8,
    normStock: 40,
    price: 12350,
    updated: '25.06.25',
    characteristics: 'Компактный размер для стойл'
  },
  {
    id: 5,
    name: 'Коврик кольцевой 1000×1000×20',
    article: 'KVR-RING-1000-20',
    category: 'Кольцевые',
    dimensions: {
      length: 1000,
      width: 1000,
      thickness: 20
    },
    currentStock: 89,
    reservedStock: 15,
    normStock: 60,
    price: 8450,
    updated: '24.06.25',
    characteristics: 'Дренажные отверстия, противоскользящий'
  },
  {
    id: 6,
    name: 'Покрытие рулонное 15000×1500×12',
    article: 'POK-RUL-15000-12',
    category: 'Рулонные покрытия',
    dimensions: {
      length: 15000,
      width: 1500,
      thickness: 12
    },
    currentStock: 12,
    reservedStock: 3,
    normStock: 20,
    price: 45670,
    updated: '23.06.25',
    characteristics: 'Для проходов, износостойкий'
  }
];

const Catalog: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [dimensionFilter, setDimensionFilter] = useState({
    lengthMin: null as number | null,
    lengthMax: null as number | null,
    widthMin: null as number | null,
    widthMax: null as number | null,
    thicknessMin: null as number | null,
    thicknessMax: null as number | null,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { user } = useAuthStore();

  const getStockStatus = (current: number, reserved: number, norm: number) => {
    const available = current - reserved;
    if (available <= 0) return { status: 'critical', color: '#ff4d4f', text: 'Закончился' };
    if (available < norm * 0.5) return { status: 'low', color: '#faad14', text: 'Мало' };
    return { status: 'normal', color: '#52c41a', text: 'Норма' };
  };

  const filteredProducts = mockProducts.filter(product => {
    // Поиск по названию, артикулу и размерам
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const dimensionsString = `${product.dimensions.length}×${product.dimensions.width}×${product.dimensions.thickness}`;
      const isNameMatch = product.name.toLowerCase().includes(searchLower);
      const isArticleMatch = product.article.toLowerCase().includes(searchLower);
      const isDimensionsMatch = dimensionsString.includes(searchText);
      
      if (!isNameMatch && !isArticleMatch && !isDimensionsMatch) {
        return false;
      }
    }
    
    // Фильтр по остаткам
    if (stockFilter !== 'all') {
      const stockStatus = getStockStatus(product.currentStock, product.reservedStock, product.normStock);
      if (stockFilter !== stockStatus.status) {
        return false;
      }
    }
    
    // Фильтр по размерам
    const { length, width, thickness } = product.dimensions;
    
    if (dimensionFilter.lengthMin && length < dimensionFilter.lengthMin) return false;
    if (dimensionFilter.lengthMax && length > dimensionFilter.lengthMax) return false;
    if (dimensionFilter.widthMin && width < dimensionFilter.widthMin) return false;
    if (dimensionFilter.widthMax && width > dimensionFilter.widthMax) return false;
    if (dimensionFilter.thicknessMin && thickness < dimensionFilter.thicknessMin) return false;
    if (dimensionFilter.thicknessMax && thickness > dimensionFilter.thicknessMax) return false;
    
    return true;
  });
  
  // Быстрые фильтры по популярным размерам
  const quickSizeFilters = [
    { label: '1800×1200', length: 1800, width: 1200 },
    { label: '1600×1000', length: 1600, width: 1000 },
    { label: '1000×1000', length: 1000, width: 1000 },
  ];
  
  const applyQuickSizeFilter = (length: number, width: number) => {
    setDimensionFilter({
      lengthMin: length,
      lengthMax: length,
      widthMin: width,
      widthMax: width,
      thicknessMin: null,
      thicknessMax: null,
    });
  };
  
  const clearSizeFilters = () => {
    setDimensionFilter({
      lengthMin: null,
      lengthMax: null,
      widthMin: null,
      widthMax: null,
      thicknessMin: null,
      thicknessMax: null,
    });
  };

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
                Управление номенклатурой и категориями товаров
              </Text>
            </div>
            
            {canEdit && (
              <Space>
                <Button icon={<PlusOutlined />}>
                  Добавить категорию
                </Button>
                <Button type="primary" icon={<PlusOutlined />}>
                  Добавить товар
                </Button>
              </Space>
            )}
          </div>
        </Col>

        {/* Поиск и фильтры */}
        <Col span={24}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* Основные фильтры */}
              <Row gutter={16} align="middle">
                <Col xs={24} sm={12} md={8}>
                  <Search
                    placeholder="Поиск: название, артикул, размеры (1800x1200)..."
                    allowClear
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Space wrap>
                    <Button 
                      type={stockFilter === 'all' ? 'primary' : 'default'}
                      onClick={() => setStockFilter('all')}
                    >
                      Все
                    </Button>
                    <Button 
                      type={stockFilter === 'normal' ? 'primary' : 'default'}
                      onClick={() => setStockFilter('normal')}
                    >
                      В наличии
                    </Button>
                    <Button 
                      type={stockFilter === 'low' ? 'primary' : 'default'}
                      onClick={() => setStockFilter('low')}
                    >
                      Мало
                    </Button>
                    <Button 
                      type={stockFilter === 'critical' ? 'primary' : 'default'}
                      onClick={() => setStockFilter('critical')}
                    >
                      Критичные
                    </Button>
                  </Space>
                </Col>
                <Col xs={24} sm={24} md={8}>
                  <div style={{ textAlign: 'right' }}>
                    <Button
                      icon={<FilterOutlined />}
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    >
                      Расширенные фильтры
                    </Button>
                  </div>
                </Col>
              </Row>

              {/* Быстрые фильтры по размерам */}
              <Row gutter={16} align="middle">
                <Col>
                  <Text strong>📏 Быстрый поиск по размерам:</Text>
                </Col>
                {quickSizeFilters.map((filter) => (
                  <Col key={filter.label}>
                    <Button
                      size="small"
                      icon={<BorderOutlined />}
                      onClick={() => applyQuickSizeFilter(filter.length, filter.width)}
                      type={
                        dimensionFilter.lengthMin === filter.length && 
                        dimensionFilter.widthMin === filter.width ? 'primary' : 'default'
                      }
                    >
                      {filter.label}
                    </Button>
                  </Col>
                ))}
                <Col>
                  <Button size="small" onClick={clearSizeFilters}>
                    Сбросить
                  </Button>
                </Col>
                <Col flex="auto">
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary">
                      Показано: {filteredProducts.length} из {mockProducts.length} товаров
                    </Text>
                  </div>
                </Col>
              </Row>

              {/* Расширенные фильтры по размерам */}
              {showAdvancedFilters && (
                <Collapse>
                  <Panel header="🔧 Точная фильтрация по размерам" key="1">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Text strong>Длина (мм)</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <InputNumber
                            placeholder="от"
                            value={dimensionFilter.lengthMin}
                            onChange={(value) => setDimensionFilter({
                              ...dimensionFilter, 
                              lengthMin: value
                            })}
                            style={{ width: '50%' }}
                          />
                          <InputNumber
                            placeholder="до"
                            value={dimensionFilter.lengthMax}
                            onChange={(value) => setDimensionFilter({
                              ...dimensionFilter, 
                              lengthMax: value
                            })}
                            style={{ width: '50%' }}
                          />
                        </div>
                      </Col>
                      <Col span={8}>
                        <Text strong>Ширина (мм)</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <InputNumber
                            placeholder="от"
                            value={dimensionFilter.widthMin}
                            onChange={(value) => setDimensionFilter({
                              ...dimensionFilter, 
                              widthMin: value
                            })}
                            style={{ width: '50%' }}
                          />
                          <InputNumber
                            placeholder="до"
                            value={dimensionFilter.widthMax}
                            onChange={(value) => setDimensionFilter({
                              ...dimensionFilter, 
                              widthMax: value
                            })}
                            style={{ width: '50%' }}
                          />
                        </div>
                      </Col>
                      <Col span={8}>
                        <Text strong>Толщина (мм)</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <InputNumber
                            placeholder="от"
                            value={dimensionFilter.thicknessMin}
                            onChange={(value) => setDimensionFilter({
                              ...dimensionFilter, 
                              thicknessMin: value
                            })}
                            style={{ width: '50%' }}
                          />
                          <InputNumber
                            placeholder="до"
                            value={dimensionFilter.thicknessMax}
                            onChange={(value) => setDimensionFilter({
                              ...dimensionFilter, 
                              thicknessMax: value
                            })}
                            style={{ width: '50%' }}
                          />
                        </div>
                      </Col>
                    </Row>
                  </Panel>
                </Collapse>
              )}
            </Space>
          </Card>
        </Col>

        {/* Основной контент */}
        <Col span={24}>
          <Row gutter={16}>
            {/* Категории */}
            <Col xs={24} lg={8}>
              <Card title="📂 Категории" className="category-tree">
                <Tree
                  showLine
                  defaultExpandedKeys={['category-1', 'category-1-1']}
                  selectedKeys={selectedCategory}
                  onSelect={(selectedKeys) => setSelectedCategory(selectedKeys.map(key => String(key)))}
                  treeData={mockCategories}
                />
              </Card>
            </Col>

            {/* Список товаров */}
            <Col xs={24} lg={16}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.currentStock, product.reservedStock, product.normStock);
                  const available = product.currentStock - product.reservedStock;
                  const { length, width, thickness } = product.dimensions;
                  const area = (length * width) / 1000000; // площадь в м²
                  const pricePerM2 = Math.round(product.price / area);
                  
                  return (
                    <Card key={product.id} className="product-card" hoverable>
                      <Row>
                        <Col flex="auto">
                          <div className="product-name">
                            <Text strong style={{ fontSize: '16px' }}>
                              {product.name}
                            </Text>
                            <Tag style={{ marginLeft: 8 }}>
                              {product.article}
                            </Tag>
                          </div>
                          
                          {/* Размеры - ключевая информация */}
                          <div style={{ margin: '8px 0' }}>
                            <Space>
                              <Tag icon={<ColumnWidthOutlined />} color="blue" style={{ fontSize: '13px' }}>
                                📐 {length}×{width}×{thickness} мм
                              </Tag>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                Категория: {product.category}
                              </Text>
                            </Space>
                          </div>
                          
                          {/* Характеристики */}
                          <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                            {product.characteristics}
                          </Text>
                          
                          <div className="product-stock" style={{ marginTop: 12 }}>
                            <Row gutter={16}>
                              <Col span={12}>
                                <Space direction="vertical" size="small">
                                  <div>
                                    <Badge 
                                      color={stockStatus.color} 
                                      text={<Text strong>{product.currentStock} шт</Text>}
                                    />
                                    <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                                      Текущий остаток
                                    </Text>
                                  </div>
                                  
                                  <div>
                                    <Text strong style={{ color: stockStatus.color }}>
                                      📦 {available} шт доступно
                                    </Text>
                                    {product.reservedStock > 0 && (
                                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                                        🔒 {product.reservedStock} в резерве
                                      </Text>
                                    )}
                                  </div>
                                </Space>
                              </Col>
                              
                              <Col span={12}>
                                <Space direction="vertical" size="small">
                                  <div>
                                    <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                                      💰 {product.price.toLocaleString()}₽
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                                      за штуку
                                    </Text>
                                  </div>
                                  
                                  <div>
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                      Площадь: {area.toFixed(2)} м²
                                    </Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                      Цена за м²: {pricePerM2}₽
                                    </Text>
                                  </div>
                                </Space>
                              </Col>
                            </Row>
                          </div>
                        </Col>
                        
                        <Col>
                          <Space direction="vertical" align="end">
                            <Tag color={stockStatus.color} style={{ marginBottom: 8 }}>
                              {stockStatus.text}
                            </Tag>
                            
                            <Space direction="vertical" size="small">
                              <Button size="small" block>📋 Детали</Button>
                              <Button size="small" block>📈 График</Button>
                              {(user?.role === 'manager' || user?.role === 'director') && (
                                <Button size="small" type="primary" block>🛒 Заказать</Button>
                              )}
                            </Space>
                            
                            <Text type="secondary" style={{ fontSize: '10px', marginTop: 8 }}>
                              Обновл: {product.updated}
                            </Text>
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </Space>

              {/* Пагинация */}
              <Card style={{ marginTop: 16, textAlign: 'center' }}>
                <Space>
                  <Button>◀️ Пред</Button>
                  <Text>Страница 1 из 2</Text>
                  <Button>▶️ След</Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Сводка по категории */}
        <Col span={24}>
          <Card>
            <Title level={5}>📈 Сводка по выбранным товарам</Title>
            <Row gutter={16}>
              <Col span={6}>
                <Text>💾 Общий остаток: <Text strong>{filteredProducts.reduce((sum, p) => sum + p.currentStock, 0)} шт</Text></Text>
              </Col>
              <Col span={6}>
                <Text>🔒 Резерв: <Text strong>{filteredProducts.reduce((sum, p) => sum + p.reservedStock, 0)} шт</Text></Text>
              </Col>
              <Col span={6}>
                <Text>💰 Стоимость: <Text strong>{filteredProducts.reduce((sum, p) => sum + (p.price * p.currentStock), 0).toLocaleString()}₽</Text></Text>
              </Col>
              <Col span={6}>
                <Text>📦 Доступно: <Text strong>{filteredProducts.reduce((sum, p) => sum + (p.currentStock - p.reservedStock), 0)} шт</Text></Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Catalog; 