import React, { useState, useEffect, useMemo } from 'react';
import {
  Row, Col, Card, Table, Button, Input, Select, Space, Typography, Tag, Statistic,
  message, Modal, Form, Dropdown, MenuProps, Tooltip, Progress
} from 'antd';
import {
  ToolOutlined, SearchOutlined, FilterOutlined, EyeOutlined, EditOutlined,
  PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, ReloadOutlined, 
  MoreOutlined, BuildOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { 
  productionApi, 
  ProductionQueueItem, 
  ProductionFilters, 
  ProductionStats,
  UpdateProductionStatusRequest 
} from '../services/productionApi';
import './Production.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Production: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  
  const [productionQueue, setProductionQueue] = useState<ProductionQueueItem[]>([]);
  const [stats, setStats] = useState<ProductionStats>({
    byStatus: [],
    urgentItems: 0,
    overdueItems: 0
  });
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Modal states
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProductionQueueItem | null>(null);
  const [statusForm] = Form.useForm();

  // Load production queue
  const loadProductionQueue = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const filters: ProductionFilters = {
        limit: 100,
        offset: 0
      };
      
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (priorityFilter !== 'all') filters.priority = Number(priorityFilter);

      const [queueResponse, statsResponse] = await Promise.all([
        productionApi.getProductionQueue(filters, token),
        productionApi.getProductionStats(token)
      ]);
      
      if (queueResponse.success) {
        setProductionQueue(queueResponse.data);
      } else {
        message.error('Ошибка загрузки очереди производства');
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки очереди производства:', error);
      message.error('Ошибка связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductionQueue();
  }, [statusFilter, priorityFilter, token]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadProductionQueue, 30000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter, token]);

  // Filter items by search text
  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return productionQueue;
    
    const searchLower = searchText.toLowerCase();
    return productionQueue.filter(item => 
      item.product?.name.toLowerCase().includes(searchLower) ||
      item.product?.article?.toLowerCase().includes(searchLower) ||
      item.order?.orderNumber.toLowerCase().includes(searchLower) ||
      item.order?.customerName.toLowerCase().includes(searchLower)
    );
  }, [productionQueue, searchText]);

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap = {
      queued: { color: 'blue', text: 'В очереди', icon: <ClockCircleOutlined /> },
      in_progress: { color: 'orange', text: 'В работе', icon: <PlayCircleOutlined /> },
      completed: { color: 'green', text: 'Завершено', icon: <CheckCircleOutlined /> },
      cancelled: { color: 'red', text: 'Отменено', icon: <WarningOutlined /> }
    };
    return statusMap[status as keyof typeof statusMap] || { color: 'default', text: status, icon: null };
  };

  // Get priority info
  const getPriorityInfo = (priority: number) => {
    if (priority >= 5) return { color: 'red', text: 'Срочный' };
    if (priority >= 4) return { color: 'orange', text: 'Высокий' };
    if (priority >= 3) return { color: 'blue', text: 'Обычный' };
    return { color: 'default', text: 'Низкий' };
  };

  // Handle status change
  const handleStatusChange = async (item: ProductionQueueItem) => {
    setSelectedItem(item);
    setStatusModalVisible(true);
    statusForm.setFieldsValue({ 
      status: item.status,
      notes: item.notes || ''
    });
  };

  const onStatusSubmit = async (values: any) => {
    if (!selectedItem || !token) return;

    try {
      const data: UpdateProductionStatusRequest = {
        status: values.status,
        notes: values.notes
      };

      const response = await productionApi.updateProductionStatus(
        selectedItem.id,
        data,
        token
      );

      if (response.success) {
        message.success('Статус производства успешно изменён');
        setStatusModalVisible(false);
        statusForm.resetFields();
        loadProductionQueue(); // Перезагружаем данные
      } else {
        message.error('Ошибка изменения статуса');
      }
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      message.error('Ошибка связи с сервером');
    }
  };

  // Handle auto queue
  const handleAutoQueue = async () => {
    if (!token) return;

    try {
      const response = await productionApi.autoQueue(token);
      if (response.success) {
        message.success(`Добавлено ${response.data.length} заданий в очередь производства`);
        loadProductionQueue();
      } else {
        message.error('Ошибка автоматической постановки в очередь');
      }
    } catch (error) {
      console.error('Ошибка автоматической постановки в очередь:', error);
      message.error('Ошибка связи с сервером');
    }
  };

  // More actions dropdown
  const getMoreActions = (record: ProductionQueueItem): MenuProps['items'] => [
    {
      key: 'status',
      label: 'Изменить статус',
      icon: <EditOutlined />,
      onClick: () => handleStatusChange(record)
    },
    ...(record.orderId ? [{
      key: 'order',
      label: 'Детали заказа',
      icon: <EyeOutlined />,
      onClick: () => navigate(`/orders/${record.orderId}`)
    }] : [])
  ];

  // Table columns
  const columns = [
    {
      title: 'Товар',
      key: 'product',
      render: (record: ProductionQueueItem) => (
        <div>
          <Text strong>{record.product?.name}</Text>
          {record.product?.article && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Арт. {record.product.article}
              </Text>
            </>
          )}
          {record.product?.category && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {record.product.category.name}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Заказ',
      key: 'order',
      render: (record: ProductionQueueItem) => {
        if (!record.order) return <Text type="secondary">Общий заказ</Text>;
        
        return (
          <div>
            <Button 
              type="link" 
              style={{ padding: 0, height: 'auto' }}
              onClick={() => navigate(`/orders/${record.orderId}`)}
            >
              <Text strong>{record.order.orderNumber}</Text>
            </Button>
            <br />
            <Text style={{ fontSize: '12px' }}>{record.order.customerName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {record.order.manager?.fullName || record.order.manager?.username}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      render: (quantity: number, record: ProductionQueueItem) => (
        <div style={{ textAlign: 'center' }}>
          <Text strong style={{ fontSize: '16px' }}>{quantity}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>шт.</Text>
        </div>
      ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => {
        const priorityInfo = getPriorityInfo(priority);
        return (
          <div style={{ textAlign: 'center' }}>
            <Tag color={priorityInfo.color}>{priorityInfo.text}</Tag>
            <br />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {priority}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ProductionQueueItem) => {
        const statusInfo = getStatusInfo(status);
        
        return (
          <div>
            <Tag color={statusInfo.color} icon={statusInfo.icon}>
              {statusInfo.text}
            </Tag>
            {status === 'in_progress' && record.actualStartDate && (
              <>
                <br />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Начато: {new Date(record.actualStartDate).toLocaleString('ru-RU')}
                </Text>
              </>
            )}
            {status === 'completed' && record.actualCompletionDate && (
              <>
                <br />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Завершено: {new Date(record.actualCompletionDate).toLocaleString('ru-RU')}
                </Text>
              </>
            )}
          </div>
        );
      },
    },
    {
      title: 'Создано',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(date).toLocaleString('ru-RU')}
        </Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: ProductionQueueItem) => (
        <Space>
          <Button 
            size="small" 
            type={record.status === 'queued' ? 'primary' : 'default'}
            icon={record.status === 'queued' ? <PlayCircleOutlined /> : 
                  record.status === 'in_progress' ? <CheckCircleOutlined /> : <EditOutlined />}
            onClick={() => handleStatusChange(record)}
          >
            {record.status === 'queued' ? 'Начать' : 
             record.status === 'in_progress' ? 'Завершить' : 'Изменить'}
          </Button>
          <Dropdown
            menu={{ items: getMoreActions(record) }}
            trigger={['click']}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  // Summary statistics
  const summaryStats = useMemo(() => {
    const total = filteredItems.length;
    const queued = filteredItems.filter(item => item.status === 'queued').length;
    const inProgress = filteredItems.filter(item => item.status === 'in_progress').length;
    const completed = filteredItems.filter(item => item.status === 'completed').length;

    return { total, queued, inProgress, completed };
  }, [filteredItems]);

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                <BuildOutlined style={{ marginRight: 12 }} />
                Производство
              </Title>
              <Text type="secondary">
                Управление очередью производства и контроль выполнения заданий
              </Text>
            </div>
            
            <Space>
              <Button 
                icon={<ReloadOutlined />}
                onClick={loadProductionQueue}
                loading={loading}
              >
                Обновить
              </Button>
              {(user?.role === 'production' || user?.role === 'director') && (
                <Button 
                  type="primary" 
                  icon={<ToolOutlined />}
                  onClick={handleAutoQueue}
                >
                  Автопостановка в очередь
                </Button>
              )}
            </Space>
          </div>
        </Col>

        {/* Статистика */}
        <Col span={24}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="В очереди"
                  value={summaryStats.queued}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="В работе"
                  value={summaryStats.inProgress}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<PlayCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Завершено"
                  value={summaryStats.completed}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="Срочных заданий"
                  value={stats.urgentItems}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<WarningOutlined />}
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
                <Input
                  placeholder="Поиск по товару, заказу, клиенту..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="Статус"
                  style={{ width: '100%' }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                >
                  <Option value="all">Все статусы</Option>
                  <Option value="queued">В очереди</Option>
                  <Option value="in_progress">В работе</Option>
                  <Option value="completed">Завершено</Option>
                  <Option value="cancelled">Отменено</Option>
                </Select>
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="Приоритет"
                  style={{ width: '100%' }}
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                >
                  <Option value="all">Все приоритеты</Option>
                  <Option value="5">Срочные (5)</Option>
                  <Option value="4">Высокие (4)</Option>
                  <Option value="3">Обычные (3)</Option>
                  <Option value="2">Низкие (2)</Option>
                  <Option value="1">Минимальные (1)</Option>
                </Select>
              </Col>
              <Col xs={24} sm={24} md={8}>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary">
                    Показано: {filteredItems.length} заданий
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Таблица производства */}
        <Col span={24}>
          <Card>
            <Table
              columns={columns}
              dataSource={filteredItems}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} из ${total} заданий`,
              }}
              scroll={{ x: 1200 }}
              rowClassName={(record) => {
                if (record.priority >= 5) return 'urgent-priority-row';
                if (record.status === 'in_progress') return 'in-progress-status-row';
                return '';
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Модальное окно изменения статуса */}
      <Modal
        title="Изменение статуса производства"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={onStatusSubmit}
        >
          <Form.Item
            name="status"
            label="Новый статус"
            rules={[{ required: true, message: 'Выберите статус' }]}
          >
            <Select placeholder="Выберите статус">
              <Option value="queued">В очереди</Option>
              <Option value="in_progress">В работе</Option>
              <Option value="completed">Завершено</Option>
              <Option value="cancelled">Отменено</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="notes"
            label="Комментарий"
          >
            <TextArea 
              rows={3} 
              placeholder="Добавить комментарий к производству..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStatusModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                Изменить статус
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Production; 