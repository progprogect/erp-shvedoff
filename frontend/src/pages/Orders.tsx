import React, { useState, useEffect, useMemo } from 'react';
import {
  Row, Col, Card, Table, Button, Input, Select, Space, Typography, Tag, Statistic,
  Modal, Form, Dropdown, MenuProps, App, Tabs
} from 'antd';
import {
  PlusOutlined, SearchOutlined, FilterOutlined, EyeOutlined, EditOutlined,
  ShoppingCartOutlined, MoreOutlined, DeleteOutlined, ExclamationCircleOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import usePermissions from '../hooks/usePermissions';
import { handleFormError } from '../utils/errorUtils';
import { ordersApi, Order, OrderFilters, exportOrders } from '../services/ordersApi';
import { ORDER_STATUS_LABELS } from '../constants/orderStatuses';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { canCreate, canEdit } = usePermissions();
  const { message, modal } = App.useApp();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  
  // Состояние для архива (WBS 2 - Adjustments Задача 5.1)
  const [currentTab, setCurrentTab] = useState<string>('active');
  
  // Состояние для экспорта (Задача 9.2)
  const [exportingOrders, setExportingOrders] = useState(false);
  
  // Modal states
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusForm] = Form.useForm();

  // Load orders
  const loadOrders = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const filters: OrderFilters = {
        limit: 100,
        offset: 0
      };
      
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (priorityFilter !== 'all') filters.priority = priorityFilter;
      if (managerFilter !== 'all') filters.managerId = Number(managerFilter);

      const response = await ordersApi.getOrders(filters);
      
      if (response.success) {
        setOrders(response.data);
      } else {
        message.error('Ошибка загрузки заказов');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка загрузки заказов:', error);
      handleFormError(error, undefined, {
        key: 'load-orders-error',
        duration: 4
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, priorityFilter, managerFilter, token]);

  // Filter orders by search text
  const filteredOrders = useMemo(() => {
    if (!searchText.trim()) return orders;
    
    const searchLower = searchText.toLowerCase();
    return orders.filter(order => 
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.customerName.toLowerCase().includes(searchLower) ||
      order.manager?.fullName?.toLowerCase().includes(searchLower)
    );
  }, [orders, searchText]);

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap = {
      new: { color: 'blue', text: ORDER_STATUS_LABELS.new },
      confirmed: { color: 'cyan', text: ORDER_STATUS_LABELS.confirmed },
      in_production: { color: 'orange', text: ORDER_STATUS_LABELS.in_production },
      ready: { color: 'green', text: ORDER_STATUS_LABELS.ready },
      completed: { color: 'success', text: ORDER_STATUS_LABELS.completed },
      cancelled: { color: 'red', text: ORDER_STATUS_LABELS.cancelled }
    };
    return statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
  };

  // Get priority info
  const getPriorityInfo = (priority: string) => {
    const priorityMap = {
      low: { color: 'default', text: 'Низкий' },
      normal: { color: 'blue', text: 'Обычный' },
      high: { color: 'orange', text: 'Высокий' },
      urgent: { color: 'red', text: 'Срочный' }
    };
    return priorityMap[priority as keyof typeof priorityMap] || { color: 'default', text: priority };
  };

  // Handle status change
  const handleStatusChange = async (order: Order) => {
    setSelectedOrder(order);
    setStatusModalVisible(true);
    statusForm.setFieldsValue({ status: order.status });
  };

  const onStatusSubmit = async (values: any) => {
    if (!selectedOrder || !token) return;

    try {
      const response = await ordersApi.updateOrderStatus(
        selectedOrder.id,
        values.status,
        values.comment
      );

      if (response.success) {
        message.success('Статус заказа успешно изменён');
        setStatusModalVisible(false);
        statusForm.resetFields();
        loadOrders(); // Перезагружаем данные
      } else {
        message.error('Ошибка изменения статуса');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка изменения статуса:', error);
      handleFormError(error, undefined, {
        key: 'change-status-error',
        duration: 4
      });
    }
  };

  // Функция экспорта заказов (Задача 9.2)
  const handleExportOrders = async () => {
    setExportingOrders(true);
    try {
      // Формируем фильтры на основе текущих настроек
      const currentFilters: any = {
        search: searchText || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        managerId: managerFilter !== 'all' ? managerFilter : undefined
      };

      await exportOrders(currentFilters);
      
      message.success('Экспорт заказов завершен');
      
    } catch (error: any) {
      console.error('🚨 Ошибка экспорта заказов:', error);
      handleFormError(error, undefined, {
        key: 'export-orders-error',
        duration: 4
      });
    } finally {
      setExportingOrders(false);
    }
  };

  // Delete order handler
  const handleDeleteOrder = async (order: Order) => {
    if (!token) return;

    modal.confirm({
      title: 'Удаление заказа',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Вы уверены, что хотите удалить заказ <strong>{order.orderNumber}</strong>?</p>
          <p>Клиент: <strong>{order.customerName}</strong></p>
          <p style={{ color: '#ff4d4f', marginTop: '8px' }}>
            ⚠️ Это действие нельзя отменить. Все резервы товаров будут освобождены.
          </p>
        </div>
      ),
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const response = await ordersApi.deleteOrder(order.id);
          
          if (response.success) {
            message.success('Заказ успешно удален');
            loadOrders(); // Перезагружаем список
          } else {
            message.error(response.message || 'Ошибка удаления заказа');
          }
        } catch (error: any) {
          console.error('🚨 Ошибка удаления заказа:', error);
          handleFormError(error, undefined, {
            key: 'delete-order-error',
            duration: 4
          });
        }
      }
    });
  };

  // More actions dropdown
  const getMoreActions = (record: Order): MenuProps['items'] => [
    {
      key: 'view',
      label: 'Детали заказа',
      icon: <EyeOutlined />,
      onClick: () => navigate(`/orders/${record.id}`)
    },
    {
      key: 'status',
      label: 'Изменить статус',
      icon: <EditOutlined />,
      onClick: () => handleStatusChange(record)
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      label: 'Удалить заказ',
      icon: <DeleteOutlined />,
      danger: true,
      disabled: !['new', 'confirmed', 'in_production'].includes(record.status),
      onClick: () => handleDeleteOrder(record)
    }
  ];

  // Table columns
  const columns = [
    {
      title: 'Номер заказа',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string, record: Order) => (
        <div>
          <Button 
            type="link" 
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/orders/${record.id}`)}
          >
            <Text strong>{text}</Text>
          </Button>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {new Date(record.createdAt).toLocaleDateString('ru-RU')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (text: string, record: Order) => (
        <div>
          <Text strong>{text}</Text>
          {record.customerContact && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.customerContact}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = getStatusInfo(status);
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
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
        if (!date) return <Text type="secondary">Не указан</Text>;
        
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
      dataIndex: 'manager',
      key: 'manager',
      render: (manager: any) => (
        <Text>{manager?.fullName || manager?.username || '—'}</Text>
      ),
    },
    {
      title: 'Сумма',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amount: string, record: Order) => (
        <div style={{ textAlign: 'right' }}>
          <Text strong>💰 {Number(amount).toLocaleString()}₽</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.items?.length || 0} поз.
          </Text>
        </div>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: Order) => (
        <Space>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          >
            Детали
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
    const total = filteredOrders.length;
    const newOrders = filteredOrders.filter(order => order.status === 'new').length;
    const inProduction = filteredOrders.filter(order => order.status === 'in_production').length;
    const urgent = filteredOrders.filter(order => order.priority === 'urgent').length;

    return { total, newOrders, inProduction, urgent };
  }, [filteredOrders]);

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
            
                            {canCreate('orders') && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => navigate('/orders/create')}
                size="large"
              >
                Создать заказ
              </Button>
            )}
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
                  value={summaryStats.newOrders}
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

        {/* Вкладки и содержимое (WBS 2 - Adjustments Задача 5.1) */}
        <Col span={24}>
          <Card>
            <Tabs
              activeKey={currentTab}
              onChange={setCurrentTab}
              items={[
                {
                  key: 'active',
                  label: (
                    <span>
                      <ShoppingCartOutlined />
                      Активные заказы
                    </span>
                  ),
                  children: (
                    <div>
                      {/* Фильтры для активных заказов */}
                      <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={12} md={6}>
                          <Input
                            placeholder="Поиск по номеру, клиенту, менеджеру..."
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
                            <Option value="new">Новые</Option>
                            <Option value="confirmed">Подтверждённые</Option>
                            <Option value="in_production">В производстве</Option>
                            <Option value="ready">{ORDER_STATUS_LABELS.ready}</Option>
                            <Option value="cancelled">Отменённые</Option>
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
                            <Option value="urgent">Срочные</Option>
                            <Option value="high">Высокие</Option>
                            <Option value="normal">Обычные</Option>
                            <Option value="low">Низкие</Option>
                          </Select>
                        </Col>
                        <Col xs={24} sm={24} md={10}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                            {/* Кнопка экспорта заказов (Задача 9.2) */}
                            <Button
                              icon={<InboxOutlined />}
                              onClick={handleExportOrders}
                              loading={exportingOrders}
                              title="Экспорт текущего списка заказов с примененными фильтрами"
                            >
                              📊 Экспорт заказов
                            </Button>
                            <Text type="secondary">
                              Показано: {filteredOrders.length} активных заказов
                            </Text>
                          </div>
                        </Col>
                      </Row>

                      {/* Таблица активных заказов */}
                      <Table
                        columns={columns}
                        dataSource={filteredOrders}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                          pageSize: 20,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} из ${total} активных заказов`,
                        }}
                        scroll={{ x: 1200 }}
                      />
                    </div>
                  )
                },
                {
                  key: 'archive',
                  label: (
                    <span>
                      <InboxOutlined />
                      Архив
                    </span>
                  ),
                  children: (
                    <div>
                      {/* Фильтры для архива */}
                      <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={12} md={8}>
                          <Input
                            placeholder="Поиск в архиве..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                          />
                        </Col>
                        <Col xs={12} sm={6} md={4}>
                          <Select
                            placeholder="Приоритет"
                            style={{ width: '100%' }}
                            value={priorityFilter}
                            onChange={setPriorityFilter}
                          >
                            <Option value="all">Все приоритеты</Option>
                            <Option value="urgent">Срочные</Option>
                            <Option value="high">Высокие</Option>
                            <Option value="normal">Обычные</Option>
                            <Option value="low">Низкие</Option>
                          </Select>
                        </Col>
                        <Col xs={24} sm={24} md={12}>
                          <div style={{ textAlign: 'right' }}>
                            <Text type="secondary">
                              Показано: {filteredOrders.length} завершенных заказов
                            </Text>
                          </div>
                        </Col>
                      </Row>

                      {/* Таблица архивных заказов */}
                      <Table
                        columns={columns.filter(col => col.key !== 'actions')} // Убираем действия для архивных заказов
                        dataSource={filteredOrders}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                          pageSize: 20,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} из ${total} архивных заказов`,
                        }}
                        scroll={{ x: 1200 }}
                      />
                    </div>
                  )
                }
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Модальное окно изменения статуса */}
      <Modal
        title="Изменение статуса заказа"
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
              <Option value="new">Новый</Option>
              <Option value="confirmed">Подтверждён</Option>
              <Option value="in_production">В производстве</Option>
              <Option value="ready">{ORDER_STATUS_LABELS.ready}</Option>
              <Option value="completed">{ORDER_STATUS_LABELS.completed}</Option>
              <Option value="cancelled">Отменён</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="comment"
            label="Комментарий (необязательно)"
          >
            <TextArea 
              rows={3} 
              placeholder="Причина изменения статуса..."
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

export default Orders; 