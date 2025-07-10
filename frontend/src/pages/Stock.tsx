import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Button, Space, Tag, Input, Select, Row, Col, Statistic, message, Spin } from 'antd';
import { SearchOutlined, InboxOutlined, EditOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { stockApi, StockItem, StockFilters } from '../services/stockApi';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import StockHistoryModal from '../components/StockHistoryModal';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const Stock: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'low' | 'normal' | 'out_of_stock'>('all');
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const { user, token } = useAuthStore();

  // Статистика по остаткам
  const stockStats = React.useMemo(() => {
    const total = stockData.length;
    const outOfStock = stockData.filter((item: StockItem) => item.availableStock <= 0).length;
    const critical = stockData.filter((item: StockItem) => item.availableStock <= 0 && item.currentStock <= 0).length;
    const low = stockData.filter((item: StockItem) => {
      const available = item.availableStock;
      const norm = item.normStock || 0;
      return available > 0 && available < norm * 0.5;
    }).length;
    const normal = stockData.filter((item: StockItem) => {
      const available = item.availableStock;
      const norm = item.normStock || 0;
      return available >= norm * 0.5;
    }).length;
    const totalAvailable = stockData.reduce((sum: number, item: StockItem) => sum + Math.max(0, item.availableStock), 0);
    const totalReserved = stockData.reduce((sum: number, item: StockItem) => sum + item.reservedStock, 0);
    const totalCurrent = stockData.reduce((sum: number, item: StockItem) => sum + item.currentStock, 0);
    const totalInProduction = stockData.reduce((sum: number, item: StockItem) => {
      const quantity = parseInt(item.inProductionQuantity?.toString() || '0');
      return sum + quantity;
    }, 0);
    const inProductionCount = stockData.filter((item: StockItem) => {
      const quantity = parseInt(item.inProductionQuantity?.toString() || '0');
      return quantity > 0;
    }).length;

    return { 
      total, 
      outOfStock, 
      critical, 
      low, 
      normal, 
      totalAvailable, 
      totalReserved, 
      totalCurrent,
      totalInProduction,
      inProductionCount
    };
  }, [stockData]);

  const loadStockData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const filters: StockFilters = {
        status: statusFilter,
        search: searchText.trim() || undefined
      };

      const response = await stockApi.getStock(filters, token);
      
      if (response.success) {
        setStockData(response.data);
      } else {
        message.error('Ошибка загрузки остатков');
      }
    } catch (error) {
      console.error('Ошибка загрузки остатков:', error);
      message.error('Ошибка связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных при изменении фильтров
  useEffect(() => {
    loadStockData();
  }, [statusFilter, token]);

  // Поиск с задержкой
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.length >= 3 || searchText.length === 0) {
        loadStockData();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  const getStockStatus = (available: number, norm: number) => {
    if (available <= 0) return { status: 'critical', color: 'red', text: 'Закончился' };
    if (available < norm * 0.5) return { status: 'low', color: 'orange', text: 'Мало' };
    return { status: 'normal', color: 'green', text: 'Норма' };
  };

  const handleStockAdjustment = (record: StockItem) => {
    setSelectedStockItem(record);
    setAdjustmentModalVisible(true);
  };

  const handleAdjustmentSuccess = () => {
    loadStockData(); // Перезагружаем данные после успешной корректировки
  };

  const handleViewHistory = (record: StockItem) => {
    setSelectedStockItem(record);
    setHistoryModalVisible(true);
  };

  const columns = [
    {
      title: 'Товар',
      dataIndex: 'productName',
      key: 'productName',
      render: (text: string, record: StockItem) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.productArticle} • {record.categoryName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Текущий остаток',
      dataIndex: 'currentStock',
      key: 'currentStock',
      align: 'center' as const,
      render: (value: number) => <Text strong>{value} шт</Text>,
    },
    {
      title: 'Резерв',
      dataIndex: 'reservedStock',
      key: 'reservedStock',
      align: 'center' as const,
      render: (value: number) => <Text type="secondary">🔒 {value}</Text>,
    },
    {
      title: 'Доступно',
      dataIndex: 'availableStock',
      key: 'availableStock',
      align: 'center' as const,
      render: (value: number, record: StockItem) => {
        const status = getStockStatus(value, record.normStock);
        return (
          <Text strong style={{ color: status.color === 'green' ? '#52c41a' : status.color === 'orange' ? '#faad14' : '#ff4d4f' }}>
            📦 {value} шт
          </Text>
        );
      },
    },
    {
      title: 'К производству',
      dataIndex: 'inProductionQuantity',
      key: 'inProductionQuantity',
      align: 'center' as const,
      render: (value: number) => {
        const quantity = parseInt(value?.toString() || '0');
        return quantity > 0 ? (
          <Text strong style={{ color: '#1890ff' }}>
            🏭 {quantity} шт
          </Text>
        ) : (
          <Text type="secondary">–</Text>
        );
      },
    },
    {
      title: 'Статус',
      key: 'status',
      align: 'center' as const,
      render: (_: any, record: StockItem) => {
        const status = getStockStatus(record.availableStock, record.normStock);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      align: 'right' as const,
      render: (value: number) => <Text>💰 {value?.toLocaleString() || 0}₽</Text>,
    },
    {
      title: 'Обновлено',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(value).toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: StockItem) => (
        <Space>
          <Button 
            size="small" 
            icon={<HistoryOutlined />} 
            title="История движения"
            onClick={() => handleViewHistory(record)}
          >
            История
          </Button>
          {(user?.role === 'director' || user?.role === 'warehouse') && (
            <Button 
              size="small" 
              icon={<EditOutlined />} 
              title="Корректировка остатка"
              onClick={() => handleStockAdjustment(record)}
            >
              Корректировка
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        {/* Заголовок */}
        <Col span={24}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0 }}>
                📦 Учет остатков
              </Title>
            </Col>
            <Col>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadStockData}
                loading={loading}
              >
                Обновить
              </Button>
            </Col>
          </Row>
        </Col>

        {/* Статистика */}
        <Col span={24}>
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={6} lg={4} xl={4}>
                <Statistic
                  title="📊 Всего позиций"
                  value={stockStats.total}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4} xl={4}>
                <Statistic
                  title="📦 Общий остаток"
                  value={stockStats.totalCurrent}
                  suffix="шт"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4} xl={4}>
                <Statistic
                  title="🔒 В резерве"
                  value={stockStats.totalReserved}
                  suffix="шт"
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4} xl={4}>
                <Statistic
                  title="✅ Доступно"
                  value={stockStats.totalAvailable}
                  suffix="шт"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4} xl={4}>
                <Statistic
                  title="🏭 К производству"
                  value={stockStats.totalInProduction}
                  suffix="шт"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4} xl={4}>
                <Statistic
                  title="🏭 Позиций в производстве"
                  value={stockStats.inProductionCount}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Фильтры и поиск */}
        <Col span={24}>
          <Card>
            <Row gutter={16} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Search
                  placeholder="Поиск по названию, артикулу..."
                  allowClear
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '100%' }}
                  size="large"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  placeholder="Фильтр по статусу"
                  size="large"
                >
                  <Option value="all">📊 Все статусы</Option>
                  <Option value="out_of_stock">❌ Отсутствующие</Option>
                  <Option value="critical">🚨 Критичные</Option>
                  <Option value="low">⚠️ Мало</Option>
                  <Option value="normal">✅ В норме</Option>
                </Select>
              </Col>
              <Col xs={24} sm={24} md={8}>
                <Space wrap style={{ justifyContent: 'flex-end', width: '100%' }}>
                  <Text type="secondary">
                    Показано: {stockData.length} позиций
                  </Text>
                </Space>
              </Col>
            </Row>
            
            {/* Быстрые фильтры */}
            <Row gutter={[8, 8]} style={{ marginTop: 16 }} align="middle">
              <Col>
                <Text strong>🔥 Быстрая фильтрация:</Text>
              </Col>
              <Col>
                <Button 
                  size="small"
                  type={statusFilter === 'out_of_stock' ? 'primary' : 'default'}
                  danger={statusFilter === 'out_of_stock'}
                  onClick={() => setStatusFilter('out_of_stock')}
                >
                  ❌ Отсутствующие ({stockStats.outOfStock})
                </Button>
              </Col>
              <Col>
                <Button 
                  size="small"
                  type={statusFilter === 'low' ? 'primary' : 'default'}
                  onClick={() => setStatusFilter('low')}
                  style={{ borderColor: '#faad14', color: statusFilter === 'low' ? '#fff' : '#faad14' }}
                >
                  ⚠️ Мало ({stockStats.low})
                </Button>
              </Col>
              <Col>
                <Button 
                  size="small"
                  type={statusFilter === 'normal' ? 'primary' : 'default'}
                  onClick={() => setStatusFilter('normal')}
                  style={{ borderColor: '#52c41a', color: statusFilter === 'normal' ? '#fff' : '#52c41a' }}
                >
                  ✅ В норме ({stockStats.normal})
                </Button>
              </Col>
              {statusFilter !== 'all' && (
                <Col>
                  <Button 
                    size="small"
                    onClick={() => setStatusFilter('all')}
                  >
                    🔄 Показать все
                  </Button>
                </Col>
              )}
              <Col flex="auto" style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  💡 Подсказка: используйте поиск для быстрого нахождения товара
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Таблица остатков */}
        <Col span={24}>
          <Card>
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={stockData}
                rowKey="id"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} из ${total} позиций`,
                }}
                scroll={{ x: 1000 }}
                locale={{
                  emptyText: searchText ? 'Товары не найдены' : 'Нет данных об остатках'
                }}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Модальное окно корректировки остатков */}
      <StockAdjustmentModal
        visible={adjustmentModalVisible}
        stockItem={selectedStockItem}
        onClose={() => setAdjustmentModalVisible(false)}
        onSuccess={handleAdjustmentSuccess}
      />

      {/* Модальное окно истории движения остатков */}
      <StockHistoryModal
        visible={historyModalVisible}
        stockItem={selectedStockItem}
        onClose={() => setHistoryModalVisible(false)}
      />
    </div>
  );
};

export default Stock; 