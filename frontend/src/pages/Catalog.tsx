import React, { useState } from 'react';
import { Row, Col, Card, Tree, Input, Button, Space, Typography, Tag, Divider, Badge } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
  AppstoreOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;
const { Search } = Input;

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
    currentStock: 145,
    reservedStock: 23,
    normStock: 100,
    price: 15430,
    updated: '25.06.25'
  },
  {
    id: 2,
    name: 'Лежак 0 Чеш 1800×1200×35',
    article: 'LCH-1800-1200-35',
    category: 'Чешские',
    currentStock: 89,
    reservedStock: 12,
    normStock: 50,
    price: 16780,
    updated: '24.06.25'
  },
  {
    id: 3,
    name: 'Лежак 0 Чеш 1800×1200×40',
    article: 'LCH-1800-1200-40',
    category: 'Чешские',
    currentStock: 67,
    reservedStock: 5,
    normStock: 80,
    price: 18920,
    updated: '23.06.25'
  }
];

const Catalog: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('all');
  const { user } = useAuthStore();

  const getStockStatus = (current: number, reserved: number, norm: number) => {
    const available = current - reserved;
    if (available <= 0) return { status: 'critical', color: '#ff4d4f', text: 'Закончился' };
    if (available < norm * 0.5) return { status: 'low', color: '#faad14', text: 'Мало' };
    return { status: 'normal', color: '#52c41a', text: 'Норма' };
  };

  const filteredProducts = mockProducts.filter(product => {
    if (searchText && !product.name.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    
    if (stockFilter !== 'all') {
      const stockStatus = getStockStatus(product.currentStock, product.reservedStock, product.normStock);
      if (stockFilter !== stockStatus.status) {
        return false;
      }
    }
    
    return true;
  });

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
            <Row gutter={16} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Search
                  placeholder="Поиск товаров..."
                  allowClear
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Space>
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
                  <Text type="secondary">
                    Показано: {filteredProducts.length} из {mockProducts.length} товаров
                  </Text>
                </div>
              </Col>
            </Row>
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
                          <Text type="secondary">
                            Категория: {product.category}
                          </Text>
                          
                          <div className="product-stock" style={{ marginTop: 12 }}>
                            <Space size="large">
                              <div>
                                <Badge 
                                  color={stockStatus.color} 
                                  text={`${product.currentStock} шт`} 
                                />
                                <br />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  Текущий остаток
                                </Text>
                              </div>
                              
                              <div>
                                <Text type="secondary">
                                  🔒 {product.reservedStock} рез
                                </Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  Резерв
                                </Text>
                              </div>
                              
                              <div>
                                <Text strong style={{ color: stockStatus.color }}>
                                  📦 {available} шт
                                </Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  Доступно
                                </Text>
                              </div>
                              
                              <div>
                                <Text>💰 {product.price.toLocaleString()}₽</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  Цена
                                </Text>
                              </div>
                            </Space>
                          </div>
                        </Col>
                        
                        <Col>
                          <Space direction="vertical">
                            <Tag color={stockStatus.color}>
                              {stockStatus.text}
                            </Tag>
                            <Space>
                              <Button size="small">📋 Детали</Button>
                              <Button size="small">📈 График</Button>
                              {(user?.role === 'manager' || user?.role === 'director') && (
                                <Button size="small" type="primary">🛒 Заказать</Button>
                              )}
                            </Space>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
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
                  <Text>Страница 1 из 4</Text>
                  <Button>▶️ След</Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Сводка по категории */}
        <Col span={24}>
          <Card>
            <Title level={5}>📈 Сводка по категории: Лежаки резиновые / Чешские / Стандартные 1800×1200</Title>
            <Row gutter={16}>
              <Col span={6}>
                <Text>💾 Общий остаток: <Text strong>301 шт</Text></Text>
              </Col>
              <Col span={6}>
                <Text>🔒 Резерв: <Text strong>40 шт</Text></Text>
              </Col>
              <Col span={6}>
                <Text>💰 Стоимость: <Text strong>467,890₽</Text></Text>
              </Col>
              <Col span={6}>
                <Text>📊 Оборачиваемость: <Text strong>2.3 раза/мес</Text></Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Catalog; 