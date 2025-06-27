import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Button, List, Tag, Progress } from 'antd';
import {
  ShoppingCartOutlined,
  InboxOutlined,
  AlertOutlined,
  TruckOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Заглушки данных - в будущем будут загружаться из API
  const mockData = {
    orders: {
      active: 23,
      urgent: 5,
      inProduction: 8,
      ready: 6
    },
    stock: {
      critical: 12,
      low: 28,
      normal: 347
    },
    shipments: {
      today: 4,
      planned: 7
    }
  };

  const criticalStockItems = [
    { name: 'Лежак 0 Чеш 1800×1200×40', current: 2, norm: 80, status: 'critical' },
    { name: 'Коврик кольцевой 600×400 СТАР', current: 8, norm: 50, status: 'low' },
    { name: 'Дюбель 10×80мм', current: 145, norm: 1000, status: 'low' },
    { name: 'Лежак GEA 1800×1200 2ст пазл', current: 0, norm: 30, status: 'critical' }
  ];

  const urgentOrders = [
    { id: 'ORD-1247', customer: 'ООО "Агротек"', items: 15, deadline: '28.06.25', priority: 'urgent' },
    { id: 'ORD-1249', customer: 'ИП Велес', items: 8, deadline: '29.06.25', priority: 'high' },
    { id: 'ORD-1252', customer: 'ООО "Рассвет"', items: 23, deadline: '30.06.25', priority: 'urgent' }
  ];

  const recentShipments = [
    { id: 'SHIP-456', order: 'ORD-1245', customer: 'ООО "Молоко"', time: '14:30' },
    { id: 'SHIP-457', order: 'ORD-1243', customer: 'КФХ Иванов', time: '12:15' },
    { id: 'SHIP-458', order: 'ORD-1241', customer: 'ООО "Агро+"', time: '09:45' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return '#ff4d4f';
      case 'low': return '#faad14';
      case 'urgent': return '#ff4d4f';
      case 'high': return '#fa8c16';
      default: return '#52c41a';
    }
  };

  const getPriorityTag = (priority: string) => {
    const colors = {
      urgent: 'red',
      high: 'orange',
      normal: 'blue',
      low: 'default'
    };
    const labels = {
      urgent: 'Срочно',
      high: 'Высокий',
      normal: 'Обычный', 
      low: 'Низкий'
    };
    return <Tag color={colors[priority as keyof typeof colors]}>{labels[priority as keyof typeof labels]}</Tag>;
  };

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                Добро пожаловать, {user?.fullName?.split(' ')[0] || user?.username}! 👋
              </Title>
              <Text type="secondary">
                Обзор состояния склада и заказов на {new Date().toLocaleDateString('ru-RU')}
              </Text>
            </div>
            
            {(user?.role === 'manager' || user?.role === 'director') && (
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/orders/create')}
                  size="large"
                >
                  Новый заказ
                </Button>
                <Button 
                  icon={<EyeOutlined />}
                  onClick={() => navigate('/stock')}
                  size="large"
                >
                  Проверить остатки
                </Button>
              </Space>
            )}
          </div>
        </Col>

        {/* Основные метрики */}
        <Col span={24}>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="dashboard-card">
                <Statistic
                  title="Активные заказы"
                  value={mockData.orders.active}
                  prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="dashboard-card">
                <Statistic
                  title="Критичные остатки"
                  value={mockData.stock.critical}
                  prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="dashboard-card">
                <Statistic
                  title="В производстве"
                  value={mockData.orders.inProduction}
                  prefix={<InboxOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="dashboard-card">
                <Statistic
                  title="Отгрузки сегодня"
                  value={mockData.shipments.today}
                  prefix={<TruckOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Основной контент */}
        <Col span={24}>
          <Row gutter={16}>
            {/* Критичные остатки */}
            <Col xs={24} lg={12}>
              <Card 
                title="🚨 Критичные остатки (топ-10)"
                extra={<Button type="link" onClick={() => navigate('/stock?status=critical')}>Показать все</Button>}
                className="dashboard-card"
              >
                <List
                  dataSource={criticalStockItems}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>{item.name}</Text>
                            <Tag color={getStatusColor(item.status)}>
                              {item.current} шт
                            </Tag>
                          </div>
                        }
                        description={
                          <Progress 
                            percent={Math.round((item.current / item.norm) * 100)} 
                            status={item.status === 'critical' ? 'exception' : 'active'}
                            showInfo={false}
                            size="small"
                          />
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* Срочные заказы */}
            <Col xs={24} lg={12}>
              <Card 
                title="⏰ Срочные заказы"
                extra={<Button type="link" onClick={() => navigate('/orders?priority=urgent')}>Показать все</Button>}
                className="dashboard-card"
              >
                <List
                  dataSource={urgentOrders}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button type="link" onClick={() => navigate(`/orders/${item.id}`)}>
                              {item.id}
                            </Button>
                            {getPriorityTag(item.priority)}
                          </div>
                        }
                        description={
                          <div>
                            <Text>{item.customer}</Text><br />
                            <Text type="secondary">{item.items} позиций • до {item.deadline}</Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Последние отгрузки */}
        <Col span={24}>
          <Card 
            title="🚛 Последние отгрузки за день"
            extra={<Button type="link" onClick={() => navigate('/shipments')}>Журнал отгрузок</Button>}
            className="dashboard-card"
          >
            <Row gutter={16}>
              {recentShipments.map((shipment) => (
                <Col xs={24} sm={8} key={shipment.id}>
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong>{shipment.id}</Text>
                        <Text type="secondary">{shipment.time}</Text>
                      </div>
                      <Text>{shipment.customer}</Text>
                      <Button type="link" size="small" onClick={() => navigate(`/orders/${shipment.order}`)}>
                        {shipment.order}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 