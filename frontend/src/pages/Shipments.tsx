import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Form, 
  Select, 
  DatePicker, 
  Input,
  message, 
  Space, 
  Tooltip, 
  Card, 
  Statistic, 
  Row, 
  Col,
  Popconfirm,
  Descriptions,
  Divider,
  Tag,
  Upload,
  Image,
  InputNumber,
  Tabs,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  TruckOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  CameraOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import shipmentsApi, { 
  Shipment, 
  Order, 
  CreateShipmentRequest, 
  UpdateShipmentStatusRequest,
  UpdateShipmentRequest
} from '../services/shipmentsApi';
import { SHIPMENT_STATUS_COLORS } from '../constants/shipmentStatuses';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

export const Shipments: React.FC = () => {
  const { user } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Модальные окна
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // Данные для модальных окон
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  
  // Формы
  const [createForm] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [editForm] = Form.useForm();
  
  // Фильтры
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  
  // Статистика
  const [statistics, setStatistics] = useState({
    total: 0,
    todayCount: 0,
    thisMonthCount: 0,
    plannedCount: 0,
    shippedCount: 0,
    deliveredCount: 0
  });

  // Загрузка данных
  useEffect(() => {
    loadData();
    loadReadyOrders();
    loadStatistics();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      if (searchText.trim()) {
        params.search = searchText.trim();
      }
      
      const data = await shipmentsApi.getShipments(params);
      setShipments(data);
    } catch (error) {
      message.error('Ошибка загрузки отгрузок');
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReadyOrders = async () => {
    try {
      const orders = await shipmentsApi.getReadyOrders();
      setReadyOrders(orders);
    } catch (error) {
      message.error('Ошибка загрузки готовых заказов');
      console.error('Error loading ready orders:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await shipmentsApi.getShipmentStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // Обновление данных при изменении фильтров
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [statusFilter, searchText]);

  // Создание отгрузки
  const handleCreateShipment = async (values: any) => {
    try {
      setActionLoading(true);
      
      const request: CreateShipmentRequest = {
        orderIds: values.orderIds,
        plannedDate: values.plannedDate ? values.plannedDate.toISOString() : undefined,
        transportInfo: values.transportInfo,
        notes: values.notes
      };
      
      await shipmentsApi.createShipment(request);
      message.success('Отгрузка создана');
      
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadReadyOrders(); // Обновляем список готовых заказов
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка создания отгрузки');
    } finally {
      setActionLoading(false);
    }
  };

  // Обновление статуса отгрузки
  const handleUpdateStatus = async (values: any) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      
      const request: UpdateShipmentStatusRequest = {
        status: values.status,
        actualQuantities: values.actualQuantities,
        transportInfo: values.transportInfo,
        documentsPhotos: values.documentsPhotos
      };
      
      await shipmentsApi.updateShipmentStatus(selectedShipment.id, request);
      message.success('Статус отгрузки обновлен');
      
      setStatusModalVisible(false);
      statusForm.resetFields();
      setSelectedShipment(null);
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка обновления статуса');
    } finally {
      setActionLoading(false);
    }
  };

  // Редактирование отгрузки
  const handleEditShipment = async (values: any) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      
      const request: UpdateShipmentRequest = {
        plannedDate: values.plannedDate ? values.plannedDate.toISOString() : undefined,
        transportInfo: values.transportInfo,
        documentsPhotos: values.documentsPhotos
      };
      
      await shipmentsApi.updateShipment(selectedShipment.id, request);
      message.success('Отгрузка обновлена');
      
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedShipment(null);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка обновления отгрузки');
    } finally {
      setActionLoading(false);
    }
  };

  // Отмена отгрузки
  const handleCancelShipment = async (shipment: Shipment) => {
    try {
      setActionLoading(true);
      await shipmentsApi.cancelShipment(shipment.id);
      message.success('Отгрузка отменена');
      loadData();
      loadReadyOrders();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка отмены отгрузки');
    } finally {
      setActionLoading(false);
    }
  };

  // Просмотр деталей отгрузки
  const handleViewDetails = async (shipment: Shipment) => {
    try {
      setLoading(true);
      const details = await shipmentsApi.getShipment(shipment.id);
      setSelectedShipment(details);
      setDetailsModalVisible(true);
    } catch (error: any) {
      message.error('Ошибка загрузки деталей отгрузки');
    } finally {
      setLoading(false);
    }
  };

  // Открытие модального окна изменения статуса
  const openStatusModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    statusForm.setFieldsValue({
      status: shipment.status,
      transportInfo: shipment.transportInfo
    });
    setStatusModalVisible(true);
  };

  // Открытие модального окна редактирования
  const openEditModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    editForm.setFieldsValue({
      plannedDate: shipment.plannedDate ? dayjs(shipment.plannedDate) : null,
      transportInfo: shipment.transportInfo,
      documentsPhotos: shipment.documentsPhotos
    });
    setEditModalVisible(true);
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Номер отгрузки',
      dataIndex: 'shipmentNumber',
      key: 'shipmentNumber',
      width: 150,
      render: (text: string, record: Shipment) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          {shipmentsApi.isOverdue(record) && (
            <Tag color="red">Просрочено</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Заказ/Клиент',
      key: 'order',
      width: 200,
      render: (record: Shipment) => (
        <div>
          {record.order ? (
            <>
              <div style={{ fontWeight: 'bold' }}>{record.order.orderNumber}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{record.order.customerName}</div>
            </>
          ) : (
            <>
              <div style={{ fontStyle: 'italic' }}>Сборная отгрузка</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {record.relatedOrders?.length || 0} заказов
              </div>
            </>
          )}
        </div>
      )
    },
    {
      title: 'Товары',
      key: 'items',
      width: 120,
      render: (record: Shipment) => {
        const summary = shipmentsApi.calculateShipmentSummary(record);
        return (
          <div>
            <div>{summary.totalItems} шт.</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {summary.totalProducts} наименований
            </div>
          </div>
        );
      }
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: Shipment['status']) => (
        <Badge 
          color={shipmentsApi.getStatusColor(status)} 
          text={shipmentsApi.getStatusText(status)} 
        />
      )
    },
    {
      title: 'Плановая дата',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      width: 120,
      render: (date: string) => shipmentsApi.formatDate(date)
    },
    {
      title: 'Фактическая дата',
      dataIndex: 'actualDate',
      key: 'actualDate',
      width: 120,
      render: (date: string) => shipmentsApi.formatDateTime(date)
    },
    {
      title: 'Создал',
      key: 'createdBy',
      width: 120,
      render: (record: Shipment) => (
        record.createdByUser ? 
          (record.createdByUser.fullName || record.createdByUser.username) : 
          '-'
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 180,
      render: (record: Shipment) => {
        const userRole = user?.role || '';
        
        return (
          <Space size="small">
            <Tooltip title="Просмотр">
              <Button 
                type="text" 
                icon={<EyeOutlined />} 
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>
            
            {(record.status === 'planned' || record.status === 'loading') && shipmentsApi.canEdit(userRole) && (
              <Tooltip title="Редактировать">
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={() => openEditModal(record)}
                />
              </Tooltip>
            )}
            
            {shipmentsApi.canUpdateStatus(userRole) && record.status !== 'delivered' && record.status !== 'cancelled' && (
              <Tooltip title="Изменить статус">
                <Button 
                  type="text" 
                  icon={<CheckCircleOutlined />} 
                  style={{ color: '#52c41a' }}
                  onClick={() => openStatusModal(record)}
                />
              </Tooltip>
            )}
            
            {record.status === 'planned' && shipmentsApi.canCancel(userRole) && (
              <Tooltip title="Отменить">
                <Popconfirm
                  title="Отменить отгрузку?"
                  description="Связанные заказы вернутся в статус готовых к отгрузке"
                  onConfirm={() => handleCancelShipment(record)}
                >
                  <Button 
                    type="text" 
                    icon={<DeleteOutlined />} 
                    danger 
                    loading={actionLoading}
                  />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, display: 'inline-flex', alignItems: 'center' }}>
          <TruckOutlined style={{ marginRight: '8px' }} />
          Система отгрузок
        </h1>
      </div>

      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic title="Всего отгрузок" value={statistics.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="За сегодня" value={statistics.todayCount} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="За месяц" value={statistics.thisMonthCount} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Запланировано" 
              value={statistics.plannedCount} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Отгружено" 
              value={statistics.shippedCount} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Доставлено" 
              value={statistics.deliveredCount} 
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Уведомление о готовых заказах */}
      {readyOrders.length > 0 && (
        <Alert
          message={`У вас есть ${readyOrders.length} готовых к отгрузке заказов`}
          description="Создайте отгрузки для готовых заказов"
          type="info"
          showIcon
          action={
            shipmentsApi.canCreate(user?.role || '') && (
              <Button size="small" onClick={() => setCreateModalVisible(true)}>
                Создать отгрузку
              </Button>
            )
          }
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* Управление */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 200 }}
          >
            <Option value="all">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d9d9d9', marginRight: '8px' }} />
                Все отгрузки
              </div>
            </Option>
            <Option value="planned">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: SHIPMENT_STATUS_COLORS.planned, marginRight: '8px' }} />
                Запланированные
              </div>
            </Option>
            <Option value="loading">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: SHIPMENT_STATUS_COLORS.loading, marginRight: '8px' }} />
                Загрузка
              </div>
            </Option>
            <Option value="shipped">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: SHIPMENT_STATUS_COLORS.shipped, marginRight: '8px' }} />
                Отгруженные
              </div>
            </Option>
            <Option value="delivered">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: SHIPMENT_STATUS_COLORS.delivered, marginRight: '8px' }} />
                Доставленные
              </div>
            </Option>
            <Option value="cancelled">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: SHIPMENT_STATUS_COLORS.cancelled, marginRight: '8px' }} />
                Отмененные
              </div>
            </Option>
          </Select>
          
          <Input.Search
            placeholder="Поиск по номеру отгрузки, заказу, клиенту..."
            style={{ width: 300 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </Space>
        
        {shipmentsApi.canCreate(user?.role || '') && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Создать отгрузку
          </Button>
        )}
      </div>

      {/* Таблица отгрузок */}
      <Table
        columns={columns}
        dataSource={shipments}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `Всего ${total} отгрузок`,
        }}
      />

      {/* Модальное окно создания отгрузки */}
      <Modal
        title="Создать отгрузку"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={actionLoading}
        width={700}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateShipment}
        >
          <Form.Item
            name="orderIds"
            label="Заказы для отгрузки"
            rules={[{ required: true, message: 'Выберите заказы для отгрузки' }]}
          >
            <Select
              mode="multiple"
              placeholder="Выберите готовые к отгрузке заказы"
              optionLabelProp="label"
            >
              {readyOrders.map(order => (
                <Option key={order.id} value={order.id} label={`${order.orderNumber} - ${order.customerName}`}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{order.orderNumber}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {order.customerName} | {order.items?.length || 0} товаров
                    </div>
                    {order.deliveryDate && (
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        Срок поставки: {shipmentsApi.formatDate(order.deliveryDate)}
                      </div>
                    )}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="plannedDate"
            label="Планируемая дата отгрузки"
          >
            <DatePicker 
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder="Выберите дату"
            />
          </Form.Item>

          <Form.Item
            name="transportInfo"
            label="Информация о транспорте"
          >
            <TextArea 
              rows={3} 
              placeholder="Номер автомобиля, водитель, маршрут..."
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Примечания"
          >
            <TextArea 
              rows={2} 
              placeholder="Дополнительная информация..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно изменения статуса */}
      <Modal
        title="Изменить статус отгрузки"
        open={statusModalVisible}
        onCancel={() => {
          setStatusModalVisible(false);
          statusForm.resetFields();
          setSelectedShipment(null);
        }}
        onOk={() => statusForm.submit()}
        confirmLoading={actionLoading}
        width={600}
      >
        {selectedShipment && (
          <>
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
              <div><strong>Отгрузка:</strong> {selectedShipment.shipmentNumber}</div>
              <div><strong>Текущий статус:</strong> 
                <Badge 
                  color={shipmentsApi.getStatusColor(selectedShipment.status)} 
                  text={shipmentsApi.getStatusText(selectedShipment.status)}
                  style={{ marginLeft: '8px' }}
                />
              </div>
            </div>
            
            <Form
              form={statusForm}
              layout="vertical"
              onFinish={handleUpdateStatus}
            >
              <Form.Item
                name="status"
                label="Новый статус"
                rules={[{ required: true, message: 'Выберите новый статус' }]}
              >
                <Select placeholder="Выберите статус">
                  {shipmentsApi.getValidNextStatuses(selectedShipment.status).map(status => (
                    <Option key={status} value={status}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div 
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: shipmentsApi.getStatusColor(status),
                            marginRight: '8px'
                          }} 
                        />
                        {shipmentsApi.getStatusText(status)}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="transportInfo"
                label="Информация о транспорте"
              >
                <TextArea 
                  rows={3} 
                  placeholder="Обновите информацию о транспорте..."
                />
              </Form.Item>

              {/* Поля для фактических количеств при отгрузке */}
              {statusForm.getFieldValue('status') === 'shipped' && selectedShipment.items && (
                <div>
                  <Divider>Фактические количества</Divider>
                  {selectedShipment.items.map(item => (
                    <Form.Item
                      key={item.id}
                      name={['actualQuantities', item.id]}
                      label={`${item.product.name} (планировалось: ${item.plannedQuantity})`}
                      initialValue={item.plannedQuantity}
                    >
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        placeholder="Фактическое количество"
                      />
                    </Form.Item>
                  ))}
                </div>
              )}
            </Form>
          </>
        )}
      </Modal>

      {/* Модальное окно редактирования отгрузки */}
      <Modal
        title="Редактировать отгрузку"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedShipment(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={actionLoading}
        width={500}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditShipment}
        >
          <Form.Item
            name="plannedDate"
            label="Планируемая дата отгрузки"
          >
            <DatePicker 
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder="Выберите дату"
            />
          </Form.Item>

          <Form.Item
            name="transportInfo"
            label="Информация о транспорте"
          >
            <TextArea 
              rows={3} 
              placeholder="Номер автомобиля, водитель, маршрут..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно деталей отгрузки */}
      <Modal
        title="Детали отгрузки"
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setSelectedShipment(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={900}
      >
        {selectedShipment && (
          <div>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Номер отгрузки">{selectedShipment.shipmentNumber}</Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Badge 
                  color={shipmentsApi.getStatusColor(selectedShipment.status)} 
                  text={shipmentsApi.getStatusText(selectedShipment.status)} 
                />
              </Descriptions.Item>
              <Descriptions.Item label="Плановая дата">
                {shipmentsApi.formatDate(selectedShipment.plannedDate || '')}
              </Descriptions.Item>
              <Descriptions.Item label="Фактическая дата">
                {shipmentsApi.formatDateTime(selectedShipment.actualDate || '')}
              </Descriptions.Item>
              <Descriptions.Item label="Информация о транспорте" span={2}>
                {selectedShipment.transportInfo || 'Не указана'}
              </Descriptions.Item>
              <Descriptions.Item label="Создал" span={2}>
                {selectedShipment.createdByUser ? 
                  (selectedShipment.createdByUser.fullName || selectedShipment.createdByUser.username) : 
                  'Неизвестно'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Дата создания">
                {shipmentsApi.formatDateTime(selectedShipment.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Фото документов">
                {selectedShipment.documentsPhotos && selectedShipment.documentsPhotos.length > 0 ? (
                  <div>
                    {selectedShipment.documentsPhotos.map((photo, index) => (
                      <Image key={index} src={photo} width={60} height={60} style={{ marginRight: '8px' }} />
                    ))}
                  </div>
                ) : (
                  'Нет фото'
                )}
              </Descriptions.Item>
            </Descriptions>

            {/* Связанные заказы */}
            {(selectedShipment.order || (selectedShipment.relatedOrders && selectedShipment.relatedOrders.length > 0)) && (
              <>
                <Divider>Связанные заказы</Divider>
                <Table
                  dataSource={selectedShipment.order ? [selectedShipment.order] : selectedShipment.relatedOrders}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'Номер заказа',
                      dataIndex: 'orderNumber',
                      key: 'orderNumber',
                    },
                    {
                      title: 'Клиент',
                      dataIndex: 'customerName',
                      key: 'customerName',
                    },
                    {
                      title: 'Приоритет',
                      dataIndex: 'priority',
                      key: 'priority',
                      render: (priority: string) => (
                        <Tag color={shipmentsApi.getPriorityColor(priority)}>
                          {shipmentsApi.getPriorityText(priority)}
                        </Tag>
                      )
                    },
                    {
                      title: 'Срок поставки',
                      dataIndex: 'deliveryDate',
                      key: 'deliveryDate',
                      render: (date: string) => shipmentsApi.formatDate(date)
                    }
                  ]}
                />
              </>
            )}

            {/* Товары в отгрузке */}
            {selectedShipment.items && selectedShipment.items.length > 0 && (
              <>
                <Divider>Товары в отгрузке</Divider>
                <Table
                  dataSource={selectedShipment.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'Товар',
                      key: 'product',
                      render: (record: any) => (
                        <div>
                          <div>{record.product.name}</div>
                          {record.product.article && <div style={{ fontSize: '12px', color: '#666' }}>
                            {record.product.article}
                          </div>}
                        </div>
                      ),
                    },
                    {
                      title: 'Планируемое кол-во',
                      dataIndex: 'plannedQuantity',
                      key: 'plannedQuantity',
                    },
                    {
                      title: 'Фактическое кол-во',
                      dataIndex: 'actualQuantity',
                      key: 'actualQuantity',
                      render: (quantity: number) => quantity !== null && quantity !== undefined ? quantity : '-'
                    }
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Shipments; 