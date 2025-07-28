import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Button, Space, Divider, Tag, Table, Statistic,
  Form, Input, InputNumber, Select, Modal, Spin, Badge, Descriptions,
  List, Avatar, App
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, SaveOutlined, CloseOutlined,
  ShoppingCartOutlined, HistoryOutlined, InboxOutlined, FileTextOutlined,
  SettingOutlined, PlusOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { catalogApi, Product, Category } from '../services/catalogApi';
import { surfacesApi, Surface } from '../services/surfacesApi';
import { logosApi, Logo } from '../services/logosApi';
import { materialsApi, Material } from '../services/materialsApi';
import { stockApi, StockMovement } from '../services/stockApi';
import { getOrdersByProduct } from '../services/ordersApi';
import { getProductionTasksByProduct } from '../services/productionApi';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { message } = App.useApp();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [users, setUsers] = useState<{id: number; fullName?: string; username: string; role: string}[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [productOrders, setProductOrders] = useState<any[]>([]);
  const [productionTasks, setProductionTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // WBS 2 - Adjustments Задача 3.1: Редактирование остатков в карточке товара
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [editStockValue, setEditStockValue] = useState<number | null>(null);
  const [stockEditLoading, setStockEditLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [creatingLogo, setCreatingLogo] = useState(false);
  const [editForm] = Form.useForm();

  // Функции для перевода статусов
  const getOrderStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'new': 'Новый',
      'confirmed': 'Подтвержден',
      'in_production': 'В производстве',
      'ready': 'Готов',
          'completed': 'Выполнен',
      'cancelled': 'Отменен'
    };
    return statusMap[status] || status;
  };

  const getTaskStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ожидает',
      'in_progress': 'В работе',
      'completed': 'Завершено',
      'cancelled': 'Отменено'
    };
    return statusMap[status] || status;
  };

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
      // Загружаем данные товара, категории, пользователей, справочники и историю движений параллельно
      const [
        productResponse,
        categoriesResponse,
        surfacesResponse,
        logosResponse,
        materialsResponse,
        usersResponse,
        movementsResponse,
        ordersResponse,
        tasksResponse
      ] = await Promise.all([
        catalogApi.getProduct(parseInt(id)),
        catalogApi.getCategories(),
        surfacesApi.getSurfaces(token),
        logosApi.getLogos(token),
        materialsApi.getMaterials(token),
        catalogApi.getUsers(),
        stockApi.getStockMovements(parseInt(id)),
        getOrdersByProduct(parseInt(id)),
        getProductionTasksByProduct(parseInt(id))
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

      if (surfacesResponse.success) {
        setSurfaces(surfacesResponse.data);
      }

      if (logosResponse.success) {
        setLogos(logosResponse.data);
      }

      if (materialsResponse.success) {
        setMaterials(materialsResponse.data);
      }

      if (usersResponse.success) {
        setUsers(usersResponse.data);
      }

      if (movementsResponse.success) {
        setStockMovements(movementsResponse.data);
      }

      if (ordersResponse.success) {
        // Фильтруем только активные заказы (не завершенные и не отмененные)
        const activeOrders = ordersResponse.data.filter((order: any) => 
          ['new', 'confirmed', 'in_production'].includes(order.status)
        );
        setProductOrders(activeOrders);
      }

      if (tasksResponse.success) {
        // Фильтруем только активные задания (не завершенные и не отмененные)
        const activeTasks = tasksResponse.data.filter((task: any) => 
          ['pending', 'in_progress'].includes(task.status)
        );
        setProductionTasks(activeTasks);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных товара:', error);
      message.error('Ошибка загрузки данных товара');
      navigate('/catalog');
    } finally {
      setLoading(false);
    }
  };

  // Создание нового логотипа
  const createNewLogo = async () => {
    if (!token || !newLogoName.trim()) {
      message.error('Введите название логотипа');
      return;
    }

    setCreatingLogo(true);
    try {
      const response = await logosApi.createLogo({
        name: newLogoName.trim(),
        description: `Пользовательский логотип: ${newLogoName.trim()}`
      }, token);

      if (response.success) {
        // Добавляем новый логотип в список
        setLogos(prev => [...prev, response.data]);
        // Устанавливаем его в форме
        editForm.setFieldsValue({ logoId: response.data.id });
        setNewLogoName('');
        message.success('Логотип успешно создан');
      }
    } catch (error: any) {
      console.error('Ошибка создания логотипа:', error);
      message.error(error.response?.data?.error?.message || 'Ошибка создания логотипа');
    } finally {
      setCreatingLogo(false);
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
      surfaceId: product.surfaceId,
      logoId: product.logoId,
      materialId: product.materialId,
      length: product.dimensions?.length,
      width: product.dimensions?.width,
      thickness: product.dimensions?.thickness,
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
        surfaceId: values.surfaceId || null,
        logoId: values.logoId || null,
        materialId: values.materialId || null,
        dimensions: {
          length: values.length || 0,
          width: values.width || 0,
          thickness: values.thickness || 0
        },
        weight: values.weight || null,
        grade: values.grade || 'usual',
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
  
  // Определяем возможность редактирования остатков (WBS 2 - Adjustments Задача 3.1)
  const canEditStock = user?.role === 'director' || user?.role === 'manager';

  // Функции для редактирования остатков (WBS 2 - Adjustments Задача 3.1)
  const startEditingStock = () => {
    const currentStock = product?.stock?.currentStock || product?.currentStock || 0;
    setEditStockValue(currentStock);
    setIsEditingStock(true);
  };

  const cancelEditingStock = () => {
    setIsEditingStock(false);
    setEditStockValue(null);
  };

  const saveStockEdit = async () => {
    if (!product || editStockValue === null || editStockValue < 0) {
      message.error('Введите корректное количество');
      return;
    }

    setStockEditLoading(true);
    try {
      const currentStock = product?.stock?.currentStock || product?.currentStock || 0;
      const adjustment = editStockValue - currentStock;
      
      if (adjustment !== 0) {
        // Используем точно такой же API как в разделе "Остатки на складе"
        const adjustmentData = {
          productId: product.id,
          adjustment: adjustment,
          comment: 'Корректировка остатка через карточку товара'
        };
        
        const response = await stockApi.adjustStock(adjustmentData);
        
        if (response.success) {
          message.success(`Остаток успешно обновлен. ${response.message || ''}`);
          
          setIsEditingStock(false);
          setEditStockValue(null);
          
          // Перезагружаем данные для синхронизации с сервером (получим актуальные резервы)
          loadProductData();
        } else {
          message.error('Ошибка обновления остатка');
        }
      } else {
        // Если изменений нет, просто закрываем редактирование
        message.info('Остаток не изменился');
        setIsEditingStock(false);
        setEditStockValue(null);
      }
    } catch (error: any) {
      console.error('Ошибка сохранения остатка:', error);
      message.error(error.response?.data?.message || 'Ошибка сохранения остатка');
    } finally {
      setStockEditLoading(false);
    }
  };

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
  const available = (product.currentStock || 0) - (product.reservedStock || 0);
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
                <Card 
                  title="📦 Остатки на складе"
                  extra={canEditStock && !isEditingStock && (
                    <Button 
                      type="text" 
                      icon={<EditOutlined />} 
                      onClick={startEditingStock}
                      size="small"
                    >
                      Редактировать
                    </Button>
                  )}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      {isEditingStock ? (
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 8 }}>
                            Текущий остаток
                          </Text>
                          <Space>
                            <InputNumber
                              value={editStockValue}
                              onChange={setEditStockValue}
                              min={0}
                              placeholder="Количество"
                              style={{ width: 120 }}
                              autoFocus
                            />
                            <span>шт</span>
                          </Space>
                          <div style={{ marginTop: 8 }}>
                            <Space size="small">
                              <Button 
                                type="primary" 
                                size="small" 
                                icon={<SaveOutlined />}
                                loading={stockEditLoading}
                                onClick={saveStockEdit}
                              >
                                Сохранить
                              </Button>
                              <Button 
                                size="small" 
                                icon={<CloseOutlined />}
                                onClick={cancelEditingStock}
                              >
                                Отмена
                              </Button>
                            </Space>
                          </div>
                        </div>
                      ) : (
                        <Statistic
                          title="Текущий остаток"
                          value={product.stock?.currentStock || product.currentStock || 0}
                          suffix="шт"
                          valueStyle={{ fontSize: 20 }}
                        />
                      )}
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

        {/* Заказы и производственные задания */}
        <Col span={24}>
          <Row gutter={16}>
            {/* Заказы где используется товар */}
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <FileTextOutlined />
                    Заказы с этим товаром
                    <Badge count={productOrders.length} showZero />
                  </Space>
                } 
                size="small"
              >
                {productOrders.length === 0 ? (
                  <Text type="secondary">Нет активных заказов с этим товаром</Text>
                ) : (
                  <List
                    size="small"
                    dataSource={productOrders}
                    renderItem={(order: any) => (
                      <List.Item 
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar 
                              style={{ 
                                backgroundColor: order.priority === 'urgent' ? '#ff4d4f' : 
                                               order.priority === 'high' ? '#faad14' : '#52c41a'
                              }}
                            >
                              {order.orderNumber}
                            </Avatar>
                          }
                          title={
                            <Space>
                              <Text strong>{order.customerName}</Text>
                              <Tag color={
                                order.status === 'new' ? 'blue' :
                                order.status === 'confirmed' ? 'green' :
                                order.status === 'in_production' ? 'orange' :
                                order.status === 'ready' ? 'purple' : 'default'
                              }>
                                {getOrderStatusText(order.status)}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <Text type="secondary">
                                Количество: {order.items?.find((item: any) => item.productId === parseInt(id!))?.quantity || 0} шт
                              </Text>
                              {order.deliveryDate && (
                                <div>
                                  <Text type="secondary">
                                    Доставка: {new Date(order.deliveryDate).toLocaleDateString('ru-RU')}
                                  </Text>
                                </div>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>

            {/* Производственные задания */}
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <SettingOutlined />
                    Производственные задания
                    <Badge count={productionTasks.length} showZero />
                  </Space>
                } 
                size="small"
              >
                {productionTasks.length === 0 ? (
                  <Text type="secondary">Нет активных производственных заданий</Text>
                ) : (
                  <List
                    size="small"
                    dataSource={productionTasks}
                    renderItem={(task: any) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <Avatar 
                              style={{ 
                                backgroundColor: task.status === 'pending' ? '#faad14' : 
                                               task.status === 'in_progress' ? '#1890ff' : 
                                               task.status === 'completed' ? '#52c41a' : '#d9d9d9'
                              }}
                            >
                              {task.priority === 'urgent' ? '🔥' : 
                               task.priority === 'high' ? '⚡' : '📋'}
                            </Avatar>
                          }
                          title={
                            <Space>
                              <Text strong>Задание #{task.id}</Text>
                              <Tag color={
                                task.status === 'pending' ? 'orange' :
                                task.status === 'in_progress' ? 'blue' :
                                task.status === 'completed' ? 'green' : 'default'
                              }>
                                {getTaskStatusText(task.status)}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <Text type="secondary">
                                Запрошено: {task.requestedQuantity} шт
                              </Text>
                              {task.order && (
                                <div>
                                  <Text type="secondary">
                                    Заказ: {task.order.orderNumber} ({task.order.customerName})
                                  </Text>
                                </div>
                              )}
                              {task.completedQuantity && (
                                <div>
                                  <Text type="secondary">
                                    Произведено: {task.completedQuantity} шт
                                  </Text>
                                </div>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
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
            <Col span={12}>
              <Form.Item
                name="weight"
                label="Вес (кг)"
              >
                <InputNumber 
                  placeholder="Например: 15.5"
                  style={{ width: '100%' }}
                  min={0}
                  precision={3}
                  step={0.1}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="grade"
                label="Сорт товара"
              >
                <Select style={{ width: '100%' }}>
                  <Option value="usual">⭐ Обычный</Option>
                  <Option value="grade_2">⚠️ Второй сорт</Option>
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
            <Col span={8}>
              <Form.Item name="surfaceId" label="Поверхность">
                <Select placeholder="Выберите поверхность" allowClear>
                  {surfaces.map(surface => (
                    <Option key={surface.id} value={surface.id}>
                      🎨 {surface.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="logoId" label="Логотип">
                <Select 
                  placeholder="Выберите логотип или создайте новый"
                  allowClear
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      {user?.role === 'director' && (
                        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                          <Input
                            placeholder="Название нового логотипа"
                            value={newLogoName}
                            onChange={(e) => setNewLogoName(e.target.value)}
                            onPressEnter={createNewLogo}
                            style={{ marginBottom: 8 }}
                          />
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={createNewLogo}
                            loading={creatingLogo}
                            disabled={!newLogoName.trim()}
                            style={{ width: '100%' }}
                          >
                            Создать новый логотип
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                >
                  {logos.map(logo => (
                    <Option key={logo.id} value={logo.id}>
                      📝 {logo.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="materialId" label="Материал">
                <Select placeholder="Выберите материал" allowClear>
                  {materials.map(material => (
                    <Option key={material.id} value={material.id}>
                      🛠️ {material.name}
                    </Option>
                  ))}
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