import React, { useState } from 'react';
import { Table, Card, Typography, Button, Space, Tag, Input, Select, Row, Col, Statistic } from 'antd';
import { SearchOutlined, InboxOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const Stock: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { user } = useAuthStore();

  // Заглушки данных
  const mockStockData = [
    {
      id: 1,
      productName: 'Лежак 0 Чеш 1800×1200×30',
      article: 'LCH-1800-1200-30',
      category: 'Чешские',
      currentStock: 145,
      reservedStock: 23,
      availableStock: 122,
      normStock: 100,
      price: 15430,
      updatedAt: '2025-06-25T14:32:00Z'
    },
    {
      id: 2,
      productName: 'Лежак 0 Чеш 1800×1200×35',
      article: 'LCH-1800-1200-35',
      category: 'Чешские',
      currentStock: 89,
      reservedStock: 12,
      availableStock: 77,
      normStock: 50,
      price: 16780,
      updatedAt: '2025-06-24T09:15:00Z'
    },
    {
      id: 3,
      productName: 'Лежак 0 Чеш 1800×1200×40',
      article: 'LCH-1800-1200-40',
      category: 'Чешские',
      currentStock: 67,
      reservedStock: 5,
      availableStock: 62,
      normStock: 80,
      price: 18920,
      updatedAt: '2025-06-23T16:45:00Z'
    },
    {
      id: 4,
      productName: 'Коврик кольцевой 600×400',
      article: 'KK-600-400',
      category: 'Коврики',
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      normStock: 200,
      price: 2850,
      updatedAt: '2025-06-20T11:20:00Z'
    }
  ];

  const getStockStatus = (available: number, norm: number) => {
    if (available <= 0) return { status: 'critical', color: 'red', text: 'Закончился' };
    if (available < norm * 0.5) return { status: 'low', color: 'orange', text: 'Мало' };
    return { status: 'normal', color: 'green', text: 'Норма' };
  };

  const filteredData = mockStockData.filter(item => {
    if (searchText && !item.productName.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all') {
      const stockStatus = getStockStatus(item.availableStock, item.normStock);
      if (statusFilter !== stockStatus.status) {
        return false;
      }
    }
    return true;
  });

  const columns = [
    {
      title: 'Товар',
      dataIndex: 'productName',
      key: 'productName',
      render: (text: string, record: any) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.article} • {record.category}
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
      render: (value: number, record: any) => {
        const status = getStockStatus(value, record.normStock);
        return (
          <Text strong style={{ color: status.color === 'green' ? '#52c41a' : status.color === 'orange' ? '#faad14' : '#ff4d4f' }}>
            📦 {value} шт
          </Text>
        );
      },
    },
    {
      title: 'Статус',
      key: 'status',
      align: 'center' as const,
      render: (_: any, record: any) => {
        const status = getStockStatus(record.availableStock, record.normStock);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      align: 'right' as const,
      render: (value: number) => <Text>💰 {value.toLocaleString()}₽</Text>,
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
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<HistoryOutlined />} title="История движения">
            История
          </Button>
          {(user?.role === 'director' || user?.role === 'warehouse') && (
            <Button size="small" icon={<EditOutlined />} title="Корректировка остатка">
              Корректировка
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const summaryStats = {
    total: filteredData.length,
    critical: filteredData.filter(item => getStockStatus(item.availableStock, item.normStock).status === 'critical').length,
    low: filteredData.filter(item => getStockStatus(item.availableStock, item.normStock).status === 'low').length,
    normal: filteredData.filter(item => getStockStatus(item.availableStock, item.normStock).status === 'normal').length,
  };

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                <InboxOutlined style={{ marginRight: 12 }} />
                Остатки на складе
              </Title>
              <Text type="secondary">
                Текущие остатки товаров с индикацией критичных уровней
              </Text>
            </div>
          </div>
        </Col>

        {/* Статистика */}
        <Col span={24}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Всего позиций"
                  value={summaryStats.total}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Критичные"
                  value={summaryStats.critical}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Мало"
                  value={summaryStats.low}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="В норме"
                  value={summaryStats.normal}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Фильтры */}
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
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  placeholder="Фильтр по статусу"
                >
                  <Option value="all">Все статусы</Option>
                  <Option value="critical">Критичные</Option>
                  <Option value="low">Мало</Option>
                  <Option value="normal">В норме</Option>
                </Select>
              </Col>
              <Col xs={24} sm={24} md={8}>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary">
                    Показано: {filteredData.length} из {mockStockData.length} позиций
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Таблица остатков */}
        <Col span={24}>
          <Card>
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} из ${total} позиций`,
              }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Stock; 