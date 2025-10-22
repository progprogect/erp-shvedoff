import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Button, Space, Tag, Input, Select, Row, Col, Statistic, message, Spin, Divider } from 'antd';
import { SearchOutlined, InboxOutlined, EditOutlined, HistoryOutlined, ReloadOutlined, FilterOutlined, SettingOutlined, SyncOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { handleFormError } from '../utils/errorUtils';
import usePermissions from '../hooks/usePermissions';
import { stockApi, StockItem, StockFilters } from '../services/stockApi';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import StockHistoryModal from '../components/StockHistoryModal';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const Stock: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'low' | 'normal' | 'out_of_stock' | 'in_production' | 'negative'>('all');
  // Сортировка (Задача 7.2)
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const { user, token } = useAuthStore();
  const { canEdit } = usePermissions();

  // Статистика по остаткам
  const stockStats = React.useMemo(() => {
    const total = stockData.length;
    const outOfStock = stockData.filter((item: StockItem) => item.availableStock <= 0).length;
    const critical = stockData.filter((item: StockItem) => item.availableStock <= 0 && item.currentStock <= 0).length;
    const negative = stockData.filter((item: StockItem) => item.availableStock < 0).length;
    const low = stockData.filter((item: StockItem) => {
      const available = item.availableStock;
      const norm = item.normStock || 0;
      return available > 0 && available < norm * 0.5;
    }).length;
    const normal = stockData.filter((item: StockItem) => {
      const available = item.availableStock;
      const norm = item.normStock || 0;
      return available > 0 && available >= norm * 0.5; // ИСПРАВЛЕНО: только товары в наличии И выше нормы
    }).length;
    const totalAvailable = stockData.reduce((sum: number, item: StockItem) => sum + item.availableStock, 0);
    const totalReserved = stockData.reduce((sum: number, item: StockItem) => sum + item.reservedStock, 0);
    const totalCurrent = stockData.reduce((sum: number, item: StockItem) => sum + item.currentStock, 0);
    const totalNegative = stockData.reduce((sum: number, item: StockItem) => sum + Math.min(0, item.availableStock), 0);
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
      negative,
      low, 
      normal, 
      totalAvailable, 
      totalReserved, 
      totalCurrent,
      totalNegative,
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
        search: searchText.trim() || undefined,
        sortBy,     // Задача 7.2
        sortOrder   // Задача 7.2
      };

      const response = await stockApi.getStock(filters);
      
      if (response.success) {
        setStockData(response.data);
      } else {
        message.error('Ошибка загрузки остатков');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка загрузки остатков:', error);
      handleFormError(error, undefined, {
        key: 'load-stock-error',
        duration: 4
      });
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных при изменении фильтров
  useEffect(() => {
    loadStockData();
  }, [statusFilter, sortBy, sortOrder, token]);

  // Поиск с задержкой
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.length > 0 || searchText.length === 0) {
        loadStockData();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  const getStockStatus = (available: number, norm: number) => {
    if (available < 0) return { color: 'red', text: '⚠️ Перезаказ' };
    if (available === 0) return { color: 'volcano', text: '❌ Нет в наличии' };
    if (available < norm * 0.5) return { color: 'orange', text: '⚠️ Мало' };
    return { color: 'green', text: '✅ В наличии' };
  };

  // Обработчики управления системой
  const handleFixIntegrity = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await stockApi.fixIntegrity();
      if (response.success) {
        message.success('Проверка целостности данных завершена успешно');
        loadStockData(); // Перезагружаем данные
      } else {
        message.error('Ошибка проверки целостности данных');
      }
    } catch (error) {
      console.error('Error fixing integrity:', error);
      message.error('Ошибка проверки целостности данных');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateNeeds = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await stockApi.recalculateNeeds();
      if (response.success) {
        message.success(`Пересчет завершен: создано ${response.data.created}, обновлено ${response.data.updated}, отменено ${response.data.cancelled}`);
        loadStockData(); // Перезагружаем данные
      } else {
        message.error('Ошибка пересчета производственных потребностей');
      }
    } catch (error) {
      console.error('Error recalculating needs:', error);
      message.error('Ошибка пересчета производственных потребностей');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProduction = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await stockApi.syncProduction();
      if (response.success) {
        message.success(`Синхронизация завершена: создано ${response.data.migrated} заданий`);
        loadStockData(); // Перезагружаем данные
      } else {
        message.error('Ошибка синхронизации производства');
      }
    } catch (error) {
      console.error('Error syncing production:', error);
      message.error('Ошибка синхронизации производства');
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjustment = (record: StockItem) => {
    setSelectedStockItem(record);
    setAdjustmentModalVisible(true);
  };

  const handleAdjustmentSuccess = () => {
    loadStockData();
  };

  const handleViewHistory = (record: StockItem) => {
    setSelectedStockItem(record);
    setHistoryModalVisible(true);
  };

  // Оптимизированные колонки таблицы
  const columns = [
    {
      title: 'Товар',
      dataIndex: 'productName',
      key: 'productName',
      width: '25%',
      fixed: 'left' as const,
      render: (text: string, record: StockItem) => (
        <div style={{ minWidth: '220px' }}>
          <Text 
            strong 
            style={{ 
              fontSize: '14px', 
              display: 'block', 
              marginBottom: '4px',
              color: '#1890ff',
              cursor: 'pointer',
              transition: 'color 0.3s ease'
            }}
            onClick={() => window.open(`/catalog/products/${record.productId}`, '_blank')}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#096dd9';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#1890ff';
              e.currentTarget.style.textDecoration = 'none';
            }}
            title="Перейти к карточке товара"
          >
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
            Арт: {record.productArticle}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.categoryName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Остатки',
      key: 'stock_info',
      width: '20%',
      render: (_: any, record: StockItem) => (
        <div style={{ minWidth: '150px' }}>
          <div style={{ marginBottom: '4px' }}>
            <Text strong style={{ fontSize: '14px' }}>
              📦 {record.currentStock} шт
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
              (всего)
            </Text>
          </div>
          
          {record.reservedStock > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <Text type="warning" style={{ fontSize: '13px' }}>
                🔒 {record.reservedStock} шт
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
                (резерв)
              </Text>
            </div>
          )}
          
          <div>
            <Text 
              strong 
              style={{ 
                fontSize: '14px',
                color: record.availableStock < 0 ? '#ff4d4f' : record.availableStock === 0 ? '#faad14' : '#52c41a'
              }}
            >
              {record.availableStock < 0 ? '⚠️' : record.availableStock === 0 ? '❌' : '✅'} {record.availableStock} шт
            </Text>
            <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
              (доступно)
            </Text>
          </div>
          
          {(() => {
            if (record.availableStock >= 0) return null;
            
            const inProduction = parseInt(record.inProductionQuantity?.toString() || '0');
            const needed = Math.abs(record.availableStock);
            const stillNeeded = Math.max(0, needed - inProduction);
            
            if (stillNeeded > 0) {
              return (
                <Text type="danger" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Еще к производству: {stillNeeded} шт
                </Text>
              );
            }
            return null;
          })()}
        </div>
      ),
    },
    {
      title: 'В производстве',
      dataIndex: 'inProductionQuantity',
      key: 'inProductionQuantity',
      width: '12%',
      align: 'center' as const,
      render: (value: number) => {
        const quantity = parseInt(value?.toString() || '0');
        return (
          <div style={{ minWidth: '100px' }}>
            {quantity > 0 ? (
              <div>
                <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                  🏭 {quantity} шт
                </Text>
              </div>
            ) : (
              <Text type="secondary">–</Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Статус',
      key: 'status',
      width: '12%',
      align: 'center' as const,
      render: (_: any, record: StockItem) => {
        const status = getStockStatus(record.availableStock, record.normStock);
        return (
          <div style={{ minWidth: '120px' }}>
            <Tag color={status.color} style={{ margin: 0 }}>
              {status.text}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      width: '10%',
      align: 'right' as const,
      render: (value: number) => (
        <div style={{ minWidth: '80px' }}>
          <Text style={{ fontSize: '13px' }}>
            {value?.toLocaleString() || 0}₽
          </Text>
        </div>
      ),
    },
    {
      title: 'Обновлено',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: '10%',
      render: (value: string) => (
        <div style={{ minWidth: '80px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {new Date(value).toLocaleDateString('ru-RU', { 
              day: '2-digit', 
              month: '2-digit',
              year: '2-digit'
            })}
          </Text>
        </div>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: '11%',
      fixed: 'right' as const,
      render: (_: any, record: StockItem) => (
        <div style={{ minWidth: '100px' }}>
          <Space direction="vertical" size="small">
            <Button 
              size="small" 
              icon={<HistoryOutlined />} 
              title="История движения"
              onClick={() => handleViewHistory(record)}
              style={{ width: '100%' }}
            >
              История
            </Button>
                            {canEdit('stock') && (
              <Button 
                size="small" 
                type="primary"
                icon={<EditOutlined />} 
                title="Корректировка остатка"
                onClick={() => handleStockAdjustment(record)}
                style={{ width: '100%' }}
              >
                Корректировка
              </Button>
            )}
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Заголовок */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            📦 Учет остатков
          </Title>
        </Col>

      </Row>

      {/* Статистика */}
      <Card style={{ marginBottom: '24px' }}>
        <Title level={4} style={{ marginBottom: '16px' }}>
          📊 Общая статистика
        </Title>
        <Row gutter={[24, 16]}>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Statistic
              title="Всего позиций"
              value={stockStats.total}
              valueStyle={{ color: '#1890ff', fontSize: '18px' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Statistic
              title="Общий остаток"
              value={stockStats.totalCurrent}
              suffix="шт"
              valueStyle={{ color: '#1890ff', fontSize: '18px' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Statistic
              title="В резерве"
              value={stockStats.totalReserved}
              suffix="шт"
              valueStyle={{ color: '#faad14', fontSize: '18px' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Statistic
              title="Доступно"
              value={stockStats.totalAvailable}
              suffix="шт"
              valueStyle={{ 
                color: stockStats.totalAvailable >= 0 ? '#52c41a' : '#ff4d4f',
                fontSize: '18px'
              }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Statistic
              title="Перезаказ"
              value={Math.abs(stockStats.totalNegative)}
              suffix="шт"
              valueStyle={{ color: '#ff4d4f', fontSize: '18px' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Statistic
              title="В производстве"
              value={stockStats.totalInProduction}
              suffix="шт"
              valueStyle={{ color: '#722ed1', fontSize: '18px' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Фильтры и поиск */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Search
              placeholder="Поиск по названию, артикулу..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
              size="large"
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              placeholder="Фильтр по статусу"
              size="large"
              prefix={<FilterOutlined />}
            >
              <Option value="all">📊 Все статусы</Option>
              <Option value="out_of_stock">❌ Отсутствующие</Option>
              <Option value="negative">⚠️ Перезаказ</Option>
              <Option value="critical">🚨 Критичные</Option>
              <Option value="low">⚠️ Мало</Option>
              <Option value="normal">✅ В норме</Option>
              <Option value="in_production">🏭 В производстве</Option>
            </Select>
          </Col>
          <Col xs={24} lg={8}>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Показано: <Text strong>{stockData.length}</Text> позиций
            </Text>
          </Col>
        </Row>
        
        <Divider />
        
        {/* Быстрые фильтры */}
        <div style={{ marginBottom: '8px' }}>
          <Text strong style={{ fontSize: '14px', marginRight: '16px' }}>
            🔥 Быстрая фильтрация:
          </Text>
        </div>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Button 
              size="middle"
              type={statusFilter === 'out_of_stock' ? 'primary' : 'default'}
              danger={statusFilter === 'out_of_stock'}
              onClick={() => setStatusFilter('out_of_stock')}
            >
              ❌ Отсутствующие ({stockStats.outOfStock})
            </Button>
          </Col>
          <Col>
            <Button 
              size="middle"
              type={statusFilter === 'negative' ? 'primary' : 'default'}
              danger={statusFilter === 'negative'}
              onClick={() => setStatusFilter('negative')}
            >
              ⚠️ Перезаказ ({stockStats.negative})
            </Button>
          </Col>
          <Col>
            <Button 
              size="middle"
              type={statusFilter === 'low' ? 'primary' : 'default'}
              onClick={() => setStatusFilter('low')}
              style={{ 
                borderColor: '#faad14', 
                backgroundColor: statusFilter === 'low' ? '#faad14' : undefined,
                color: statusFilter === 'low' ? '#fff' : '#faad14' 
              }}
            >
              ⚠️ Мало ({stockStats.low})
            </Button>
          </Col>
          <Col>
            <Button 
              size="middle"
              type={statusFilter === 'normal' ? 'primary' : 'default'}
              onClick={() => setStatusFilter('normal')}
              style={{ 
                borderColor: '#52c41a',
                backgroundColor: statusFilter === 'normal' ? '#52c41a' : undefined,
                color: statusFilter === 'normal' ? '#fff' : '#52c41a' 
              }}
            >
              ✅ В норме ({stockStats.normal})
            </Button>
          </Col>
          <Col>
            <Button 
              size="middle"
              type={statusFilter === 'in_production' ? 'primary' : 'default'}
              onClick={() => setStatusFilter('in_production')}
              style={{ 
                borderColor: '#722ed1',
                backgroundColor: statusFilter === 'in_production' ? '#722ed1' : undefined,
                color: statusFilter === 'in_production' ? '#fff' : '#722ed1' 
              }}
            >
              🏭 В производстве ({stockStats.inProductionCount})
            </Button>
          </Col>
          {statusFilter !== 'all' && (
            <Col>
              <Button 
                size="middle"
                onClick={() => setStatusFilter('all')}
              >
                🔄 Показать все
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Таблица остатков */}
      <Card>
        {/* Элементы управления сортировкой (Задача 7.2) */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Text strong>Сортировка:</Text>
              <Select
                value={sortBy}
                onChange={setSortBy}
                style={{ width: 180 }}
                size="small"
              >
                <Option value="updatedAt">🔄 По дате изменения</Option>
                <Option value="name">📝 По названию</Option>
                <Option value="matArea">📏 По площади (размеру)</Option>
                <Option value="availableStock">📦 По доступному остатку</Option>
                <Option value="currentStock">📊 По текущему остатку</Option>
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
            <Text type="secondary" style={{ fontSize: '12px' }}>
              📋 Всего позиций: <Text strong>{stockData.length}</Text>
            </Text>
          </Col>
        </Row>
        
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={stockData}
            rowKey="id"
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `Показано ${range[0]}-${range[1]} из ${total} позиций`,
              pageSizeOptions: ['10', '15', '25', '50'],
            }}
            scroll={{ x: 1200, y: 'calc(100vh - 520px)' }}
            locale={{
              emptyText: searchText ? 'Товары не найдены по вашему запросу' : 'Нет данных об остатках'
            }}
            size="middle"
            rowClassName={(record) => {
              if (record.availableStock < 0) return 'stock-negative';
              if (record.availableStock === 0) return 'stock-zero';
              return '';
            }}
          />
        </Spin>
      </Card>

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