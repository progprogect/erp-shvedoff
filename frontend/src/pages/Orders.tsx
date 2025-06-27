import React, { useState } from 'react';
import { Table, Card, Typography, Button, Space, Tag, Input, Select, Row, Col, Statistic } from 'antd';
import { SearchOutlined, ShoppingCartOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const Orders: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Заглушки данных
  const mockOrders = [
    {
      id: 1,
      orderNumber: 'ORD-1247',
      customerName: 'ООО "Агротек"',
      customerContact: '+7 (999) 123-45-67',
      status: 'new',
      priority: 'urgent',
      deliveryDate: '2025-06-28',
      managerName: 'Петров П.П.',
      totalAmount: 462300,
      itemsCount: 15,
      createdAt: '2025-06-25T10:30:00Z'
    },
    {
      id: 2,
      orderNumber: 'ORD-1248',
      customerName: 'КФХ Иванов',
      customerContact: '+7 (999) 234-56-78',
      status: 'confirmed',
      priority: 'normal',
      deliveryDate: '2025-07-05',
      managerName: 'Сидоров С.С.',
      totalAmount: 89450,
      itemsCount: 5,
      createdAt: '2025-06-24T14:15:00Z'
    },
    {
      id: 3,
      orderNumber: 'ORD-1249',
      customerName: 'ИП Велес',
      customerContact: '+7 (999) 345-67-89',
      status: 'in_production',
      priority: 'high',
      deliveryDate: '2025-06-29',
      managerName: 'Петров П.П.',
      totalAmount: 134220,
      itemsCount: 8,
      createdAt: '2025-06-23T09:45:00Z'
    }
  ];

  const getStatusInfo = (status: string) => {
    const statusMap = {
      new: { color: 'blue', text: 'Новый' },
      confirmed: { color: 'cyan', text: 'Подтвержден' },
      in_production: { color: 'orange', text: 'В производстве' },
      ready: { color: 'green', text: 'Готов' },
      shipped: { color: 'purple', text: 'Отгружен' },
      delivered: { color: 'success', text: 'Доставлен' },
      cancelled: { color: 'red', text: 'Отменен' }
    };
    return statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
  };

  const getPriorityInfo = (priority: string) => {
    const priorityMap = {
      low: { color: 'default', text: 'Низкий' },
      normal: { color: 'blue', text: 'Обычный' },
      high: { color: 'orange', text: 'Высокий' },
      urgent: { color: 'red', text: 'Срочно' }
    };
    return priorityMap[priority as keyof typeof priorityMap] || { color: 'default', text: priority };
  };

  const filteredData = mockOrders.filter(order => {
    if (searchText && 
        !order.orderNumber.toLowerCase().includes(searchText.toLowerCase()) &&
        !order.customerName.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    if (priorityFilter !== 'all' && order.priority !== priorityFilter) {
      return false;
    }
    return true;
  });

  const columns = [
    {
      title: 'Номер заказа',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string, record: any) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/orders/${record.id}`)}
          style={{ padding: 0, fontSize: '14px', fontWeight: 'bold' }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (text: string, record: any) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.customerContact}
          </Text>
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      render: (status: string) => {
        const statusInfo = getStatusInfo(status);
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      align: 'center' as const,
      render: (priority: string) => {
        const priorityInfo = getPriorityInfo(priority);
        return <Tag color={priorityInfo.color}>{priorityInfo.text}</Tag>;
      },
    },
    {
      title: 'Срок поставки',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      render: (date: string) => {
        const deliveryDate = new Date(date);
        const today = new Date();
        const diffDays = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let color = '#52c41a';
        if (diffDays < 0) color = '#ff4d4f';
        else if (diffDays <= 2) color = '#faad14';
        
        return (
          <Text style={{ color }}>
            {deliveryDate.toLocaleDateString('ru-RU')}
            <br />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {diffDays < 0 ? `Просрочен на ${Math.abs(diffDays)} дн.` : 
               diffDays === 0 ? 'Сегодня' :
               diffDays === 1 ? 'Завтра' :
               `Через ${diffDays} дн.`}
            </Text>
          </Text>
        );
      },
    },
    {
      title: 'Менеджер',
      dataIndex: 'managerName',
      key: 'managerName',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Сумма',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amount: number, record: any) => (
        <div style={{ textAlign: 'right' }}>
          <Text strong>💰 {amount.toLocaleString()}₽</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.itemsCount} поз.
          </Text>
        </div>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          >
            Детали
          </Button>
        </Space>
      ),
    },
  ];

  const summaryStats = {
    total: filteredData.length,
    new: filteredData.filter(order => order.status === 'new').length,
    inProduction: filteredData.filter(order => order.status === 'in_production').length,
    urgent: filteredData.filter(order => order.priority === 'urgent').length,
  };

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                <ShoppingCartOutlined style={{ marginRight: 12 }} />
                Заказы
              </Title>
              <Text type="secondary">
                Управление заказами и контроль выполнения
              </Text>
            </div>
            
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/orders/create')}
              size="large"
            >
              Создать заказ
            </Button>
          </div>
        </Col>

        {/* Статистика */}
        <Col span={24}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Всего заказов"
                  value={summaryStats.total}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Новые"
                  value={summaryStats.new}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="В производстве"
                  value={summaryStats.inProduction}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Срочные"
                  value={summaryStats.urgent}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Фильтры */}
        <Col span={24}>
          <Card>
            <Row gutter={16} align="middle">
              <Col xs={24} sm={8} md={6}>
                <Search
                  placeholder="Поиск по номеру или клиенту..."
                  allowClear
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={8} md={6}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  placeholder="Статус"
                >
                  <Option value="all">Все статусы</Option>
                  <Option value="new">Новый</Option>
                  <Option value="confirmed">Подтвержден</Option>
                  <Option value="in_production">В производстве</Option>
                  <Option value="ready">Готов</Option>
                  <Option value="shipped">Отгружен</Option>
                </Select>
              </Col>
              <Col xs={24} sm={8} md={6}>
                <Select
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  style={{ width: '100%' }}
                  placeholder="Приоритет"
                >
                  <Option value="all">Все приоритеты</Option>
                  <Option value="urgent">Срочно</Option>
                  <Option value="high">Высокий</Option>
                  <Option value="normal">Обычный</Option>
                  <Option value="low">Низкий</Option>
                </Select>
              </Col>
              <Col xs={24} sm={24} md={6}>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary">
                    Показано: {filteredData.length} из {mockOrders.length} заказов
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Таблица заказов */}
        <Col span={24}>
          <Card>
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} из ${total} заказов`,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Orders; 