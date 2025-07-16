import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Tag, Table, Button, Space, Divider, Timeline,
  Form, Input, Modal, Select, Statistic, Descriptions, Badge, Avatar,
  DatePicker, Popconfirm, InputNumber, App
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, MessageOutlined, UserOutlined,
  ShoppingCartOutlined, CalendarOutlined, PhoneOutlined, DollarOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, PlusOutlined, SettingOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ordersApi, Order, OrderItem, OrderMessage } from '../services/ordersApi';
import { catalogApi, Product } from '../services/catalogApi';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
}

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { message, modal } = App.useApp();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  
  const [statusForm] = Form.useForm();
  const [messageForm] = Form.useForm();
  const [editForm] = Form.useForm();
  
  // For editing
  const [products, setProducts] = useState<Product[]>([]);
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);
  const [searchText, setSearchText] = useState('');

  // Load order details
  useEffect(() => {
    if (id && token) {
      loadOrder();
      loadProducts();
      loadUsers();
    }
  }, [id, token]);

  const loadOrder = async () => {
    if (!id || !token) return;
    
    setLoading(true);
    try {
      const response = await ordersApi.getOrder(Number(id));
      
      if (response.success) {
        setOrder(response.data);
      } else {
        message.error('Ошибка загрузки заказа');
        navigate('/orders');
      }
    } catch (error) {
      console.error('Ошибка загрузки заказа:', error);
      message.error('Ошибка связи с сервером');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!token) return;
    
    try {
      const response = await catalogApi.getProducts({ page: 1, limit: 100 });
      if (response.success) {
        setProducts(response.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    }
  };

  const loadUsers = async () => {
    if (!token) return;
    
    try {
      const response = await catalogApi.getUsers();
      
      if (response.success) {
        // Фильтруем только менеджеров и директоров для назначения заказов
        const availableUsers = response.data.filter(
          (u: User) => u.role === 'manager' || u.role === 'director'
        );
        setUsers(availableUsers);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  // Handle status change
  const handleStatusChange = async (values: any) => {
    if (!order || !token) return;

    try {
      const response = await ordersApi.updateOrderStatus(
        order.id,
        values.status,
        values.comment
      );

      if (response.success) {
        message.success('Статус заказа изменён');
        setStatusModalVisible(false);
        statusForm.resetFields();
        loadOrder(); // Reload order
      } else {
        message.error('Ошибка изменения статуса');
      }
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      message.error('Ошибка связи с сервером');
    }
  };

  // Handle add message
  const handleAddMessage = async (values: any) => {
    if (!order || !token) return;

    try {
      const response = await ordersApi.addMessage(order.id, values.message);

      if (response.success) {
        message.success('Сообщение добавлено');
        setMessageModalVisible(false);
        messageForm.resetFields();
        loadOrder(); // Reload order
      } else {
        message.error('Ошибка добавления сообщения');
      }
    } catch (error) {
      console.error('Ошибка добавления сообщения:', error);
      message.error('Ошибка связи с сервером');
    }
  };

  // Handle edit order
  const handleEditOrder = async (values: any) => {
    if (!order || !token) return;

    try {
      // Prepare order data
      const orderData = {
        customerName: values.customerName,
        customerContact: values.customerContact,
        deliveryDate: values.deliveryDate ? dayjs(values.deliveryDate).toISOString() : null,
        priority: values.priority,
        notes: values.notes,
        managerId: values.managerId, // Добавляем назначенного менеджера
        items: editingItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const response = await ordersApi.updateOrder(order.id, orderData);

      if (response.success) {
        message.success('Заказ успешно обновлён');
        setEditModalVisible(false);
        editForm.resetFields();
        loadOrder(); // Reload order
      } else {
        message.error('Ошибка обновления заказа');
      }
    } catch (error) {
      console.error('Ошибка обновления заказа:', error);
      message.error('Ошибка связи с сервером');
    }
  };

  // Open edit modal
  const openEditModal = () => {
    if (!order) return;
    
    setEditingItems([...(order.items || [])]);
    editForm.setFieldsValue({
      customerName: order.customerName,
      customerContact: order.customerContact,
      deliveryDate: order.deliveryDate ? dayjs(order.deliveryDate) : null,
      priority: order.priority,
      notes: order.notes,
      managerId: order.managerId // Инициализируем текущим менеджером
    });
    setEditModalVisible(true);
  };

  // Add product to editing items
  const addProductToOrder = (product: Product) => {
    const existing = editingItems.find(item => item.productId === product.id);
    if (existing) {
      message.warning('Товар уже добавлен в заказ');
      return;
    }

    const newItem: OrderItem = {
      id: Date.now(), // Use number ID
      orderId: order!.id,
      productId: product.id,
      quantity: 1,
      reservedQuantity: 0,
      price: String(Number(product.price) || 0), // Convert to string
      createdAt: new Date().toISOString(),
      product: {
        ...product,
        stock: {
          currentStock: product.stock?.currentStock || 0,
          reservedStock: product.stock?.reservedStock || 0,
          availableStock: (product.stock?.currentStock || 0) - (product.stock?.reservedStock || 0),
          inProductionQuantity: 0
        }
      }
    };

    setEditingItems([...editingItems, newItem]);
    setProductModalVisible(false);
    setSearchText('');
  };

  // Remove product from editing items
  const removeProductFromOrder = (itemId: number) => {
    setEditingItems(editingItems.filter(item => item.id !== itemId));
  };

  // Update item quantity/price
  const updateOrderItem = (itemId: number, field: 'quantity' | 'price', value: number) => {
    setEditingItems(editingItems.map(item => 
      item.id === itemId ? { 
        ...item, 
        [field]: field === 'price' ? String(value) : value 
      } : item
    ));
  };

  // Check if order can be edited
  const canEditOrder = () => {
    if (!order) return false;
            // Can't edit completed or cancelled orders
        const nonEditableStatuses = ['completed', 'cancelled'];
    return !nonEditableStatuses.includes(order.status);
  };

  // Delete order handler
  const handleDeleteOrder = async () => {
    if (!order || !token) return;

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
            navigate('/orders'); // Возвращаемся к списку заказов
          } else {
            message.error(response.message || 'Ошибка удаления заказа');
          }
        } catch (error) {
          console.error('Ошибка удаления заказа:', error);
          message.error('Ошибка связи с сервером');
        }
      }
    });
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap = {
      new: { color: 'blue', text: 'Новый', icon: <ClockCircleOutlined /> },
      confirmed: { color: 'cyan', text: 'Подтверждён', icon: <CheckCircleOutlined /> },
      in_production: { color: 'orange', text: 'В производстве', icon: <ExclamationCircleOutlined /> },
      ready: { color: 'green', text: 'Готов', icon: <CheckCircleOutlined /> },
              completed: { color: 'success', text: 'Выполнен', icon: <CheckCircleOutlined /> },
      cancelled: { color: 'red', text: 'Отменён', icon: <ExclamationCircleOutlined /> }
    };
    return statusMap[status as keyof typeof statusMap] || { color: 'default', text: status, icon: <ClockCircleOutlined /> };
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

  // Calculate order statistics
  const calculateStats = () => {
    if (!order?.items) return { totalQuantity: 0, totalReserved: 0, totalNeedProduction: 0 };

    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReserved = order.items.reduce((sum, item) => sum + item.reservedQuantity, 0);
    
    // Исправленная логика: К производству = товары, которых не хватает и которые еще не в производстве
    const totalNeedProduction = order.items.reduce((sum, item) => {
      const availableStock = item.product?.stock?.availableStock || 0;
      const inProduction = item.product?.stock?.inProductionQuantity || 0;
      const needed = Math.max(0, item.quantity - item.reservedQuantity);
      const stillNeed = Math.max(0, needed - inProduction);
      return sum + stillNeed;
    }, 0);

    return { totalQuantity, totalReserved, totalNeedProduction };
  };

  // Анализ статуса готовности заказа
  const getOrderReadinessStatus = () => {
    if (!order?.items) return { status: 'unknown', color: '#d9d9d9', text: 'Неизвестно' };

    let allAvailable = true;
    let anyInProduction = false;
    let anyOutOfStock = false;
    
    for (const item of order.items) {
      const product = item.product;
      if (!product?.stock) continue;

      const { availableStock, inProductionQuantity, currentStock, reservedStock } = product.stock;
      const generallyAvailable = availableStock || (currentStock - Number(reservedStock || 0));
      const inProduction = Number(inProductionQuantity || 0);
      
      // ИСПРАВЛЕННАЯ ЛОГИКА: учитываем резерв для ЭТОГО заказа
      const availableForThisOrder = generallyAvailable + (item.reservedQuantity || 0);

      if (availableForThisOrder < item.quantity) {
        allAvailable = false;
        if (inProduction > 0) {
          anyInProduction = true;
        } else {
          anyOutOfStock = true;
        }
      }
    }

    if (allAvailable) {
      return { status: 'ready', color: '#52c41a', text: '✅ Готов к отгрузке' };
    } else if (anyInProduction) {
      return { status: 'in_production', color: '#faad14', text: '🏭 В производстве' };
    } else if (anyOutOfStock) {
      return { status: 'need_production', color: '#ff4d4f', text: '⚠️ Требует производства' };
    } else {
      return { status: 'partial', color: '#1890ff', text: '🔄 Частично готов' };
    }
  };

  // Calculate editing total
  const calculateEditingTotal = () => {
    return editingItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  };

  // Order items table columns
  const itemColumns = [
    {
      title: 'Товар',
      dataIndex: 'product',
      key: 'product',
      render: (product: any) => (
        <div>
          <Text strong>{product?.name || 'Неизвестный товар'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {product?.article} • {product?.category?.name}
          </Text>
        </div>
      ),
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      render: (quantity: number) => (
        <Text strong>{quantity} шт</Text>
      ),
    },
    {
      title: 'Статус товара',
      dataIndex: 'product',
      key: 'productStatus',
      align: 'center' as const,
      render: (product: any, record: OrderItem) => {
        if (!product?.stock) {
          return <Tag color="default">Неизвестно</Tag>;
        }

        const { currentStock, reservedStock, availableStock, inProductionQuantity } = product.stock;
        const generallyAvailable = availableStock || (currentStock - Number(reservedStock || 0));
        const inProduction = Number(inProductionQuantity || 0);
        const reserved = Number(reservedStock || 0);
        
        // ИСПРАВЛЕННАЯ ЛОГИКА: учитываем резерв для ЭТОГО заказа
        const availableForThisOrder = generallyAvailable + (record.reservedQuantity || 0);

        // Определяем статус товара
        if (generallyAvailable < 0) {
          return <Tag color="red">⚠️ Перезаказ</Tag>;
        } else if (generallyAvailable === 0 && (record.reservedQuantity || 0) === 0) {
          if (inProduction > 0) {
            return <Tag color="orange">🏭 В производстве</Tag>;
          } else {
            return <Tag color="red">❌ Нет на складе</Tag>;
          }
        } else if (availableForThisOrder < record.quantity) {
          if (inProduction > 0) {
            return <Tag color="orange">🏭 В производстве</Tag>;
          } else {
            return <Tag color="gold">⚠️ Частично в наличии</Tag>;
          }
        } else {
          return <Tag color="green">✅ В наличии</Tag>;
        }
      },
    },
    {
      title: 'Цена за ед.',
      dataIndex: 'price',
      key: 'price',
      align: 'right' as const,
      render: (price: string) => (
        <Text>{Number(price).toLocaleString()} ₽</Text>
      ),
    },
    {
      title: 'Сумма',
      key: 'total',
      align: 'right' as const,
      render: (_: any, record: OrderItem) => (
        <Text strong>{(Number(record.price) * record.quantity).toLocaleString()} ₽</Text>
      ),
    },
  ];

  // Editing items table columns
  const editingItemColumns = [
    {
      title: 'Товар',
      dataIndex: 'product',
      key: 'product',
      render: (product: any) => (
        <div>
          <Text strong>{product?.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {product?.article}
          </Text>
        </div>
      ),
    },
    {
      title: 'Количество',
      key: 'quantity',
      align: 'center' as const,
      render: (_: any, record: OrderItem) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={(value) => updateOrderItem(record.id, 'quantity', value || 1)}
          size="small"
        />
      ),
    },
    {
      title: 'Цена за ед.',
      key: 'price',
      align: 'right' as const,
      render: (_: any, record: OrderItem) => (
        <InputNumber
          min={0}
          step={0.01}
          value={Number(record.price)}
          onChange={(value) => updateOrderItem(record.id, 'price', value || 0)}
          size="small"
          formatter={value => `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => Number(value!.replace(/₽\s?|(,*)/g, ''))}
        />
      ),
    },
    {
      title: 'Сумма',
      key: 'total',
      align: 'right' as const,
      render: (_: any, record: OrderItem) => (
        <Text strong>{(Number(record.price) * record.quantity).toLocaleString()} ₽</Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: OrderItem) => (
        <Popconfirm
          title="Удалить товар из заказа?"
          onConfirm={() => removeProductFromOrder(record.id)}
          okText="Да"
          cancelText="Нет"
        >
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            size="small"
          />
        </Popconfirm>
      ),
    },
  ];

  // Filter products for modal
  const filteredProducts = products.filter(product =>
    !searchText || 
    product.name.toLowerCase().includes(searchText.toLowerCase()) ||
    product.article?.toLowerCase().includes(searchText.toLowerCase())
  );

  if (loading || !order) {
    return (
      <Card loading={loading}>
        <div>Загрузка заказа...</div>
      </Card>
    );
  }

  const statusInfo = getStatusInfo(order.status);
  const priorityInfo = getPriorityInfo(order.priority);
  const stats = calculateStats();
  const readinessStatus = getOrderReadinessStatus();

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space style={{ marginBottom: 16 }}>
                <Button 
                  icon={<ArrowLeftOutlined />} 
                  onClick={() => navigate('/orders')}
                >
                  Назад к заказам
                </Button>
              </Space>
              
              <Space align="center">
                <ShoppingCartOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <div>
                  <Title level={2} style={{ margin: 0 }}>
                    Заказ {order.orderNumber}
                  </Title>
                  <Space>
                    <Tag color={statusInfo.color} icon={statusInfo.icon}>
                      {statusInfo.text}
                    </Tag>
                    <Tag color={priorityInfo.color}>
                      {priorityInfo.text}
                    </Tag>
                    <Text type="secondary">
                      Создан {dayjs(order.createdAt).format('DD.MM.YYYY в HH:mm')}
                    </Text>
                  </Space>
                </div>
              </Space>
            </Col>

            <Col>
              <Space>
                <Button 
                  icon={<MessageOutlined />}
                  onClick={() => setMessageModalVisible(true)}
                >
                  Добавить комментарий
                </Button>
                {canEditOrder() && (
                  <Button 
                    icon={<SettingOutlined />}
                    onClick={openEditModal}
                  >
                    Редактировать заказ
                  </Button>
                )}
                <Button 
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setStatusModalVisible(true);
                    statusForm.setFieldsValue({ status: order.status });
                  }}
                >
                  Изменить статус
                </Button>
                {canEditOrder() && (user?.role === 'manager' || user?.role === 'director') && (
                  <Button 
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleDeleteOrder}
                  >
                    Удалить заказ
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Col>

        {/* Order Information */}
        <Col span={24}>
          <Card title="Информация о заказе">
            <Row gutter={24}>
              <Col span={12}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Клиент" span={1}>
                    <Text strong>{order.customerName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Контакт" span={1}>
                    {order.customerContact ? (
                      <Space>
                        <PhoneOutlined />
                        <Text>{order.customerContact}</Text>
                      </Space>
                    ) : (
                      <Text type="secondary">Не указан</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Менеджер" span={1}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <Text>{order.manager?.fullName || order.manager?.username}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Дата поставки" span={1}>
                    {order.deliveryDate ? (
                      <Space>
                        <CalendarOutlined />
                        <Text>{dayjs(order.deliveryDate).format('DD.MM.YYYY')}</Text>
                      </Space>
                    ) : (
                      <Text type="secondary">Не указана</Text>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col span={12}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Общая сумма"
                      value={Number(order.totalAmount)}
                      prefix={<DollarOutlined />}
                      suffix="₽"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Позиций в заказе"
                      value={order.items?.length || 0}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                </Row>

                <Divider style={{ margin: '16px 0' }} />

                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary">Общее количество</Text>
                      <br />
                      <Text strong style={{ fontSize: '16px' }}>{stats.totalQuantity} шт</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary">Готовность заказа</Text>
                      <br />
                      <Tag 
                        color={readinessStatus.color} 
                        style={{ fontSize: '14px', padding: '4px 8px' }}
                      >
                        {readinessStatus.text}
                      </Tag>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>

            {order.notes && (
              <>
                <Divider />
                <div>
                  <Text strong>Примечания:</Text>
                  <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                    {order.notes}
                  </Paragraph>
                </div>
              </>
            )}
          </Card>
        </Col>

        {/* Order Items */}
        <Col span={24}>
          <Card title="Товары в заказе">
            <Table
              columns={itemColumns}
              dataSource={order.items || []}
              rowKey="id"
              pagination={false}
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>

        {/* Order History/Messages */}
        <Col span={24}>
          <Card title="История заказа">
            {order.messages && order.messages.length > 0 ? (
              <Timeline>
                {order.messages.map((msg: OrderMessage) => (
                  <Timeline.Item key={msg.id}>
                    <div>
                      <Space>
                        <Avatar size="small" icon={<UserOutlined />} />
                        <Text strong>{msg.user?.fullName || msg.user?.username}</Text>
                        <Text type="secondary">
                          {dayjs(msg.createdAt).format('DD.MM.YYYY в HH:mm')}
                        </Text>
                      </Space>
                      <div style={{ marginTop: 8 }}>
                        <Text>{msg.message}</Text>
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">Комментарии к заказу отсутствуют</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Status Change Modal */}
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
          onFinish={handleStatusChange}
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
              <Option value="ready">Готов</Option>
                              <Option value="completed">Выполнен</Option>
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

      {/* Add Message Modal */}
      <Modal
        title="Добавить комментарий к заказу"
        open={messageModalVisible}
        onCancel={() => setMessageModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={messageForm}
          layout="vertical"
          onFinish={handleAddMessage}
        >
          <Form.Item
            name="message"
            label="Сообщение"
            rules={[{ required: true, message: 'Введите сообщение' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="Ваш комментарий к заказу..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setMessageModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                Добавить комментарий
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Order Modal */}
      <Modal
        title="Редактирование заказа"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={1000}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditOrder}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerName"
                label="Клиент"
                rules={[{ required: true, message: 'Введите имя клиента' }]}
              >
                <Input placeholder="Имя клиента" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerContact"
                label="Контакт"
              >
                <Input placeholder="Телефон или email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="deliveryDate"
                label="Дата поставки"
              >
                <DatePicker style={{ width: '100%' }} placeholder="Выберите дату" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="Приоритет"
              >
                <Select placeholder="Выберите приоритет">
                  <Option value="low">Низкий</Option>
                  <Option value="normal">Обычный</Option>
                  <Option value="high">Высокий</Option>
                  <Option value="urgent">Срочный</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="managerId"
                label="Менеджер"
              >
                <Select placeholder="Выберите менеджера" disabled={user?.role !== 'director'}>
                  {users.map(u => (
                    <Option key={u.id} value={u.id}>
                      {u.fullName || u.username} ({u.role === 'manager' ? 'Менеджер' : 'Директор'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Примечания"
          >
            <TextArea rows={3} placeholder="Примечания к заказу..." />
          </Form.Item>

          <Divider>Товары в заказе</Divider>

          <div style={{ marginBottom: 16 }}>
            <Button 
              type="dashed" 
              icon={<PlusOutlined />}
              onClick={() => setProductModalVisible(true)}
            >
              Добавить товар
            </Button>
            <div style={{ float: 'right' }}>
              <Text strong>
                Общая сумма: {calculateEditingTotal().toLocaleString()} ₽
              </Text>
            </div>
          </div>

          <Table
            columns={editingItemColumns}
            dataSource={editingItems}
            rowKey="id"
            pagination={false}
            scroll={{ x: 600 }}
            size="small"
          />

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setEditModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                Сохранить изменения
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Product Selection Modal */}
      <Modal
        title="Выбор товара"
        open={productModalVisible}
        onCancel={() => setProductModalVisible(false)}
        footer={null}
        width={800}
      >
        <Input
          placeholder="Поиск товара..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredProducts.map(product => (
            <Card 
              key={product.id}
              size="small"
              style={{ marginBottom: 8 }}
              onClick={() => addProductToOrder(product)}
              hoverable
            >
              <Row align="middle">
                <Col span={16}>
                  <Text strong>{product.name}</Text>
                  <br />
                  <Text type="secondary">{product.article}</Text>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text>{Number(product.price).toLocaleString()} ₽</Text>
                  <br />
                  <Text type="secondary">
                    Остаток: {product.availableStock || 0} шт
                  </Text>
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetail; 