import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Button, Space, Divider, Tag, Table, Statistic,
  Form, Input, InputNumber, Select, Modal, message, Spin, Badge, Descriptions
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, SaveOutlined, CloseOutlined,
  ShoppingCartOutlined, HistoryOutlined, InboxOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { catalogApi, Product, Category } from '../services/catalogApi';
import { stockApi, StockMovement } from '../services/stockApi';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<{id: number; fullName?: string; username: string; role: string}[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [editForm] = Form.useForm();

  // Загрузка данных товара
  useEffect(() => {
    if (id && token) {
      loadProductData();
    }
  }, [id, token]);

  const loadProductData = async () => {
    if (!id || !token) return;
    
    setLoading(true);
    try {
      // Загружаем данные товара, категории, пользователей и историю движений параллельно
      const [productResponse, categoriesResponse, usersResponse, movementsResponse] = await Promise.all([
        catalogApi.getProduct(parseInt(id)),
        catalogApi.getCategories(),
        catalogApi.getUsers(),
                  stockApi.getStockMovements(parseInt(id))
      ]);

      if (productResponse.success) {
        setProduct(productResponse.data);
      } else {
        message.error('Товар не найден');
        navigate('/catalog');
        return;
      }

      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data);
      }

      if (usersResponse.success) {
        setUsers(usersResponse.data);
      }

      if (movementsResponse.success) {
        setStockMovements(movementsResponse.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных товара:', error);
      message.error('Ошибка загрузки данных товара');
      navigate('/catalog');
    } finally {
      setLoading(false);
    }
  };

  // Обработка редактирования товара
  const handleEdit = () => {
    if (!product) return;

    editForm.setFieldsValue({
      name: product.name,
      article: product.article,
      categoryId: product.categoryId,
      managerId: product.managerId,
      length: product.dimensions?.length,
      width: product.dimensions?.width,
      thickness: product.dimensions?.thickness,
      surface: product.characteristics?.surface,
      material: product.characteristics?.material,
      price: product.price,
      normStock: product.normStock,
      notes: product.notes
    });
    
    setEditModalVisible(true);
  };

  // Сохранение изменений
  const handleSave = async (values: any) => {
    if (!product || !token) return;

    try {
      const updateData = {
        name: values.name,
        article: values.article,
        categoryId: values.categoryId,
        managerId: values.managerId,
        dimensions: {
          length: values.length || 0,
          width: values.width || 0,
          thickness: values.thickness || 0
        },
        characteristics: {
          surface: values.surface,
          material: values.material
        },
        price: values.price,
        normStock: values.normStock,
        notes: values.notes
      };

      const response = await catalogApi.updateProduct(product.id, updateData);
      
      if (response.success) {
        message.success('Товар успешно обновлен');
        setEditModalVisible(false);
        loadProductData(); // Перезагружаем данные
      } else {
        message.error('Ошибка обновления товара');
      }
    } catch (error) {
      console.error('Ошибка обновления товара:', error);
      message.error('Ошибка связи с сервером');
    }
  };

  // Получение статуса остатков
  const getStockStatus = (available: number, norm: number) => {
    if (available < 0) return { status: 'negative', color: 'red', text: 'Перезаказ' };
    if (available <= 0) return { status: 'critical', color: 'red', text: 'Закончился' };
    if (available < norm * 0.5) return { status: 'low', color: 'orange', text: 'Мало' };
    return { status: 'normal', color: 'green', text: 'В наличии' };
  };

  // Плоский список категорий для селектора
  const flatCategories = (categories: Category[]): Category[] => {
    let result: Category[] = [];
    categories.forEach(category => {
      result.push(category);
      if (category.children) {
        result = result.concat(flatCategories(category.children));
      }
    });
    return result;
  };

  // Колонки таблицы движений
  const movementColumns = [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <div>
          <Text strong>{new Date(date).toLocaleDateString('ru-RU')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </div>
      )
    },
    {
      title: 'Операция',
      dataIndex: 'movementType',
      key: 'movementType',
      width: 150,
      render: (type: string) => {
        const types: Record<string, { text: string; color: string }> = {
          'incoming': { text: 'Поступление', color: 'green' },
          'outgoing': { text: 'Отгрузка', color: 'red' },
          'reservation': { text: 'Резерв', color: 'purple' },
          'release_reservation': { text: 'Снятие резерва', color: 'cyan' },
          'adjustment': { text: 'Корректировка', color: 'gold' }
        };
        const typeInfo = types[type] || { text: type, color: 'default' };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      }
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center' as const,
      render: (quantity: number) => (
        <Text strong style={{ color: quantity > 0 ? '#52c41a' : '#ff4d4f' }}>
          {quantity > 0 ? '+' : ''}{quantity} шт
        </Text>
      )
    },
    {
      title: 'Пользователь',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (userName: string) => <Text>{userName || 'Система'}</Text>
    },
    {
      title: 'Комментарий',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (comment: string) => comment || '—'
    }
  ];

  const canEdit = user?.role === 'director' || user?.role === 'manager';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Загружаем данные товара...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
        <div style={{ marginTop: 16 }}>Товар не найден</div>
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/catalog')}>
          Вернуться к каталогу
        </Button>
      </div>
    );
  }

  const dimensions = product.dimensions || { length: 0, width: 0, thickness: 0 };
  const available = product.currentStock - product.reservedStock;
  const stockStatus = getStockStatus(available, product.normStock);

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <Space style={{ marginBottom: 16 }}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/catalog')}
            >
              Назад к каталогу
            </Button>
          </Space>
          
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0 }}>
                {product.name}
              </Title>
              <Space style={{ marginTop: 8 }}>
                <Tag>{product.article}</Tag>
                <Tag color="blue">
                  {dimensions.length}×{dimensions.width}×{dimensions.thickness} мм
                </Tag>
                <Badge 
                  color={stockStatus.color} 
                  text={stockStatus.text}
                />
              </Space>
            </Col>
            
            {canEdit && (
              <Col>
                <Button 
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                >
                  Редактировать товар
                </Button>
              </Col>
            )}
          </Row>
        </Col>

        {/* Основная информация */}
        <Col span={24}>
          <Row gutter={16}>
            {/* Информация о товаре */}
            <Col xs={24} lg={16}>
              <Card title="📋 Информация о товаре">
                <Descriptions column={2} bordered>
                  <Descriptions.Item label="Название" span={2}>
                    <Text strong>{product.name}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="Артикул">
                    {product.article || 'Не указан'}
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="Категория">
                    {product.categoryName}
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="Длина">
                    {dimensions.length} мм
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="Ширина">
                    {dimensions.width} мм
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="Толщина">
                    {dimensions.thickness} мм
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="Норма остатка">
                    {product.normStock} шт
                  </Descriptions.Item>
                  
                  {product.characteristics?.surface && (
                    <Descriptions.Item label="Поверхность">
                      {product.characteristics.surface}
                    </Descriptions.Item>
                  )}
                  
                  {product.characteristics?.material && (
                    <Descriptions.Item label="Материал">
                      {product.characteristics.material}
                    </Descriptions.Item>
                  )}
                  
                  <Descriptions.Item label="Цена" span={2}>
                    <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                      {product.price ? `${product.price.toLocaleString()}₽` : 'Не указана'}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>

                {product.notes && (
                  <>
                    <Divider />
                    <div>
                      <Text strong>Примечания:</Text>
                      <Paragraph style={{ marginTop: 8 }}>
                        {product.notes}
                      </Paragraph>
                    </div>
                  </>
                )}
              </Card>
            </Col>

            {/* Остатки и статистика */}
            <Col xs={24} lg={8}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Текущие остатки */}
                <Card title="📦 Остатки на складе">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic
                        title="Текущий остаток"
                        value={product.currentStock}
                        suffix="шт"
                        valueStyle={{ fontSize: 20 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="В резерве"
                        value={product.reservedStock}
                        suffix="шт"
                        valueStyle={{ fontSize: 20, color: '#faad14' }}
                      />
                    </Col>
                  </Row>
                  
                  <Divider style={{ margin: '16px 0' }} />
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic
                        title="Доступно к продаже"
                        value={available}
                        suffix="шт"
                        valueStyle={{ 
                          fontSize: 20, 
                          color: available < 0 ? '#ff4d4f' : available > 0 ? '#52c41a' : '#faad14',
                          fontWeight: 'bold'
                        }}
                        prefix={available < 0 ? '⚠️' : available > 0 ? '✅' : '⚡'}
                      />
                      {available < 0 && (
                        <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                          Требуется к производству: {Math.abs(available)} шт
                        </Text>
                      )}
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="К производству"
                        value={product.inProductionQuantity || 0}
                        suffix="шт"
                        valueStyle={{ 
                          fontSize: 20,
                          color: '#1890ff'
                        }}
                        prefix="🏭"
                      />
                    </Col>
                  </Row>
                </Card>


              </Space>
            </Col>
          </Row>
        </Col>

        {/* История движений */}
        <Col span={24}>
          <Card title="📈 Последние движения остатков" size="small">
            <Table
              columns={movementColumns}
              dataSource={showAllMovements ? stockMovements : stockMovements.slice(0, 10)}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{
                emptyText: 'Нет движений по товару'
              }}
            />
            {stockMovements.length > 10 && !showAllMovements && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button 
                  size="small"
                  onClick={() => setShowAllMovements(true)}
                >
                  Показать все {stockMovements.length} записей
                </Button>
              </div>
            )}
            {showAllMovements && stockMovements.length > 10 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button 
                  size="small"
                  onClick={() => setShowAllMovements(false)}
                >
                  Скрыть ({stockMovements.length - 10} записей)
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Модальное окно редактирования */}
      <Modal
        title="Редактирование товара"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSave}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Название товара"
                rules={[
                  { required: true, message: 'Введите название товара' },
                  { min: 2, message: 'Минимум 2 символа' }
                ]}
              >
                <Input placeholder="Название товара" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="article"
                label="Артикул"
              >
                <Input placeholder="Автоматически" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="categoryId"
                label="Категория"
                rules={[{ required: true, message: 'Выберите категорию' }]}
              >
                <Select placeholder="Выберите категорию">
                  {flatCategories(categories).map(category => (
                    <Option key={category.id} value={category.id}>
                      📁 {category.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="managerId"
                label="Ответственный за товар"
              >
                <Select placeholder="Выберите ответственного пользователя" allowClear>
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>
                      {user.fullName || user.username} ({user.role === 'manager' ? 'Менеджер' : user.role === 'director' ? 'Директор' : user.role})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="length" label="Длина (мм)">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="width" label="Ширина (мм)">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="thickness" label="Толщина (мм)">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="surface" label="Поверхность">
                <Select placeholder="Выберите поверхность" allowClear>
                  <Option value="гладкая">Гладкая</Option>
                  <Option value="рифленая">Рифленая</Option>
                  <Option value="с узором">С узором</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="material" label="Материал">
                <Select placeholder="Выберите материал" allowClear>
                  <Option value="резина">Резина</Option>
                  <Option value="ПВХ">ПВХ</Option>
                  <Option value="полиуретан">Полиуретан</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="price" label="Цена продажи (₽)">
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="normStock" label="Норма остатка">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Примечания">
            <TextArea 
              rows={3}
              placeholder="Дополнительная информация о товаре..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button 
                icon={<CloseOutlined />}
                onClick={() => setEditModalVisible(false)}
              >
                Отмена
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                icon={<SaveOutlined />}
              >
                Сохранить изменения
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductDetail; 