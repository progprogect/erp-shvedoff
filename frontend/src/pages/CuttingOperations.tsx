import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Form, 
  Select, 
  InputNumber, 
  DatePicker, 
  message, 
  Space, 
  Tooltip, 
  Card, 
  Statistic, 
  Row, 
  Col,
  Popconfirm,
  Input,
  Descriptions,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  CheckOutlined, 
  PlayCircleOutlined, 
  StopOutlined,
  DeleteOutlined,
  EyeOutlined,
  ScissorOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import cuttingApi, { 
  CuttingOperation, 
  CreateCuttingOperationRequest, 
  CompleteCuttingOperationRequest,
  CuttingOperationDetails
} from '../services/cuttingApi';
import { catalogApi } from '../services/catalogApi';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Product {
  id: number;
  name: string;
  article?: string;
  categoryId?: number;
  stock?: {
    currentStock: number;
    reservedStock: number;
  };
}

export const CuttingOperations: React.FC = () => {
  const { user } = useAuthStore();
  const [operations, setOperations] = useState<CuttingOperation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Модальные окна
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  
  // Данные для модальных окон
  const [selectedOperation, setSelectedOperation] = useState<CuttingOperation | null>(null);
  const [operationDetails, setOperationDetails] = useState<CuttingOperationDetails | null>(null);
  
  // Формы
  const [createForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  
  // Фильтры
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Статистика
  const [statistics, setStatistics] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    thisMonth: 0,
    totalWaste: 0
  });
  
  // Пользователи для назначения
  const [users, setUsers] = useState<Array<{ id: number; username: string; fullName: string }>>([]);

  // Загрузка данных
  useEffect(() => {
    loadData();
    loadProducts();
    loadUsers();
    loadStatistics();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await cuttingApi.getCuttingOperations({
        status: statusFilter === 'all' ? undefined : statusFilter
      });
      setOperations(data);
    } catch (error) {
      message.error('Ошибка загрузки операций резки');
      console.error('Error loading cutting operations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const response = await catalogApi.getProducts({ page: 1, limit: 1000 });
      if (response.success) {
        setProducts(response.data);
      } else {
        message.error('Ошибка загрузки товаров');
      }
    } catch (error) {
      message.error('Ошибка загрузки товаров');
      console.error('Error loading products:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await cuttingApi.getCuttingStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const response = await catalogApi.getUsers();
      
      if (response.success) {
        setUsers(response.data.map((user: any) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName || user.username
        })));
      }
    } catch (error) {
      console.error('Error loading users:', error);
      message.error('Ошибка загрузки пользователей');
    }
  };

  // Обновление данных при изменении фильтра
  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Создание операции резки
  const handleCreateOperation = async (values: any) => {
    try {
      setActionLoading(true);
      
      const request: CreateCuttingOperationRequest = {
        sourceProductId: values.sourceProductId,
        targetProductId: values.targetProductId,
        sourceQuantity: values.sourceQuantity,
        targetQuantity: values.targetQuantity,
        plannedDate: values.plannedDate ? values.plannedDate.toISOString() : undefined,
        notes: values.notes,
        assignedTo: values.assignedTo
      };
      
      await cuttingApi.createCuttingOperation(request);
      message.success('Заявка на резку создана');
      
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка создания заявки');
    } finally {
      setActionLoading(false);
    }
  };

  // Изменение статуса операции
  const handleChangeStatus = async (id: number, newStatus: CuttingOperation['status']) => {
    try {
      setActionLoading(true);
      await cuttingApi.changeOperationStatus(id, newStatus);
      message.success('Статус операции изменен');
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка изменения статуса');
    } finally {
      setActionLoading(false);
    }
  };

  // Отмена операции
  const handleCancelOperation = async (id: number) => {
    try {
      setActionLoading(true);
      await cuttingApi.cancelCuttingOperation(id);
      message.success('Операция резки отменена');
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка отмены операции');
    } finally {
      setActionLoading(false);
    }
  };

  // Просмотр деталей операции
  const handleViewDetails = async (operation: CuttingOperation) => {
    try {
      setLoading(true);
      const details = await cuttingApi.getCuttingOperation(operation.id);
      setOperationDetails(details);
      setDetailsModalVisible(true);
    } catch (error: any) {
      message.error('Ошибка загрузки деталей операции');
    } finally {
      setLoading(false);
    }
  };

  // Открытие модального окна завершения
  const openCompleteModal = (operation: CuttingOperation) => {
    setSelectedOperation(operation);
    completeForm.setFieldsValue({
      actualTargetQuantity: operation.targetQuantity,
      actualDefectQuantity: operation.wasteQuantity // Используем старое поле, но теперь это "брак"
    });
    setCompleteModalVisible(true);
  };

  // Завершение операции
  const handleCompleteOperation = async (values: any) => {
    if (!selectedOperation) return;
    
    try {
      setActionLoading(true);
      
      const request: CompleteCuttingOperationRequest = {
        actualTargetQuantity: values.actualTargetQuantity,
        actualDefectQuantity: values.actualDefectQuantity,
        notes: values.notes
      };
      
      await cuttingApi.completeCuttingOperation(selectedOperation.id, request);
      message.success('Операция резки завершена');
      
      setCompleteModalVisible(false);
      completeForm.resetFields();
      setSelectedOperation(null);
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка завершения операции');
    } finally {
      setActionLoading(false);
    }
  };

  // Фильтрация доступных целевых товаров (исключаем исходный)
  const getAvailableTargetProducts = (sourceProductId?: number) => {
    return products.filter(product => product.id !== sourceProductId);
  };

  // Расчет доступного остатка
  const getAvailableStock = (product?: Product) => {
    if (!product?.stock) return 0;
    return product.stock.currentStock - product.stock.reservedStock;
  };

  // Валидация количества исходного товара
  const validateSourceQuantity = (_: any, value: number) => {
    const sourceProductId = createForm.getFieldValue('sourceProductId');
    const sourceProduct = products.find(p => p.id === sourceProductId);
    const available = getAvailableStock(sourceProduct);
    
    if (value > available) {
      return Promise.reject(new Error(`Доступно только ${available} шт.`));
    }
    return Promise.resolve();
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Исходный товар',
      key: 'sourceProduct',
      render: (record: CuttingOperation) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.sourceProduct.name}</div>
          {record.sourceProduct.article && <div style={{ fontSize: '12px', color: '#666' }}>
            Артикул: {record.sourceProduct.article}
          </div>}
          <div style={{ fontSize: '12px', color: '#999' }}>
            Расход: {record.sourceQuantity} шт.
          </div>
        </div>
      ),
    },
    {
      title: 'Целевой товар',
      key: 'targetProduct',
      render: (record: CuttingOperation) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.targetProduct.name}</div>
          {record.targetProduct.article && <div style={{ fontSize: '12px', color: '#666' }}>
            Артикул: {record.targetProduct.article}
          </div>}
          <div style={{ fontSize: '12px', color: '#999' }}>
            Выход: {record.targetQuantity} шт.
          </div>
        </div>
      ),
    },
    {
      title: 'Брак',
      dataIndex: 'wasteQuantity',
      key: 'wasteQuantity',
      width: 100,
      render: (waste: number) => (
        <span style={{ color: waste > 0 ? '#ff4d4f' : '#52c41a' }}>
          {waste} шт.
        </span>
      )
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: CuttingOperation['status']) => (
        <Badge 
          color={cuttingApi.getStatusColor(status)} 
          text={cuttingApi.getStatusText(status)} 
        />
      ),
    },
    {
      title: 'Оператор',
      key: 'operator',
      width: 150,
      render: (record: CuttingOperation) => (
        record.operator ? record.operator.fullName || record.operator.username : '-'
      ),
    },
    {
      title: 'Плановая дата',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('DD.MM.YYYY') : '-',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (record: CuttingOperation) => {
        const userRole = user?.role || '';
        const validNextStatuses = cuttingApi.getValidNextStatuses(record.status);
        
        return (
          <Space size="small">
            <Tooltip title="Просмотр">
              <Button 
                type="text" 
                icon={<EyeOutlined />} 
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>
            
            {record.status === 'in_progress' && cuttingApi.canComplete(userRole) && (
              <Tooltip title="Завершить">
                <Button 
                  type="text" 
                  icon={<StopOutlined />} 
                  style={{ color: '#722ed1' }}
                  onClick={() => openCompleteModal(record)}
                />
              </Tooltip>
            )}

            {/* Кнопки изменения статуса (кроме завершенных операций) */}
            {record.status !== 'completed' && validNextStatuses.length > 0 && (
              <Select
                size="small"
                value={record.status}
                style={{ minWidth: 120 }}
                onChange={(newStatus) => handleChangeStatus(record.id, newStatus as CuttingOperation['status'])}
                loading={actionLoading}
              >
                <Option value={record.status} disabled>
                  {cuttingApi.getStatusText(record.status)}
                </Option>
                {validNextStatuses.map(status => (
                  <Option key={status} value={status}>
                    {cuttingApi.getStatusText(status)}
                  </Option>
                ))}
              </Select>
            )}
            
            {(record.status === 'in_progress' || record.status === 'cancelled') && cuttingApi.canCancel(userRole) && (
              <Tooltip title="Отменить">
                <Popconfirm
                  title="Отменить операцию резки?"
                  description="Резерв будет снят"
                  onConfirm={() => handleCancelOperation(record.id)}
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
          <ScissorOutlined style={{ marginRight: '8px' }} />
          Операции резки (гидрообразив)
        </h1>
      </div>

      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всего операций" value={statistics.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="За текущий месяц" value={statistics.thisMonth} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Активных операций" 
              value={statistics.byStatus['planned'] + statistics.byStatus['approved'] + statistics.byStatus['in_progress'] || 0} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Общий объем брака" 
              value={statistics.totalWaste} 
              suffix="шт."
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Управление */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 200 }}
          >
            <Option value="all">Все операции</Option>
            <Option value="planned">Запланированные</Option>
            <Option value="approved">Утвержденные</Option>
            <Option value="in_progress">В процессе</Option>
            <Option value="paused">На паузе</Option>
            <Option value="completed">Завершенные</Option>
            <Option value="cancelled">Отмененные</Option>
          </Select>
        </Space>
        
        {['manager', 'director'].includes(user?.role || '') && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Создать операцию резки
          </Button>
        )}
      </div>

      {/* Таблица операций */}
      <Table
        columns={columns}
        dataSource={operations}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `Всего ${total} операций`,
        }}
      />

      {/* Модальное окно создания операции */}
      <Modal
        title="Создать заявку на резку"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={actionLoading}
        width={1000}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateOperation}
        >
          <Form.Item
            name="sourceProductId"
            label="Исходный товар"
            rules={[{ required: true, message: 'Выберите исходный товар' }]}
          >
            <Select
              showSearch
              placeholder="Выберите товар для резки"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label?.toString().toLowerCase().includes(input.toLowerCase())) ?? false
              }
              style={{ width: '100%' }}
              size="large"
              dropdownStyle={{ maxHeight: 400, overflowY: 'auto' }}
            >
              {products.map(product => {
                const available = getAvailableStock(product);
                const isDisabled = available <= 0;
                const label = product.name;
                
                return (
                  <Option 
                    key={product.id} 
                    value={product.id} 
                    disabled={isDisabled}
                    label={label}
                  >
                    <div style={{ 
                      padding: '8px 0',
                      opacity: isDisabled ? 0.5 : 1 
                    }}>
                      <div style={{ 
                        fontWeight: '500',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        marginBottom: '4px',
                        wordBreak: 'break-word'
                      }}>
                        {product.name}
                      </div>
                      <div style={{ 
                        fontSize: '12px',
                        color: '#666',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {product.article && (
                            <span style={{ 
                              backgroundColor: '#f5f5f5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }}>
                              {product.article}
                            </span>
                          )}
                        </div>
                        <span style={{ 
                          color: isDisabled ? '#ff4d4f' : '#52c41a',
                          fontWeight: '600',
                          fontSize: '12px'
                        }}>
                          {available > 0 ? `✅ ${available} шт.` : '❌ Нет в наличии'}
                        </span>
                      </div>
                    </div>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item
            name="targetProductId"
            label="Целевой товар"
            rules={[{ required: true, message: 'Выберите целевой товар' }]}
          >
            <Select
              showSearch
              placeholder="Выберите товар для получения"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label?.toString().toLowerCase().includes(input.toLowerCase())) ?? false
              }
              style={{ width: '100%' }}
              size="large"
              dropdownStyle={{ maxHeight: 400, overflowY: 'auto' }}
            >
              {getAvailableTargetProducts(createForm.getFieldValue('sourceProductId')).map(product => {
                const label = product.name;
                
                return (
                  <Option 
                    key={product.id} 
                    value={product.id}
                    label={label}
                  >
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ 
                        fontWeight: '500',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        marginBottom: '4px',
                        wordBreak: 'break-word'
                      }}>
                        {product.name}
                      </div>
                      {product.article && (
                        <div style={{ 
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          <span style={{ 
                            backgroundColor: '#f5f5f5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            {product.article}
                          </span>
                        </div>
                      )}
                    </div>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sourceQuantity"
                label="Количество исходного товара"
                rules={[
                  { required: true, message: 'Укажите количество' },
                  { validator: validateSourceQuantity }
                ]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="Количество для резки"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="targetQuantity"
                label="Ожидаемое количество готового товара"
                rules={[{ required: true, message: 'Укажите ожидаемое количество' }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="Ожидаемый выход"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="plannedDate"
            label="Планируемая дата выполнения"
          >
            <DatePicker 
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder="Выберите дату"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="assignedTo"
            label="Назначить на"
            initialValue={user?.id}
          >
            <Select
              placeholder="Выберите исполнителя"
              allowClear
              size="large"
              style={{ width: '100%' }}
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '500' }}>{user.fullName}</span>
                    <span style={{ color: '#666', fontSize: '12px' }}>@{user.username}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="notes"
            label="Примечания"
          >
            <TextArea 
              rows={4} 
              placeholder="Дополнительная информация об операции резки..."
              style={{ resize: 'vertical' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно завершения операции */}
      <Modal
        title="Завершить операцию резки"
        open={completeModalVisible}
        onCancel={() => {
          setCompleteModalVisible(false);
          completeForm.resetFields();
          setSelectedOperation(null);
        }}
        onOk={() => completeForm.submit()}
        confirmLoading={actionLoading}
        width={600}
      >
        {selectedOperation && (
          <>
            <div style={{ 
              marginBottom: '24px', 
              padding: '16px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Операция:</strong> {selectedOperation.sourceProduct.name} → {selectedOperation.targetProduct.name}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Планировалось:</strong> {selectedOperation.targetQuantity} шт.
              </div>
              <div>
                <strong>Ожидаемый брак:</strong> {selectedOperation.wasteQuantity} шт.
              </div>
            </div>
            
            <Form
              form={completeForm}
              layout="vertical"
              onFinish={handleCompleteOperation}
            >
              <Form.Item
                name="actualTargetQuantity"
                label="Фактически получено готового товара"
                rules={[{ required: true, message: 'Укажите фактическое количество' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Фактический выход"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="actualDefectQuantity"
                label="Фактический брак"
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Количество брака"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="notes"
                label="Примечания к завершению"
              >
                <TextArea 
                  rows={4} 
                  placeholder="Комментарии о результатах операции..."
                  style={{ resize: 'vertical' }}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Модальное окно деталей операции */}
      <Modal
        title="Детали операции резки"
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setOperationDetails(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={800}
      >
        {operationDetails && (
          <div>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="ID операции">{operationDetails.id}</Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Badge 
                  color={cuttingApi.getStatusColor(operationDetails.status)} 
                  text={cuttingApi.getStatusText(operationDetails.status)} 
                />
              </Descriptions.Item>
              <Descriptions.Item label="Исходный товар" span={2}>
                {operationDetails.sourceProduct.name}
                {operationDetails.sourceProduct.article && ` (${operationDetails.sourceProduct.article})`}
              </Descriptions.Item>
              <Descriptions.Item label="Целевой товар" span={2}>
                {operationDetails.targetProduct.name}
                {operationDetails.targetProduct.article && ` (${operationDetails.targetProduct.article})`}
              </Descriptions.Item>
              <Descriptions.Item label="Расход материала">{operationDetails.sourceQuantity} шт.</Descriptions.Item>
              <Descriptions.Item label="Выход продукции">{operationDetails.targetQuantity} шт.</Descriptions.Item>
              <Descriptions.Item label="Отходы">{operationDetails.wasteQuantity} шт.</Descriptions.Item>
              <Descriptions.Item label="Оператор">
                {operationDetails.operator ? 
                  (operationDetails.operator.fullName || operationDetails.operator.username) : 
                  'Не назначен'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Создано">{dayjs(operationDetails.createdAt).format('DD.MM.YYYY HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="Планируемая дата">
                {operationDetails.plannedDate ? dayjs(operationDetails.plannedDate).format('DD.MM.YYYY') : 'Не указана'}
              </Descriptions.Item>
              {operationDetails.completedAt && (
                <Descriptions.Item label="Завершено" span={2}>
                  {dayjs(operationDetails.completedAt).format('DD.MM.YYYY HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {operationDetails.movements && operationDetails.movements.length > 0 && (
              <>
                <Divider>История движений товаров</Divider>
                <Table
                  dataSource={operationDetails.movements}
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
                      title: 'Тип движения',
                      dataIndex: 'movementType',
                      key: 'movementType',
                      render: (type: string) => {
                        const typeMap: Record<string, string> = {
                          'cutting_out': 'Списание при резке',
                          'cutting_in': 'Поступление от резки',
                          'reservation': 'Резервирование',
                          'release_reservation': 'Снятие резерва'
                        };
                        return typeMap[type] || type;
                      }
                    },
                    {
                      title: 'Количество',
                      dataIndex: 'quantity',
                      key: 'quantity',
                      render: (quantity: number) => (
                        <span style={{ color: quantity > 0 ? '#52c41a' : '#ff4d4f' }}>
                          {quantity > 0 ? '+' : ''}{quantity}
                        </span>
                      )
                    },
                    {
                      title: 'Дата',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm')
                    },
                    {
                      title: 'Комментарий',
                      dataIndex: 'comment',
                      key: 'comment',
                    },
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

export default CuttingOperations; 