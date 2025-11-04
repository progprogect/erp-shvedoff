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
  Divider,
  Tabs
} from 'antd';
import { 
  PlusOutlined, 
  CheckOutlined, 
  PlayCircleOutlined, 
  StopOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  ScissorOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import usePermissions from '../hooks/usePermissions';
import cuttingApi, { 
  CuttingOperation, 
  CreateCuttingOperationRequest, 
  UpdateCuttingOperationRequest,
  CompleteCuttingOperationRequest,
  CuttingOperationDetails,
  AddProgressRequest
} from '../services/cuttingApi';
import { catalogApi } from '../services/catalogApi';
import StockMovementsList from '../components/StockMovementsList';
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
  const { canCreate, canView, canManage } = usePermissions();

  // Добавляем стили для центрирования селектов
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .centered-select .ant-select-selector {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .centered-select .ant-select-selection-item {
        text-align: center !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [operations, setOperations] = useState<CuttingOperation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string; fullName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Модальные окна
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  
  // Данные для модальных окон
  const [selectedOperation, setSelectedOperation] = useState<CuttingOperation | null>(null);
  const [operationDetails, setOperationDetails] = useState<CuttingOperationDetails | null>(null);
  
  // Формы
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [progressForm] = Form.useForm();
  
  // Фильтры
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('operations');
  
  // Состояние для экспорта (Задача 9.2)
  const [exportingOperations, setExportingOperations] = useState(false);
  
  // Статистика
  const [statistics, setStatistics] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    thisMonth: 0,
    totalWaste: 0
  });
  
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
        plannedStartDate: values.plannedStartDate ? values.plannedStartDate.toISOString() : undefined,
        plannedEndDate: values.plannedEndDate ? values.plannedEndDate.toISOString() : undefined,
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
    // Находим операцию для специальных действий
    const operation = operations.find(op => op.id === id);
    if (!operation) return;

    // Перехватываем специальные статусы
    if (newStatus === 'completed') {
      // Для завершения открываем модал с формой
      openCompleteModal(operation);
      return;
    }

    if (newStatus === 'cancelled') {
      // Для отмены показываем подтверждение
      Modal.confirm({
        title: 'Отменить операцию резки?',
        content: 'Резерв будет снят. Это действие можно будет отменить.',
        okText: 'Отменить операцию',
        cancelText: 'Отмена',
        onOk: () => handleCancelOperation(id)
      });
      return;
    }

    // Для остальных статусов выполняем обычное изменение
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

  // Открытие модального окна редактирования
  const handleEditOperation = (operation: CuttingOperation) => {
    setSelectedOperation(operation);
    
    // Заполняем форму текущими данными операции
    editForm.setFieldsValue({
      sourceProductId: operation.sourceProductId,
      targetProductId: operation.targetProductId,
      sourceQuantity: operation.sourceQuantity,
      targetQuantity: operation.targetQuantity,
      plannedStartDate: operation.plannedStartDate ? dayjs(operation.plannedStartDate) : null,
      plannedEndDate: operation.plannedEndDate ? dayjs(operation.plannedEndDate) : null,
      assignedTo: operation.assignedTo,
      notes: operation.notes
    });
    
    setEditModalVisible(true);
  };

  // Сохранение изменений операции
  const handleUpdateOperation = async (values: any) => {
    if (!selectedOperation) return;

    try {
      setActionLoading(true);
      
      const request = {
        sourceProductId: values.sourceProductId,
        targetProductId: values.targetProductId,
        sourceQuantity: values.sourceQuantity,
        targetQuantity: values.targetQuantity,
        plannedStartDate: values.plannedStartDate ? values.plannedStartDate.toISOString() : undefined,
        plannedEndDate: values.plannedEndDate ? values.plannedEndDate.toISOString() : undefined,
        notes: values.notes,
        assignedTo: values.assignedTo
      };
      
      await cuttingApi.updateCuttingOperation(selectedOperation.id, request);
      message.success('Операция резки обновлена');
      
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedOperation(null);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка обновления операции');
    } finally {
      setActionLoading(false);
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
        actualSecondGradeQuantity: values.actualSecondGradeQuantity,
        actualLibertyGradeQuantity: values.actualLibertyGradeQuantity,
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

  // Функция экспорта операций резки (Задача 9.2)
  const handleExportOperations = async () => {
    setExportingOperations(true);
    try {
      // Формируем фильтры на основе текущих настроек
      const currentFilters: any = {
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      await cuttingApi.exportCuttingOperations(currentFilters);
      
      message.success('Экспорт операций резки завершен');
      
    } catch (error: any) {
      console.error('Error exporting cutting operations:', error);
      message.error('Ошибка при экспорте операций резки');
    } finally {
      setExportingOperations(false);
    }
  };

  // Открытие модального окна для ввода прогресса
  const handleAddProgress = (operation: CuttingOperation) => {
    setSelectedOperation(operation);
    progressForm.resetFields();
    setProgressModalVisible(true);
  };

  // Добавление прогресса
  const handleSubmitProgress = async (values: any) => {
    if (!selectedOperation) return;

    try {
      setActionLoading(true);
      
      const request: AddProgressRequest = {
        productQuantity: values.productQuantity || 0,
        secondGradeQuantity: values.secondGradeQuantity || 0,
        libertyGradeQuantity: values.libertyGradeQuantity || 0,
        wasteQuantity: values.wasteQuantity || 0
      };
      
      await cuttingApi.addProgress(selectedOperation.id, request);
      message.success('Прогресс добавлен');
      
      // Обновляем прогресс в selectedOperation
      const updatedOperation = await cuttingApi.getCuttingOperation(selectedOperation.id);
      setSelectedOperation(updatedOperation);
      
      setProgressModalVisible(false);
      progressForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка добавления прогресса');
    } finally {
      setActionLoading(false);
    }
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
      title: 'Прогресс',
      key: 'progress',
      width: 150,
      render: (record: CuttingOperation) => {
        const { progress } = record;
        if (!progress) {
          return <span style={{ color: '#999' }}>Нет данных</span>;
        }

        const { totalProduct, totalSecondGrade, totalLibertyGrade, totalWaste } = progress;
        const hasProgress = totalProduct !== 0 || totalSecondGrade !== 0 || totalLibertyGrade !== 0 || totalWaste !== 0;

        if (!hasProgress) {
          return <span style={{ color: '#999' }}>Нет прогресса</span>;
        }

        return (
          <div style={{ fontSize: '12px' }}>
            <div style={{ marginBottom: '2px' }}>
              <span style={{ color: '#52c41a', fontWeight: '500' }}>
                Товар: {totalProduct}
              </span>
            </div>
            {totalSecondGrade > 0 && (
              <div style={{ marginBottom: '2px' }}>
                <span style={{ color: '#faad14', fontWeight: '500' }}>
                  2 сорт: {totalSecondGrade}
                </span>
              </div>
            )}
            {totalLibertyGrade > 0 && (
              <div style={{ marginBottom: '2px' }}>
                <span style={{ color: '#722ed1', fontWeight: '500' }}>
                  Либерти: {totalLibertyGrade}
                </span>
              </div>
            )}
            {totalWaste > 0 && (
              <div style={{ marginBottom: '2px' }}>
                <span style={{ color: '#ff4d4f', fontWeight: '500' }}>
                  Брак: {totalWaste}
                </span>
              </div>
            )}
          </div>
        );
      }
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
      title: 'Планируемые даты',
      key: 'plannedDates',
      width: 150,
      render: (_: any, record: CuttingOperation) => {
        const { plannedStartDate, plannedEndDate, plannedDate } = record;
        
        // Если есть новые поля диапазона дат
        if (plannedStartDate && plannedEndDate) {
          const start = dayjs(plannedStartDate);
          const end = dayjs(plannedEndDate);
          const days = end.diff(start, 'day') + 1;
          
          return (
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '500' }}>
                {start.format('DD.MM.YYYY')} - {end.format('DD.MM.YYYY')}
              </div>
              <div style={{ color: '#666' }}>
                {days} дн.
              </div>
            </div>
          );
        }
        
        // Если есть только дата начала
        if (plannedStartDate) {
          return (
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '500' }}>
                С: {dayjs(plannedStartDate).format('DD.MM.YYYY')}
              </div>
            </div>
          );
        }
        
        // Если есть только дата окончания
        if (plannedEndDate) {
          return (
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '500' }}>
                До: {dayjs(plannedEndDate).format('DD.MM.YYYY')}
              </div>
            </div>
          );
        }
        
        // Fallback на старое поле plannedDate для обратной совместимости
        if (plannedDate) {
          return (
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '500' }}>
                {dayjs(plannedDate).format('DD.MM.YYYY')}
              </div>
              <div style={{ color: '#999' }}>
                (старая версия)
              </div>
            </div>
          );
        }
        
        return '-';
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (record: CuttingOperation) => {
        const userRole = user?.role || '';
        const validNextStatuses = cuttingApi.getValidNextStatuses(record.status);
        
        // Проверяем, можно ли редактировать операцию
        const canEdit = ['in_progress', 'paused', 'cancelled'].includes(record.status);
        
        return (
          <Space size="small">
            <Tooltip title="Просмотр">
              <Button 
                type="text" 
                icon={<EyeOutlined />} 
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>

            {/* Кнопка редактирования (только для редактируемых статусов) */}
            {canEdit && (
              <Tooltip title="Редактировать">
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={() => handleEditOperation(record)}
                />
              </Tooltip>
            )}

            {/* Кнопка ввода прогресса (только для незавершенных операций) */}
            {record.status !== 'completed' && (
              <Tooltip title="Ввести результаты">
                <Button 
                  type="text" 
                  icon={<CheckOutlined />} 
                  onClick={() => handleAddProgress(record)}
                  style={{ color: '#52c41a' }}
                />
              </Tooltip>
            )}

            {/* Управление статусом через Select (кроме завершенных операций) */}
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
          {/* Кнопка экспорта операций резки (Задача 9.2) */}
          <Button
            onClick={handleExportOperations}
            loading={exportingOperations}
            style={{
              borderColor: '#722ed1',
              color: '#722ed1'
            }}
            title="Экспорт текущего списка операций резки с примененными фильтрами"
          >
            📊 Экспорт операций
          </Button>
        </Space>
        
                        {canCreate('cutting') && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Создать операцию резки
          </Button>
        )}
      </div>

      {/* Табы */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'operations',
            label: 'Операции резки',
            children: (
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
            )
          },
          ...(canView('cutting') ? [{
            key: 'movements',
            label: 'История движений остатков',
            children: (
              <StockMovementsList
                referenceTypes={['cutting', 'cutting_progress']}
                canCancel={canManage('cutting')}
              />
            )
          }] : [])
        ]}
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
              optionLabelProp="label"
              labelInValue={false}
              getPopupContainer={(trigger) => trigger.parentElement}
              className="centered-select"
            >
              {products.map(product => {
                const available = getAvailableStock(product);
                const isDisabled = available <= 0;
                const label = product.article || product.name;
                
                return (
                  <Option 
                    key={product.id} 
                    value={product.id} 
                    disabled={isDisabled}
                    label={label}
                  >
                    <div style={{ 
                      padding: '4px 0',
                      opacity: isDisabled ? 0.5 : 1 
                    }}>
                      <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        {product.article && (
                          <div style={{
                            fontSize: '14px',
                            color: '#1890ff',
                            fontFamily: 'monospace',
                            fontWeight: '500'
                          }}>
                            {product.article}
                          </div>
                        )}
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'flex-end'
                        }}>
                          <span style={{ 
                            color: isDisabled ? '#ff4d4f' : '#52c41a',
                            fontWeight: '600',
                            fontSize: '12px'
                          }}>
                            {available > 0 ? `✅ ${available} шт.` : '❌ Нет в наличии'}
                          </span>
                        </div>
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
              optionLabelProp="label"
              labelInValue={false}
              getPopupContainer={(trigger) => trigger.parentElement}
              className="centered-select"
            >
              {getAvailableTargetProducts(createForm.getFieldValue('sourceProductId')).map(product => {
                const label = product.article || product.name;
                
                return (
                  <Option 
                    key={product.id} 
                    value={product.id}
                    label={label}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        {product.article && (
                          <div style={{
                            fontSize: '14px',
                            color: '#1890ff',
                            fontFamily: 'monospace',
                            fontWeight: '500'
                          }}>
                            {product.article}
                          </div>
                        )}
                      </div>
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plannedStartDate"
                label="Дата начала"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const endDate = getFieldValue('plannedEndDate');
                      if (value && endDate && value > endDate) {
                        return Promise.reject(new Error('Дата начала не может быть позже даты окончания'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder="Выберите дату начала"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="plannedEndDate"
                label="Дата окончания"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('plannedStartDate');
                      if (value && startDate && startDate > value) {
                        return Promise.reject(new Error('Дата окончания не может быть раньше даты начала'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder="Выберите дату окончания"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

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

      {/* Модальное окно редактирования операции */}
      <Modal
        title="Редактировать операцию резки"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedOperation(null);
        }}
        footer={null}
        width={800}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdateOperation}
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
              optionLabelProp="label"
              labelInValue={false}
              getPopupContainer={(trigger) => trigger.parentElement}
              className="centered-select"
            >
              {products.map(product => {
                const available = getAvailableStock(product);
                const isDisabled = available <= 0;
                const label = product.article || product.name;
                
                return (
                  <Option 
                    key={product.id} 
                    value={product.id} 
                    disabled={isDisabled}
                    label={label}
                  >
                    <div style={{ 
                      padding: '4px 0',
                      opacity: isDisabled ? 0.5 : 1 
                    }}>
                      <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        {product.article && (
                          <div style={{
                            fontSize: '14px',
                            color: '#1890ff',
                            fontFamily: 'monospace',
                            fontWeight: '500'
                          }}>
                            {product.article}
                          </div>
                        )}
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'flex-end'
                        }}>
                          <span style={{ 
                            color: isDisabled ? '#ff4d4f' : '#52c41a',
                            fontWeight: '600',
                            fontSize: '12px'
                          }}>
                            {available > 0 ? `✅ ${available} шт.` : '❌ Нет в наличии'}
                          </span>
                        </div>
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
              optionLabelProp="label"
              labelInValue={false}
              getPopupContainer={(trigger) => trigger.parentElement}
              className="centered-select"
            >
              {getAvailableTargetProducts(editForm.getFieldValue('sourceProductId')).map(product => {
                const label = product.article || product.name;
                
                return (
                  <Option 
                    key={product.id} 
                    value={product.id}
                    label={label}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        {product.article && (
                          <div style={{
                            fontSize: '14px',
                            color: '#1890ff',
                            fontFamily: 'monospace',
                            fontWeight: '500'
                          }}>
                            {product.article}
                          </div>
                        )}
                      </div>
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plannedStartDate"
                label="Дата начала"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const endDate = getFieldValue('plannedEndDate');
                      if (value && endDate && value > endDate) {
                        return Promise.reject(new Error('Дата начала не может быть позже даты окончания'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder="Выберите дату начала"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="plannedEndDate"
                label="Дата окончания"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('plannedStartDate');
                      if (value && startDate && startDate > value) {
                        return Promise.reject(new Error('Дата окончания не может быть раньше даты начала'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder="Выберите дату окончания"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="assignedTo"
            label="Назначить на"
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
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={actionLoading}
                size="large"
              >
                Сохранить изменения
              </Button>
              <Button 
                onClick={() => {
                  setEditModalVisible(false);
                  editForm.resetFields();
                  setSelectedOperation(null);
                }}
                size="large"
              >
                Отмена
              </Button>
            </Space>
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
                <strong>Операция:</strong>
                <div style={{ marginTop: '4px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500' }}>{selectedOperation.sourceProduct.name}</span>
                    {selectedOperation.sourceProduct.article && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        fontFamily: 'monospace',
                        marginLeft: '8px'
                      }}>
                        (Арт: {selectedOperation.sourceProduct.article})
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', margin: '4px 0' }}>↓</div>
                  <div>
                    <span style={{ fontWeight: '500' }}>{selectedOperation.targetProduct.name}</span>
                    {selectedOperation.targetProduct.article && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        fontFamily: 'monospace',
                        marginLeft: '8px'
                      }}>
                        (Арт: {selectedOperation.targetProduct.article})
                      </span>
                    )}
                  </div>
                </div>
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
                label="Готово (идёт в остатки целевого товара)"
                rules={[{ required: true, message: 'Укажите фактическое количество' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Количество готового товара"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="actualSecondGradeQuantity"
                label="2 сорт (идёт в остатки товара 2-го сорта)"
                extra="Положительное значение добавляет на склад, отрицательное отнимает (для корректировки)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Количество товара 2-го сорта"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="actualLibertyGradeQuantity"
                label="Либерти (идёт в остатки товара сорта Либерти)"
                extra="Положительное значение добавляет на склад, отрицательное отнимает (для корректировки)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Количество товара сорта Либерти"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="actualDefectQuantity"
                label="Брак (списывается)"
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
              <Descriptions.Item label="Выход продукции">
                {operationDetails.status === 'completed' 
                  ? (operationDetails.actualTargetQuantity || 0)
                  : (operationDetails.progress?.totalProduct || 0)
                } шт.
                {operationDetails.status !== 'completed' && ' (промежуточный)'}
              </Descriptions.Item>
              <Descriptions.Item label="Товар 2-го сорта">
                {operationDetails.status === 'completed' 
                  ? (operationDetails.actualSecondGradeQuantity || 0)
                  : (operationDetails.progress?.totalSecondGrade || 0)
                } шт.
                {operationDetails.status !== 'completed' && operationDetails.progress?.totalSecondGrade ? ' (промежуточный)' : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Товар сорта Либерти">
                {operationDetails.status === 'completed' 
                  ? (operationDetails.actualLibertyGradeQuantity || 0)
                  : (operationDetails.progress?.totalLibertyGrade || 0)
                } шт.
                {operationDetails.status !== 'completed' && operationDetails.progress?.totalLibertyGrade ? ' (промежуточный)' : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Брак">
                {operationDetails.status === 'completed' 
                  ? (operationDetails.actualDefectQuantity || 0)
                  : (operationDetails.progress?.totalWaste || 0)
                } шт.
                {operationDetails.status !== 'completed' && operationDetails.progress?.totalWaste ? ' (промежуточный)' : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Оператор">
                {operationDetails.operator ? 
                  (operationDetails.operator.fullName || operationDetails.operator.username) : 
                  'Не назначен'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Создано">{dayjs(operationDetails.createdAt).format('DD.MM.YYYY HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="Планируемые даты">
                {operationDetails.plannedStartDate && operationDetails.plannedEndDate ? (
                  <div>
                    <div style={{ fontWeight: '500' }}>
                      {dayjs(operationDetails.plannedStartDate).format('DD.MM.YYYY')} - {dayjs(operationDetails.plannedEndDate).format('DD.MM.YYYY')}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      Продолжительность: {dayjs(operationDetails.plannedEndDate).diff(dayjs(operationDetails.plannedStartDate), 'day') + 1} дн.
                    </div>
                  </div>
                ) : operationDetails.plannedStartDate ? (
                  <div>
                    <div style={{ fontWeight: '500' }}>
                      Начало: {dayjs(operationDetails.plannedStartDate).format('DD.MM.YYYY')}
                    </div>
                  </div>
                ) : operationDetails.plannedEndDate ? (
                  <div>
                    <div style={{ fontWeight: '500' }}>
                      Окончание: {dayjs(operationDetails.plannedEndDate).format('DD.MM.YYYY')}
                    </div>
                  </div>
                ) : operationDetails.plannedDate ? (
                  <div>
                    <div style={{ fontWeight: '500' }}>
                      {dayjs(operationDetails.plannedDate).format('DD.MM.YYYY')}
                    </div>
                    <div style={{ color: '#999', fontSize: '12px' }}>
                      (старая версия)
                    </div>
                  </div>
                ) : (
                  'Не указана'
                )}
              </Descriptions.Item>
              {operationDetails.completedAt && (
                <Descriptions.Item label="Завершено" span={2}>
                  {dayjs(operationDetails.completedAt).format('DD.MM.YYYY HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Отображение текущего прогресса */}
            {operationDetails.progress && (
              <>
                <Divider>Текущий прогресс</Divider>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #e9ecef',
                  marginBottom: '16px'
                }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                          {operationDetails.progress.totalProduct}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Товар</div>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                          {operationDetails.progress.totalSecondGrade}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>2 сорт</div>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#722ed1' }}>
                          {operationDetails.progress.totalLibertyGrade}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Либерти</div>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff4d4f' }}>
                          {operationDetails.progress.totalWaste}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Брак</div>
                      </div>
                    </Col>
                  </Row>
                  {operationDetails.progress.lastUpdated && (
                    <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#999' }}>
                      Последнее обновление: {dayjs(operationDetails.progress.lastUpdated).format('DD.MM.YYYY HH:mm')}
                    </div>
                  )}
                </div>
              </>
            )}

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

      {/* Модальное окно для ввода прогресса */}
      <Modal
        title="Ввести результаты резки"
        open={progressModalVisible}
        onCancel={() => {
          setProgressModalVisible(false);
          progressForm.resetFields();
          setSelectedOperation(null);
        }}
        footer={null}
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
                <strong>Операция:</strong>
                <div style={{ marginTop: '4px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500' }}>{selectedOperation.sourceProduct.name}</span>
                    {selectedOperation.sourceProduct.article && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        fontFamily: 'monospace',
                        marginLeft: '8px'
                      }}>
                        (Арт: {selectedOperation.sourceProduct.article})
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', margin: '4px 0' }}>↓</div>
                  <div>
                    <span style={{ fontWeight: '500' }}>{selectedOperation.targetProduct.name}</span>
                    {selectedOperation.targetProduct.article && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        fontFamily: 'monospace',
                        marginLeft: '8px'
                      }}>
                        (Арт: {selectedOperation.targetProduct.article})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Планировалось:</strong> {selectedOperation.targetQuantity} шт.
              </div>
              <div>
                <strong>Текущий прогресс:</strong>
                {selectedOperation.progress ? (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    <div>Товар: {selectedOperation.progress.totalProduct} шт.</div>
                    <div>2 сорт: {selectedOperation.progress.totalSecondGrade} шт.</div>
                    <div>Либерти: {selectedOperation.progress.totalLibertyGrade} шт.</div>
                    <div>Брак: {selectedOperation.progress.totalWaste} шт.</div>
                  </div>
                ) : (
                  <span style={{ color: '#999' }}> Нет данных</span>
                )}
              </div>
            </div>
            
            <Form
              form={progressForm}
              layout="vertical"
              onFinish={handleSubmitProgress}
            >
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fff7e6', borderRadius: '6px', border: '1px solid #ffd591' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <WarningOutlined style={{ color: '#fa8c16', marginRight: '8px' }} />
                  <strong style={{ color: '#fa8c16' }}>Внимание!</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#8c4a00' }}>
                  • Положительные значения добавляют к результатам<br/>
                  • Отрицательные значения отнимают от результатов (для корректировки)<br/>
                  • Можно оставить поля пустыми (будут считаться как 0)
                </div>
              </div>

              <Form.Item
                name="productQuantity"
                label="Готовый товар"
                extra="Положительное значение добавляет на склад, отрицательное отнимает"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Количество готового товара"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="secondGradeQuantity"
                label="Товар 2-го сорта"
                extra="Положительное значение добавляет на склад, отрицательное отнимает"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Количество товара 2-го сорта"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="libertyGradeQuantity"
                label="Товар сорта Либерти"
                extra="Положительное значение добавляет на склад, отрицательное отнимает"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Количество товара сорта Либерти"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="wasteQuantity"
                label="Брак"
                extra="Положительное значение добавляет к статистике брака, отрицательное отнимает"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Количество брака"
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={actionLoading}
                    size="large"
                  >
                    Добавить результаты
                  </Button>
                  <Button 
                    onClick={() => {
                      setProgressModalVisible(false);
                      progressForm.resetFields();
                      setSelectedOperation(null);
                    }}
                    size="large"
                  >
                    Отмена
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CuttingOperations; 