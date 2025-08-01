import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Form, Input, DatePicker, Select, Button, Table, Space, Typography,
  message, InputNumber, Modal, Tag, Divider, Statistic, Steps
} from 'antd';
import {
  ShoppingCartOutlined, PlusOutlined, DeleteOutlined, CheckOutlined,
  ExclamationCircleOutlined, SearchOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import usePermissions from '../hooks/usePermissions';
import { ordersApi, CreateOrderRequest } from '../services/ordersApi';
import { catalogApi, Product } from '../services/catalogApi';
import { usersApi } from '../services/usersApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

interface OrderItemForm {
  id: string;
  productId: number;
  product?: Product;
  quantity: number;
  price: number;
  total: number;
  availableStock: number;
  canReserve: number;
}

interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
}

const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { canManage, canEdit } = usePermissions();

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      'director': 'Директор',
      'manager': 'Менеджер', 
      'production': 'Производство',
      'warehouse': 'Склад'
    };
    return roleNames[role] || role;
  };
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSource, setSelectedSource] = useState('database');
  
  // Modal states
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // Load products and users for selection
  useEffect(() => {
    loadProducts();
    loadUsers();
  }, []);

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
          (u: User) => canManage('orders') || canEdit('orders')
        );
        setUsers(availableUsers);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  // Filter products for modal
  const filteredProducts = products.filter(product =>
    !searchText || 
    product.name.toLowerCase().includes(searchText.toLowerCase()) ||
    product.article?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Add product to order
  const addProduct = (product: Product) => {
    const existing = orderItems.find(item => item.productId === product.id);
    if (existing) {
      message.warning('Товар уже добавлен в заказ');
      return;
    }

    const newItem: OrderItemForm = {
      id: `${Date.now()}-${product.id}`,
      productId: product.id,
      product,
      quantity: 1,
      price: Number(product.price) || 0,
      total: Number(product.price) || 0,
      availableStock: product.availableStock || 0,
      canReserve: Math.min(1, product.availableStock || 0)
    };

    setOrderItems([...orderItems, newItem]);
    setProductModalVisible(false);
    setSearchText('');
  };

  // Update order item
  const updateOrderItem = (id: string, field: string, value: any) => {
    setOrderItems(items => 
      items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          
          if (field === 'quantity' || field === 'price') {
            updated.total = updated.quantity * updated.price;
            updated.canReserve = Math.min(updated.quantity, item.availableStock);
          }
          
          return updated;
        }
        return item;
      })
    );
  };

  // Remove order item
  const removeOrderItem = (id: string) => {
    setOrderItems(items => items.filter(item => item.id !== id));
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);
    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalCanReserve = orderItems.reduce((sum, item) => sum + item.canReserve, 0);
    const totalNeedProduction = orderItems.reduce((sum, item) => 
      sum + Math.max(0, item.quantity - item.availableStock), 0
    );

    return { totalAmount, totalQuantity, totalCanReserve, totalNeedProduction };
  };

  // Submit order
  const handleSubmit = async (values: any) => {
    if (orderItems.length === 0) {
      message.error('Добавьте товары в заказ');
      return;
    }

    setConfirmModalVisible(true);
  };

  const confirmOrder = async () => {
    if (!token) return;

    const values = form.getFieldsValue();
    
    const orderData: CreateOrderRequest = {
      customerName: values.customerName,
      customerContact: values.customerContact,
      deliveryDate: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
      priority: values.priority || 'normal',
      source: values.source || 'database',
      customSource: values.source === 'other' ? values.customSource : undefined,
      notes: values.notes,
      managerId: values.managerId, // Добавляем назначенного менеджера
      items: orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      }))
    };

    setLoading(true);
    try {
      const response = await ordersApi.createOrder(orderData);
      
      if (response.success) {
        message.success('Заказ успешно создан');
        navigate(`/orders/${response.data.id}`);
      } else {
        message.error('Ошибка создания заказа');
      }
    } catch (error) {
      console.error('Ошибка создания заказа:', error);
      message.error('Ошибка связи с сервером');
    } finally {
      setLoading(false);
      setConfirmModalVisible(false);
    }
  };

  // Table columns for order items
  const orderItemColumns = [
    {
      title: 'Товар',
      dataIndex: 'product',
      key: 'product',
      render: (product: Product) => (
        <div>
          <Text strong>{product.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {product.article} • {product.categoryName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Остаток',
      dataIndex: 'availableStock',
      key: 'availableStock',
      align: 'center' as const,
      render: (stock: number) => (
        <Tag color={stock > 0 ? 'green' : 'red'}>
          {stock} шт
        </Tag>
      ),
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      render: (quantity: number, record: OrderItemForm) => (
        <InputNumber
          min={1}
          value={quantity}
          onChange={(value) => updateOrderItem(record.id, 'quantity', value || 1)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      align: 'center' as const,
      render: (price: number, record: OrderItemForm) => (
        <InputNumber
          min={0}
          precision={2}
          value={price}
          onChange={(value) => updateOrderItem(record.id, 'price', value || 0)}
          style={{ width: 100 }}
          addonAfter="₽"
        />
      ),
    },
    {
      title: 'Резерв',
      dataIndex: 'canReserve',
      key: 'canReserve',
      align: 'center' as const,
      render: (canReserve: number, record: OrderItemForm) => {
        const needProduction = Math.max(0, record.quantity - record.availableStock);
        return (
          <div>
            <Tag color="blue">{canReserve} шт</Tag>
            {needProduction > 0 && (
              <>
                <br />
                <Tag color="orange">+{needProduction} произв.</Tag>
              </>
            )}
          </div>
        );
      },
    },
    {
      title: 'Сумма',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (total: number) => (
        <Text strong>{total.toLocaleString()} ₽</Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: OrderItemForm) => (
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => removeOrderItem(record.id)}
          danger
        />
      ),
    },
  ];

  // Product selection table columns
  const productColumns = [
    {
      title: 'Товар',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Product) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.article} • {record.categoryName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Остаток',
      dataIndex: 'availableStock',
      key: 'availableStock',
      align: 'center' as const,
      render: (stock: number) => (
        <Tag color={stock > 0 ? 'green' : 'red'}>
          {stock || 0} шт
        </Tag>
      ),
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      align: 'right' as const,
      render: (price: string) => (
        <Text>{Number(price).toLocaleString()} ₽</Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: Product) => (
        <Button
          type="primary"
          size="small"
          onClick={() => addProduct(record)}
        >
          Добавить
        </Button>
      ),
    },
  ];

  const totals = calculateTotals();

  const steps = [
    { title: 'Информация о заказе', description: 'Основные данные' },
    { title: 'Товары', description: 'Выбор и настройка' },
    { title: 'Подтверждение', description: 'Проверка и создание' }
  ];

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <Space style={{ marginBottom: 16 }}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/orders')}
            >
              Назад к заказам
            </Button>
          </Space>
          
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <ShoppingCartOutlined style={{ marginRight: 12 }} />
            Создание заказа
          </Title>
        </Col>

        {/* Steps */}
        <Col span={24}>
          <Card>
            <Steps current={currentStep} items={steps} />
          </Card>
        </Col>

        {/* Form */}
        <Col span={24}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                priority: 'normal',
                source: 'database'
              }}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="customerName"
                    label="Название клиента"
                    rules={[{ required: true, message: 'Введите название клиента' }]}
                  >
                    <Input placeholder="ООО Ромашка" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="customerContact"
                    label="Контактные данные"
                  >
                    <Input placeholder="+7 (999) 123-45-67" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="source"
                    label="Источник заказа"
                    rules={[{ required: true, message: 'Выберите источник заказа' }]}
                    initialValue="database"
                  >
                    <Select 
                      placeholder="Выберите источник заказа"
                      onChange={(value) => {
                        setSelectedSource(value);
                        if (value !== 'other') {
                          form.setFieldValue('customSource', '');
                        }
                      }}
                    >
                      <Option value="database">Из базы клиентов</Option>
                      <Option value="website">С сайта</Option>
                      <Option value="avito">С Авито</Option>
                      <Option value="referral">По рекомендации</Option>
                      <Option value="cold_call">Холодные звонки</Option>
                      <Option value="other">Другое</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="customSource"
                    label="Описание источника"
                    rules={[
                      {
                        required: false,
                        validator: (_, value) => {
                          if (selectedSource === 'other' && (!value || value.trim() === '')) {
                            return Promise.reject(new Error('Укажите описание источника'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                    dependencies={['source']}
                  >
                    <Input 
                      placeholder="Укажите источник заказа" 
                      disabled={selectedSource !== 'other'}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={6}>
                  <Form.Item
                    name="deliveryDate"
                    label="Дата поставки"
                  >
                    <DatePicker 
                      style={{ width: '100%' }}
                      placeholder="Выберите дату"
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="priority"
                    label="Приоритет"
                  >
                    <Select>
                      <Option value="low">Низкий</Option>
                      <Option value="normal">Обычный</Option>
                      <Option value="high">Высокий</Option>
                      <Option value="urgent">Срочный</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="managerId"
                    label="Менеджер"
                    initialValue={user?.id}
                  >
                    <Select placeholder="Выберите менеджера">
                      {users.map(u => (
                        <Option key={u.id} value={u.id}>
                          {u.fullName || u.username} ({getRoleDisplayName(u.role)})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <div style={{ paddingTop: 30 }}>
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => setProductModalVisible(true)}
                      size="large"
                      style={{ width: '100%' }}
                    >
                      Добавить товар
                    </Button>
                  </div>
                </Col>
              </Row>

              <Row>
                <Col span={24}>
                  <Form.Item
                    name="notes"
                    label="Примечания к заказу"
                  >
                    <TextArea rows={3} placeholder="Дополнительная информация..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* Order Items */}
        {orderItems.length > 0 && (
          <Col span={24}>
            <Card title="Товары в заказе">
              <Table
                columns={orderItemColumns}
                dataSource={orderItems}
                rowKey="id"
                pagination={false}
                scroll={{ x: 800 }}
              />
              
              <Divider />
              
              {/* Totals */}
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Количество позиций"
                    value={orderItems.length}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Общее количество"
                    value={totals.totalQuantity}
                    suffix="шт"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Можно зарезервировать"
                    value={totals.totalCanReserve}
                    suffix="шт"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Требует производства"
                    value={totals.totalNeedProduction}
                    suffix="шт"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
              </Row>
              
              <Divider />
              
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={3} style={{ margin: 0 }}>
                    Общая сумма: {totals.totalAmount.toLocaleString()} ₽
                  </Title>
                </Col>
                <Col>
                  <Space>
                    <Button onClick={() => navigate('/orders')}>
                      Отмена
                    </Button>
                    <Button 
                      type="primary" 
                      size="large"
                      onClick={handleSubmit}
                      icon={<CheckOutlined />}
                    >
                      Создать заказ
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>
        )}
      </Row>

      {/* Product Selection Modal */}
      <Modal
        title="Выбор товаров"
        open={productModalVisible}
        onCancel={() => setProductModalVisible(false)}
        footer={null}
        width={1000}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="Поиск товаров..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          
          <Table
            columns={productColumns}
            dataSource={filteredProducts}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 600 }}
          />
        </Space>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        title="Подтверждение создания заказа"
        open={confirmModalVisible}
        onOk={confirmOrder}
        onCancel={() => setConfirmModalVisible(false)}
        okText="Создать заказ"
        cancelText="Отмена"
        confirmLoading={loading}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Общая сумма"
                value={totals.totalAmount}
                suffix="₽"
                valueStyle={{ fontSize: '24px', color: '#1890ff' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Количество товаров"
                value={totals.totalQuantity}
                suffix="шт"
                valueStyle={{ fontSize: '24px', color: '#1890ff' }}
              />
            </Col>
          </Row>
          
          <Divider />
          
          <Space direction="vertical" style={{ width: '100%' }}>
            {totals.totalCanReserve > 0 && (
              <Text>
                <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                Будет зарезервировано: <strong>{totals.totalCanReserve} шт</strong>
              </Text>
            )}
            
            {totals.totalNeedProduction > 0 && (
              <Text>
                <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Требует производства: <strong>{totals.totalNeedProduction} шт</strong>
              </Text>
            )}
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default CreateOrder; 