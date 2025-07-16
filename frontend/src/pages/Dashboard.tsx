import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Progress, Typography, Space, Alert, Spin } from 'antd';
import { 
  ShoppingCartOutlined, 
  WarningOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  TruckOutlined,
  PlusOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { dashboardApi, DashboardData, UrgentOrder, CriticalStockItem, TodayShipment } from '../services/dashboardApi';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Загрузка данных дашборда
  const loadDashboardData = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await dashboardApi.getDashboardData();
      setData(dashboardData);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Dashboard loading error:', err);
      setError(err.response?.data?.error?.message || 'Ошибка загрузки данных дашборда');
    } finally {
      setLoading(false);
    }
  };

  // Автоматическое обновление каждые 30 секунд
  useEffect(() => {
    loadDashboardData();
    
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Обработчики быстрых действий
  const handleNewOrder = () => {
    navigate('/orders/new');
  };

  const handleCheckStock = () => {
    navigate('/stock');
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  // Получение цвета для приоритета заказа
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'normal': return 'blue';
      case 'low': return 'gray';
      default: return 'blue';
    }
  };

  // Получение цвета для статуса заказа
  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'blue';
      case 'confirmed': return 'cyan';
      case 'in_production': return 'orange';
      case 'ready': return 'green';
      case 'completed': return 'success';
      case 'cancelled': return 'red';
      default: return 'default';
    }
  };

  // Получение названия статуса на русском
  const getOrderStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      new: 'Новый',
      confirmed: 'Подтвержден',
      in_production: 'В производстве',
      ready: 'Готов',
      completed: 'Выполнен',
      cancelled: 'Отменен'
    };
    return statusMap[status] || status;
  };

  // Колонки для таблицы критичных остатков
  const criticalStockColumns = [
    {
      title: 'Товар',
      dataIndex: 'productName',
      key: 'productName',
      render: (text: string, record: CriticalStockItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.article && <Text type="secondary" style={{ fontSize: '12px' }}>{record.article}</Text>}
        </div>
      ),
    },
    {
      title: 'Доступно',
      dataIndex: 'availableStock',
      key: 'availableStock',
      render: (value: number) => (
        <Text type={value <= 0 ? 'danger' : value <= 5 ? 'warning' : 'secondary'}>
          {value} шт.
        </Text>
      ),
    },
    {
      title: 'Зарезервировано',
      dataIndex: 'reservedStock',
      key: 'reservedStock',
      render: (value: number) => `${value} шт.`,
    },
    {
      title: 'Норма',
      dataIndex: 'normStock',
      key: 'normStock',
      render: (value: number) => `${value} шт.`,
    },
  ];

  // Колонки для таблицы срочных заказов
  const urgentOrderColumns = [
    {
      title: 'Заказ',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string, record: UrgentOrder) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.customerName}</Text>
        </div>
      ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>
          {priority === 'urgent' ? 'СРОЧНО' : 'ВЫСОКИЙ'}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getOrderStatusColor(status)}>
          {getOrderStatusText(status)}
        </Tag>
      ),
    },
    {
      title: 'Сумма',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => `${amount.toLocaleString('ru-RU')} ₽`,
    },
  ];

  // Колонки для таблицы отгрузок
  const shipmentsColumns = [
    {
      title: 'Номер отгрузки',
      dataIndex: 'shipmentNumber',
      key: 'shipmentNumber',
    },
    {
      title: 'Заказ',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string, record: TodayShipment) => (
        <div>
          <div>{text}</div>
          {record.customerName && <Text type="secondary" style={{ fontSize: '12px' }}>{record.customerName}</Text>}
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'blue', text: 'В очереди' },
          paused: { color: 'orange', text: 'На паузе' },
          completed: { color: 'green', text: 'Выполнена' },
          cancelled: { color: 'red', text: 'Отменена' }
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Ошибка загрузки дашборда"
        description={error}
        type="error"
        showIcon
        action={
          <Button onClick={handleRefresh} type="primary">
            Попробовать снова
          </Button>
        }
      />
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Заголовок и быстрые действия */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Дашборд
          </Title>
          <Text type="secondary">
            Последнее обновление: {lastRefresh.toLocaleTimeString('ru-RU')}
          </Text>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleNewOrder}
            >
              Новый заказ
            </Button>
            <Button 
              icon={<EyeOutlined />} 
              onClick={handleCheckStock}
            >
              Проверить остатки
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={loading}
            >
              Обновить
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Общая статистика заказов */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Активные заказы"
              value={data.orderStats.total}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="В производстве"
              value={data.orderStats.in_production}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Готовы к отгрузке"
              value={data.orderStats.ready}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Отгружено сегодня"
              value={data.todayShipments.length}
              prefix={<TruckOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Статистика остатков */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Состояние склада" extra={<EyeOutlined />}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Критичные остатки"
                  value={data.stockStats.critical}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Мало на складе"
                  value={data.stockStats.low}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={24}>
                <div style={{ marginTop: '16px' }}>
                  <Text>Общее состояние склада:</Text>
                  <Progress
                    percent={Math.round((data.stockStats.normal / data.stockStats.total) * 100)}
                    strokeColor={{
                      '0%': '#ff4d4f',
                      '50%': '#faad14',
                      '100%': '#52c41a',
                    }}
                    format={(percent) => `${percent}% в норме`}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="Финансовые показатели">
            <Statistic
              title="Общая сумма заказов"
              value={data.orderStats.totalAmount}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
              suffix="₽"
            />
            <div style={{ marginTop: '16px' }}>
              <Statistic
                title="Средний чек"
                value={data.totalMetrics.avgOrderAmount}
                precision={0}
                valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                suffix="₽"
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Детальные таблицы */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card 
            title="Критичные остатки (топ-10)" 
            extra={
              <Button size="small" onClick={() => navigate('/stock?status=critical')}>
                Показать все
              </Button>
            }
          >
            <Table
              dataSource={data.criticalStock}
              columns={criticalStockColumns}
              pagination={false}
              size="small"
              rowKey="productId"
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="Срочные заказы"
            extra={
              <Button size="small" onClick={() => navigate('/orders?priority=urgent,high')}>
                Показать все
              </Button>
            }
          >
            <Table
              dataSource={data.urgentOrders}
              columns={urgentOrderColumns}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card 
            title="Отгрузки за сегодня"
            extra={
              <Button size="small" onClick={() => navigate('/shipments')}>
                Все отгрузки
              </Button>
            }
          >
            <Table
              dataSource={data.todayShipments}
              columns={shipmentsColumns}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 