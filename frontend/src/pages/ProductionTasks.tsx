import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, 
  Tabs, 
  Table, 
  Button, 
  Tag, 
  Space, 
  Typography, 
  Statistic, 
  Row, 
  Col, 
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  App,
  Popconfirm,
  Tooltip,
  Divider,
  Alert,
  DatePicker
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DragOutlined,
  PlusOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  InboxOutlined
} from '@ant-design/icons';

import {
  DragDropContext,
  Droppable,
  Draggable,
  DroppableProvided,
  DraggableProvided,
  DropResult
} from 'react-beautiful-dnd';

import {
  getProductionTasks,
  getTasksByProduct,
  startTask,
  completeTask,
  partialCompleteTask,
  bulkRegisterProduction,
  completeTasksByProduct,
  updateProductionTask,
  updateTaskStatus,
  deleteProductionTask,
  reorderProductionTasks,
  createProductionTask,
  ProductionTask,
  ProductionTaskExtra,
  UpdateProductionTaskRequest,
  PartialCompleteTaskResponse,
  exportProductionTasks
} from '../services/productionApi';
import ProductionCalendar from '../components/ProductionCalendar';
import ProductionStatistics from '../components/ProductionStatistics';
import { catalogApi } from '../services/catalogApi';
import { useAuthStore } from '../stores/authStore';
import usePermissions from '../hooks/usePermissions';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
// Убрали устаревший TabPane, теперь используем items
const { TextArea } = Input;
const { Option } = Select;

interface Product {
  id: number;
  name: string;
  sku?: string;
  article?: string;
}

interface TasksByProduct {
  product: Product;
  tasks: ProductionTask[];
  totalQuantity: number;
}

const ProductionTasks: React.FC = () => {
  const { user, token } = useAuthStore();
  const { canManage } = usePermissions();
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<string>('list');

  // Добавляем стили для переноса текста в Select
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .bulk-register-select .ant-select-selection-item {
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
        line-height: 1.2 !important;
        padding: 6px 8px !important;
        min-height: 50px !important;
        display: flex !important;
        align-items: flex-start !important;
        font-family: monospace !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        color: #1890ff !important;
        max-height: 60px !important;
        overflow: hidden !important;
      }
      .bulk-register-select .ant-select-selection-placeholder {
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
        line-height: 1.2 !important;
        padding: 6px 8px !important;
        min-height: 50px !important;
        display: flex !important;
        align-items: flex-start !important;
        font-size: 11px !important;
      }
      .bulk-register-select .ant-select-selector {
        min-height: 50px !important;
        padding: 0 !important;
        max-height: 60px !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Состояние для списка заданий
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [tasksByProduct, setTasksByProduct] = useState<TasksByProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Фильтры
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled'>('all');
  
  // Состояние для экспорта (Задача 9.2)
  const [exportingTasks, setExportingTasks] = useState(false);
  
  // Состояние для статистики
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    paused: 0,
    completed: 0,
    cancelled: 0
  });
  
  // Состояние для модалов
  const [approveModalVisible, setApproveModalVisible] = useState<boolean>(false);
  const [completeModalVisible, setCompleteModalVisible] = useState<boolean>(false);
  const [partialCompleteModalVisible, setPartialCompleteModalVisible] = useState<boolean>(false);
  const [bulkRegisterModalVisible, setBulkRegisterModalVisible] = useState<boolean>(false);
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState<boolean>(false);
  const [completeByProductModalVisible, setCompleteByProductModalVisible] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
  const [selectedProductForCompletion, setSelectedProductForCompletion] = useState<TasksByProduct | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Array<{ id: number; orderNumber: string; customerName: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string; fullName: string }>>([]);
  
  const [approveForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [partialCompleteForm] = Form.useForm();
  const [bulkRegisterForm] = Form.useForm();
  const [createTaskForm] = Form.useForm();
  const [completeByProductForm] = Form.useForm();

  // Состояние для формы завершения
  const [completeFormValues, setCompleteFormValues] = useState<{
    producedQuantity: number;
    qualityQuantity: number;
    defectQuantity: number;
  }>({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });

  // Состояние для формы частичного выполнения (WBS 2 - Adjustments Задача 4.1)
  const [partialCompleteFormValues, setPartialCompleteFormValues] = useState<{
    producedQuantity: number;
    qualityQuantity: number;
    defectQuantity: number;
  }>({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });

  // Состояние для формы массовой регистрации (WBS 2 - Adjustments Задача 4.2)
  const [bulkRegisterItems, setBulkRegisterItems] = useState<Array<{
    id: number;
    productId?: number;
    article: string;
    productName?: string;
    producedQuantity: number;
    qualityQuantity: number;
    defectQuantity: number;
  }>>([{ id: 1, article: '', producedQuantity: 10, qualityQuantity: 10, defectQuantity: 0 }]);

  // Состояние для поиска товаров в массовой регистрации
  const [bulkRegisterProducts, setBulkRegisterProducts] = useState<Product[]>([]);

  // Загрузка товаров для массовой регистрации
  const loadBulkRegisterProducts = async () => {
    try {
      const response = await catalogApi.getProducts({ page: 1, limit: 1000 });
      if (response.success) {
        setBulkRegisterProducts(response.data.map(p => ({
          id: p.id,
          name: p.name,
          article: p.article || ''
        })));
      }
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    }
  };

  // Состояние для модального окна редактирования
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // Состояние для модального окна просмотра деталей
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingTask, setViewingTask] = useState<ProductionTask | null>(null);

  // Фильтрация заданий по статусу
  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') {
      return tasks;
    }
    return tasks.filter(task => task.status === statusFilter);
  }, [tasks, statusFilter]);
  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null);
  const [editForm] = Form.useForm();

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadTasks();
    loadProducts();
    loadOrders();
    loadUsers();
  }, []);

  // Загрузка списка заданий
  const loadTasks = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await getProductionTasks({ limit: 100 });
      if (response.success) {
        setTasks(response.data);
        updateStats(response.data);
      } else {
        message.error('Ошибка загрузки производственных заданий');
      }
    } catch (error) {
      console.error('Error loading production tasks:', error);
      message.error('Ошибка загрузки производственных заданий');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка заданий по товарам
  const loadTasksByProduct = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await getTasksByProduct();
      if (response.success) {
        setTasksByProduct(response.data);
      } else {
        message.error('Ошибка загрузки заданий по товарам');
      }
    } catch (error) {
      console.error('Error loading tasks by product:', error);
      message.error('Ошибка загрузки заданий по товарам');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка списка товаров
  const loadProducts = async () => {
    if (!token) return;
    
    try {
      const response = await catalogApi.getProducts({ page: 1, limit: 1000 });
      if (response.success) {
        setProducts(response.data.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.article
        })));
      }
    } catch (error) {
      console.error('Error loading products:', error);
      message.error('Ошибка загрузки товаров');
    }
  };

  // Загрузка списка заказов
  const loadOrders = async () => {
    if (!token) return;
    
    try {
      const { ordersApi } = await import('../services/ordersApi');
      const response = await ordersApi.getOrders({ limit: 100, status: 'new,confirmed,in_production' });
      
      if (response.success) {
        setOrders(response.data.map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName
        })));
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      message.error('Ошибка загрузки заказов');
    }
  };

  // Загрузка списка пользователей
  const loadUsers = async () => {
    if (!token) return;
    
    try {
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

  // Обновление статистики
  const updateStats = (tasksList: ProductionTask[]) => {
    const newStats = {
      pending: tasksList.filter(t => t.status === 'pending').length,
      inProgress: tasksList.filter(t => t.status === 'in_progress').length,
      paused: tasksList.filter(t => t.status === 'paused').length,
      completed: tasksList.filter(t => t.status === 'completed').length,
      cancelled: tasksList.filter(t => t.status === 'cancelled').length
    };
    setStats(newStats);
  };

  // Группировка заданий по дням для календарного планирования
  const groupTasksByDays = (tasksList: ProductionTask[]) => {
    const today = dayjs().startOf('day');
    const tomorrow = today.add(1, 'day');
    
    const groups = {
      unplanned: [] as ProductionTask[],
      today: [] as ProductionTask[],
      tomorrow: [] as ProductionTask[],
      later: [] as ProductionTask[],
      overdue: [] as ProductionTask[],
      completed: [] as ProductionTask[]
    };

    tasksList.forEach(task => {
      // Завершенные задания всегда идут в отдельную группу
      if (task.status === 'completed') {
        groups.completed.push(task);
        return;
      }

      if (!task.plannedDate) {
        groups.unplanned.push(task);
        return;
      }

      const plannedDate = dayjs(task.plannedDate).startOf('day');
      
      if (plannedDate.isBefore(today)) {
        groups.overdue.push(task);
      } else if (plannedDate.isSame(today)) {
        groups.today.push(task);
      } else if (plannedDate.isSame(tomorrow)) {
        groups.tomorrow.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  };

  // Рендер группы заданий с заголовком
  const renderTaskGroup = (
    title: string, 
    tasks: ProductionTask[], 
    color: string, 
    icon: React.ReactNode,
    description?: string
  ) => {
    if (tasks.length === 0) return null;

    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: color, 
          borderRadius: '6px 6px 0 0',
          borderBottom: '1px solid #e6e6e6'
        }}>
          <Space>
            {icon}
            <Text strong style={{ color: 'white' }}>
              {title} ({tasks.length})
            </Text>
            {description && (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {description}
              </Text>
            )}
          </Space>
        </div>
        <div style={{ 
          border: '1px solid #e6e6e6', 
          borderTop: 'none',
          borderRadius: '0 0 6px 6px'
        }}>
          <Table
            columns={taskColumns}
            dataSource={tasks}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="middle"
            showHeader={false}
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>
    );
  };

  // Обработчик изменения вкладки
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'by-product') {
      loadTasksByProduct();
    } else if (key === 'list' || key === 'calendar') {
      loadTasks();
    }
    // Для статистики не нужно дополнительно загружать данные
  };

  // Обработчик drag and drop
  const handleOnDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTasks(items);

    try {
      const taskIds = items.map(task => task.id);
      await reorderProductionTasks(taskIds);
      message.success('Порядок заданий обновлен');
    } catch (error) {
      console.error('Error reordering tasks:', error);
      message.error('Ошибка изменения порядка заданий');
      // Восстанавливаем оригинальный порядок в случае ошибки
      loadTasks();
    }
  }, [tasks]);

  // Компонент для DragDropContext
  const DragDropWrapper = ({ children }: { children: React.ReactNode }) => (
    <DragDropContext onDragEnd={handleOnDragEnd}>
      {children}
    </DragDropContext>
  );

  // Обработчики действий с заданиями
  const handleStartTask = async (task: ProductionTask) => {
    try {
      await startTask(task.id);
      message.success('Задание запущено в производство');
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  const handlePauseTask = async (task: ProductionTask) => {
    try {
      await updateTaskStatus(task.id, 'paused');
      message.success('Задание поставлено на паузу');
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  const handleResumeTask = async (task: ProductionTask) => {
    try {
      await updateTaskStatus(task.id, 'in_progress');
      message.success('Задание возобновлено');
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  const handleEditTask = (task: ProductionTask) => {
    setEditingTask(task);
    editForm.setFieldsValue({
      requestedQuantity: task.requestedQuantity,
      priority: task.priority,
      notes: task.notes,
      assignedTo: task.assignedTo,
      plannedDate: task.plannedDate ? dayjs(task.plannedDate) : null
    });
    setEditModalVisible(true);
  };

  // Просмотр деталей задания
  const handleViewTask = (task: ProductionTask) => {
    setViewingTask(task);
    setViewModalVisible(true);
  };

  // Удаление задания
  const handleDeleteTask = async (task: ProductionTask) => {
    Modal.confirm({
      title: 'Удаление производственного задания',
      content: (
        <div>
          <p>Вы уверены, что хотите удалить задание на производство товара <strong>{task.product?.name}</strong>?</p>
          <p>Количество: <strong>{task.requestedQuantity} шт.</strong></p>
          {task.order && (
            <p>Заказ: <strong>№{task.order.orderNumber}</strong> - {task.order.customerName}</p>
          )}
          <p style={{ color: '#ff4d4f', marginTop: '8px' }}>
            ⚠️ Это действие нельзя отменить. Задание можно удалить только в статусе "Ожидает".
          </p>
        </div>
      ),
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const result = await deleteProductionTask(task.id);
          
          if (result.success) {
            message.success(result.message || 'Задание удалено');
            loadTasks();
            loadTasksByProduct();
          } else {
            message.error(result.message || 'Ошибка удаления задания');
          }
        } catch (error) {
          console.error('Ошибка удаления задания:', error);
          message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
      }
    });
  };

  const handleUpdateTask = async (values: any) => {
    if (!editingTask) return;

    try {
      await updateProductionTask(editingTask.id, values);
      message.success('Задание обновлено');
      setEditModalVisible(false);
      setEditingTask(null);
      editForm.resetFields();
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Завершение задания
  const handleCompleteTask = async (values: any) => {
    if (!selectedTask) return;

    try {
      // Автоматический пересчет качественных если не указано
      if (!completeFormValues.qualityQuantity && !completeFormValues.defectQuantity) {
        setCompleteFormValues(prev => ({
          ...prev,
          qualityQuantity: completeFormValues.producedQuantity,
          defectQuantity: 0
        }));
      }

      const produced = completeFormValues.producedQuantity;
      const quality = completeFormValues.qualityQuantity;
      const defect = completeFormValues.defectQuantity;

      // Валидация суммы
      if (quality + defect !== produced) {
        message.error('Сумма годных и брака должна равняться произведенному количеству');
        return;
      }

      // Подготовка данных для отправки
      await completeTask(selectedTask.id, {
        producedQuantity: produced,
        qualityQuantity: quality,
        defectQuantity: defect,
        notes: values.notes
      });

      message.success('Задание завершено');
      setCompleteModalVisible(false);
      setSelectedTask(null);
      completeForm.resetFields();
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Частичное выполнение задания (WBS 2 - Adjustments Задача 4.1)
  const handlePartialCompleteTask = async (values: any) => {
    if (!selectedTask) return;

    try {
      // Автоматический пересчет качественных если не указано
      if (!partialCompleteFormValues.qualityQuantity && !partialCompleteFormValues.defectQuantity) {
        setPartialCompleteFormValues(prev => ({
          ...prev,
          qualityQuantity: partialCompleteFormValues.producedQuantity,
          defectQuantity: 0
        }));
      }

      const produced = partialCompleteFormValues.producedQuantity;
      const quality = partialCompleteFormValues.qualityQuantity;
      const defect = partialCompleteFormValues.defectQuantity;

      // Валидация суммы
      if (quality + defect !== produced) {
        message.error('Сумма годных и брака должна равняться произведенному количеству');
        return;
      }

      // Информируем о сверхплановом производстве если применимо
      const currentProduced = selectedTask.producedQuantity || 0;
      const remainingQuantity = selectedTask.requestedQuantity - currentProduced;
      if (produced > remainingQuantity) {
        const overproduction = produced - remainingQuantity;
        message.info(`Будет произведено ${overproduction} шт. сверх плана. Излишки добавятся в остатки товара.`);
      }

      // Подготовка данных для отправки
      const result = await partialCompleteTask(selectedTask.id, {
        producedQuantity: produced,
        qualityQuantity: quality,
        defectQuantity: defect,
        notes: values.notes
      });

      // Показываем детальную информацию о результате
      message.success(result.message);
      
      // Дополнительные уведомления о сверхплановом производстве
      if (result.data.overproductionQuality && result.data.overproductionQuality > 0) {
        message.info(`Сверхплановое производство: ${result.data.overproductionQuality} шт. добавлено в остатки товара`, 5);
      }
      
      if (result.data.wasCompleted) {
        message.success(`Задание полностью выполнено!`, 3);
      }

      setPartialCompleteModalVisible(false);
      setSelectedTask(null);
      partialCompleteForm.resetFields();
      setPartialCompleteFormValues({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Массовая регистрация выпуска продукции (WBS 2 - Adjustments Задача 4.2)
  const handleBulkRegister = async (values: any) => {
    try {
      // Валидация: все строки должны быть заполнены
      const validItems = bulkRegisterItems.filter(item => 
        item.article.trim() !== '' && item.producedQuantity > 0
      );

      if (validItems.length === 0) {
        message.error('Добавьте хотя бы один товар для регистрации');
        return;
      }

      // Валидация сумм для каждого товара
      for (const item of validItems) {
        if (item.qualityQuantity + item.defectQuantity !== item.producedQuantity) {
          message.error(`Для артикула ${item.article}: сумма годных и брака должна равняться произведенному количеству`);
          return;
        }
      }

      // Подготовка данных для API
      const requestData = {
        items: validItems.map(item => ({
          article: item.article.trim(),
          producedQuantity: item.producedQuantity,
          qualityQuantity: item.qualityQuantity,
          defectQuantity: item.defectQuantity
        })),
        productionDate: values.productionDate?.format ? values.productionDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes?.trim() || undefined
      };

      const result = await bulkRegisterProduction(requestData);
      
      if (result.success) {
        // Показываем детальные результаты
        const successCount = result.data.filter(r => r.status === 'success').length;
        const warningCount = result.data.filter(r => r.status === 'warning').length;
        const errorCount = result.data.filter(r => r.status === 'error').length;

        let modalContent = (
          <div>
            <p><strong>Результаты обработки:</strong></p>
            {successCount > 0 && <p style={{ color: '#52c41a' }}>✅ Успешно: {successCount} позиций</p>}
            {warningCount > 0 && <p style={{ color: '#faad14' }}>⚠️ С предупреждениями: {warningCount} позиций</p>}
            {errorCount > 0 && <p style={{ color: '#ff4d4f' }}>❌ Ошибки: {errorCount} позиций</p>}
            
            <div style={{ marginTop: 16, maxHeight: 200, overflowY: 'auto' }}>
              {result.data.map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <strong>{item.article}:</strong> {item.message}
                </div>
              ))}
            </div>
          </div>
        );

        Modal.success({
          title: 'Массовая регистрация завершена',
          content: modalContent,
          width: 600
        });

        setBulkRegisterModalVisible(false);
        bulkRegisterForm.resetFields();
        setBulkRegisterItems([{ id: 1, article: '', producedQuantity: 10, qualityQuantity: 10, defectQuantity: 0 }]);
        loadTasks();
        loadTasksByProduct();
      } else {
        message.error(result.message || 'Ошибка массовой регистрации');
      }
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Обработчик для массового завершения заданий по товару
  const handleCompleteByProduct = (productTasks: TasksByProduct) => {
    setSelectedProductForCompletion(productTasks);
    const initialValues = {
      producedQuantity: productTasks.totalQuantity,
      qualityQuantity: productTasks.totalQuantity,
      defectQuantity: 0,
      productionDate: new Date(),
      notes: ''
    };
    completeByProductForm.setFieldsValue(initialValues);
    setCompleteByProductModalVisible(true);
  };

  // Завершение заданий по товару
  const handleCompleteTasksByProduct = async (values: any) => {
    if (!selectedProductForCompletion) return;

    try {
      const { producedQuantity, qualityQuantity, defectQuantity, productionDate, notes } = values;

      // Валидация суммы
      if (qualityQuantity + defectQuantity !== producedQuantity) {
        message.error('Сумма годных и брака должна равняться произведенному количеству');
        return;
      }

      // Подготовка данных для API
      const requestData = {
        productId: selectedProductForCompletion.product.id,
        producedQuantity,
        qualityQuantity,
        defectQuantity,
        productionDate: productionDate?.format ? productionDate.format('YYYY-MM-DD') : productionDate,
        notes
      };

      // Отправляем запрос к API
      const result = await completeTasksByProduct(requestData);
      
      if (result.success) {
        message.success(`Произведено ${producedQuantity} шт. товара "${selectedProductForCompletion.product.name}"`);
      } else {
        message.error(result.message || 'Ошибка завершения заданий');
        return;
      }
      setCompleteByProductModalVisible(false);
      setSelectedProductForCompletion(null);
      completeByProductForm.resetFields();
      loadTasks();
      loadTasksByProduct();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Создание нового задания
  const handleCreateTask = async (values: any) => {
    try {
      // Используем createProductionTask API для создания задания
      const taskData: any = {
        productId: values.productId,
        requestedQuantity: values.requestedQuantity,
        priority: values.priority || 3,
        notes: values.notes,
        assignedTo: values.assignedTo
      };
      
      // Добавляем orderId только если он указан
      if (values.orderId) {
        taskData.orderId = values.orderId;
      }

      // Добавляем планирование выполнения если указано
      if (values.plannedDate) {
        taskData.plannedDate = values.plannedDate.format('YYYY-MM-DD');
      }
      
      if (values.plannedStartTime) {
        taskData.plannedStartTime = values.plannedStartTime;
      }

      const result = await createProductionTask(taskData);
      
      if (result.success) {
        message.success('Производственное задание создано');
        setCreateTaskModalVisible(false);
        createTaskForm.resetFields();
        loadTasks();
        
        // Если задание запланировано, показываем дополнительное сообщение
        if (values.plannedDate) {
          const dateStr = values.plannedDate.format('DD.MM.YYYY');
          const timeStr = values.plannedStartTime ? ` в ${values.plannedStartTime}` : '';
          message.info(`Задание запланировано на ${dateStr}${timeStr}`);
        }
      } else {
        message.error(result.message || 'Ошибка создания задания');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      message.error('Ошибка создания задания');
    }
  };

  // Функция экспорта производственных заданий (Задача 9.2)
  const handleExportTasks = async () => {
    setExportingTasks(true);
    try {
      // Формируем фильтры на основе текущих настроек
      const currentFilters: any = {
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      await exportProductionTasks(currentFilters);
      
      message.success('Экспорт производственных заданий завершен');
      
    } catch (error: any) {
      console.error('Error exporting production tasks:', error);
      message.error('Ошибка при экспорте производственных заданий');
    } finally {
      setExportingTasks(false);
    }
  };

  // Получение цвета статуса
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'blue',
      in_progress: 'cyan',
      completed: 'purple',
      cancelled: 'gray',
      paused: 'orange'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  // Получение названия статуса
  const getStatusName = (status: string) => {
    const names = {
      pending: 'Ожидает',
      in_progress: 'В работе',
      completed: 'Завершено',
      cancelled: 'Отменено',
      paused: 'На паузе'
    };
    return names[status as keyof typeof names] || status;
  };

  // Колонки для таблицы заданий
  const taskColumns = [
    {
      title: '',
      key: 'drag',
      width: 40,
      render: () => (
        <DragOutlined style={{ cursor: 'grab', color: '#999' }} />
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Заказ',
      key: 'order',
      render: (record: ProductionTask) => {
        if (!record) return null;
        if (!record.orderId || !record.order) {
          return (
            <Text type="secondary" style={{ fontStyle: 'italic' }}>
              Задание на будущее
            </Text>
          );
        }
        return (
          <div>
            <div>№{record.order.orderNumber}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.order.customerName}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Товар',
      dataIndex: 'product',
      key: 'product',
      render: (product: any) => (
        <div>
          <div>{product.name}</div>
          {product.code && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {product.code}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Количество',
      key: 'quantity',
      render: (record: ProductionTask) => {
        const requested = record.requestedQuantity;
        const produced = record.producedQuantity || 0;
        const remaining = requested - produced;
        const progressPercent = Math.round((produced / requested) * 100);
        
        return (
          <div>
            <div>
              <strong>Запрошено:</strong> {requested} шт
            </div>
            {produced > 0 && (
              <>
                <div style={{ color: '#52c41a' }}>
                  <strong>Произведено:</strong> {produced} шт ({progressPercent}%)
                </div>
                {remaining > 0 && (
                  <div style={{ color: '#faad14' }}>
                    <strong>Осталось:</strong> {remaining} шт
                  </div>
                )}
                {remaining === 0 && (
                  <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    ✅ Выполнено полностью
                  </div>
                )}
              </>
            )}
            {produced === 0 && (
              <Text type="secondary" style={{ fontStyle: 'italic' }}>
                Производство не начато
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'blue', text: 'Ожидает' },
          in_progress: { color: 'processing', text: 'В работе' },
          completed: { color: 'success', text: 'Завершено' },
          cancelled: { color: 'error', text: 'Отменено' },
          paused: { color: 'orange', text: 'На паузе' }
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config?.color}>{config?.text || status}</Tag>;
      },
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => (
        <Tag color={priority <= 2 ? 'red' : priority <= 4 ? 'orange' : 'green'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Планируемая дата',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      width: 120,
      render: (plannedDate: string) => {
        if (!plannedDate) {
          return <Text type="secondary" style={{ fontStyle: 'italic' }}>Не запланировано</Text>;
        }
        const date = dayjs(plannedDate);
        const today = dayjs().startOf('day');
        const taskDate = date.startOf('day');
        
        let color = '';
        let icon = null;
        
        if (taskDate.isBefore(today)) {
          color = '#ff4d4f'; // красный для просроченных
          icon = <ClockCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />;
        } else if (taskDate.isSame(today)) {
          color = '#1890ff'; // синий для сегодняшних
          icon = <CalendarOutlined style={{ color: '#1890ff', marginRight: 4 }} />;
        } else if (taskDate.isSame(today.add(1, 'day'))) {
          color = '#faad14'; // оранжевый для завтрашних
          icon = <CalendarOutlined style={{ color: '#faad14', marginRight: 4 }} />;
        } else {
          color = '#52c41a'; // зеленый для будущих
          icon = <CalendarOutlined style={{ color: '#52c41a', marginRight: 4 }} />;
        }
        
        return (
          <div style={{ color }}>
            {icon}
            <span style={{ fontSize: '12px' }}>
              {date.format('DD.MM.YYYY')}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (record: ProductionTask) => (
        <Space size="small">
          {record.status === 'pending' && (
            <>
              <Tooltip title="Просмотр деталей">
                <Button
                  type="default"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewTask(record)}
                />
              </Tooltip>
              <Tooltip title="Редактировать задание">
                <Button
                  type="default"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditTask(record)}
                />
              </Tooltip>
              <Tooltip title="Удалить задание">
                <Button
                  type="default"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleDeleteTask(record)}
                />
              </Tooltip>
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartTask(record)}
              >
                Начать
              </Button>
              <Button
                type="default"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedTask(record);
                  const currentProduced = record.producedQuantity || 0;
                  const remainingQuantity = record.requestedQuantity - currentProduced;
                  const defaultProduced = Math.min(remainingQuantity, 10); // По умолчанию 10 или остаток
                  setPartialCompleteFormValues({
                    producedQuantity: defaultProduced,
                    qualityQuantity: defaultProduced,
                    defectQuantity: 0
                  });
                  partialCompleteForm.setFieldsValue({
                    producedQuantity: defaultProduced,
                    qualityQuantity: defaultProduced,
                    defectQuantity: 0
                  });
                  setPartialCompleteModalVisible(true);
                }}
                style={{ marginLeft: 8 }}
              >
                Зарегистрировать выпуск
              </Button>
            </>
          )}
          
          {record.status === 'in_progress' && (
            <>
              <Tooltip title="Просмотр деталей">
                <Button
                  type="default"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewTask(record)}
                />
              </Tooltip>
              <Tooltip title="Редактировать задание">
                <Button
                  type="default"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditTask(record)}
                />
              </Tooltip>
              <Button
                type="primary"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePauseTask(record)}
              >
                На паузу
              </Button>
              <Button
                type="default"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedTask(record);
                  const currentProduced = record.producedQuantity || 0;
                  const remainingQuantity = record.requestedQuantity - currentProduced;
                  const defaultProduced = Math.min(remainingQuantity, 10); // По умолчанию 10 или остаток
                  setPartialCompleteFormValues({
                    producedQuantity: defaultProduced,
                    qualityQuantity: defaultProduced,
                    defectQuantity: 0
                  });
                  partialCompleteForm.setFieldsValue({
                    producedQuantity: defaultProduced,
                    qualityQuantity: defaultProduced,
                    defectQuantity: 0
                  });
                  setPartialCompleteModalVisible(true);
                }}
                style={{ marginRight: 8 }}
              >
                Зарегистрировать выпуск
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setSelectedTask(record);
                  const initialProduced = record.requestedQuantity;
                  const initialValues = {
                    producedQuantity: initialProduced,
                    qualityQuantity: initialProduced,
                    defectQuantity: 0
                  };
                  setCompleteFormValues(initialValues);
                  completeForm.setFieldsValue(initialValues);
                  setCompleteModalVisible(true);
                }}
              >
                Завершить
              </Button>
            </>
          )}
          
          {record.status === 'paused' && (
            <>
              <Tooltip title="Просмотр деталей">
                <Button
                  type="default"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewTask(record)}
                />
              </Tooltip>
              <Tooltip title="Редактировать задание">
                <Button
                  type="default"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditTask(record)}
                />
              </Tooltip>
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleResumeTask(record)}
              >
                Возобновить
              </Button>
            </>
          )}

          {record.status === 'completed' && (
            <Tooltip title="Просмотр деталей">
              <Button
                type="default"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewTask(record)}
              >
                Просмотр
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Колонки для таблицы по товарам
  const productColumns = [
    {
      title: 'Товар',
      key: 'product',
      render: (record: TasksByProduct) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.product.name}</div>
          {record.product.sku && (
            <Text type="secondary">{record.product.sku}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Общее количество',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (quantity: number) => (
        <Text strong style={{ fontSize: '16px' }}>{quantity}</Text>
      ),
    },
    {
      title: 'Количество заданий',
      key: 'taskCount',
      render: (record: TasksByProduct) => record.tasks.length,
    },
    {
      title: 'Статусы',
      key: 'statuses',
      render: (record: TasksByProduct) => {
        const statusCounts = record.tasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (
          <Space>
            {Object.entries(statusCounts).map(([status, count]) => (
              <Tag key={status} color={getStatusColor(status)}>
                {getStatusName(status)}: {count}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (record: TasksByProduct) => {
        const hasActiveTasks = record.tasks.some(task => 
          task.status === 'pending' || task.status === 'in_progress'
        );
        
        return (
          <Space>
            {hasActiveTasks && canManage('production') && (
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleCompleteByProduct(record)}
              >
                Указать произведенное
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <App>
      <div style={{ padding: '24px' }}>
        <Title level={2}>Производственные задания</Title>
      
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={5}>
          <Card>
            <Statistic
              title="Предложено"
              value={stats.pending}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="В производстве"
              value={stats.inProgress}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="На паузе"
              value={stats.paused}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="Завершено"
              value={stats.completed}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Отменено"
              value={stats.cancelled}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Фильтры по статусу */}
      <Card style={{ marginBottom: '16px' }}>
        <Title level={5}>Фильтры</Title>
        <Space wrap>
          <Button
            type={statusFilter === 'all' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('all')}
          >
            Все ({stats.pending + stats.inProgress + stats.paused + stats.completed + stats.cancelled})
          </Button>
          <Button
            type={statusFilter === 'pending' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('pending')}
            style={{
              backgroundColor: statusFilter === 'pending' ? '#faad14' : undefined,
              borderColor: '#faad14',
              color: statusFilter === 'pending' ? '#fff' : '#faad14'
            }}
          >
            Ожидает ({stats.pending})
          </Button>
          <Button
            type={statusFilter === 'in_progress' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('in_progress')}
            style={{
              backgroundColor: statusFilter === 'in_progress' ? '#1890ff' : undefined,
              borderColor: '#1890ff',
              color: statusFilter === 'in_progress' ? '#fff' : '#1890ff'
            }}
          >
            В работе ({stats.inProgress})
          </Button>
          <Button
            type={statusFilter === 'paused' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('paused')}
            style={{
              backgroundColor: statusFilter === 'paused' ? '#fa8c16' : undefined,
              borderColor: '#fa8c16',
              color: statusFilter === 'paused' ? '#fff' : '#fa8c16'
            }}
          >
            На паузе ({stats.paused})
          </Button>
          <Button
            type={statusFilter === 'completed' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('completed')}
            style={{
              backgroundColor: statusFilter === 'completed' ? '#52c41a' : undefined,
              borderColor: '#52c41a',
              color: statusFilter === 'completed' ? '#fff' : '#52c41a'
            }}
          >
            Завершено ({stats.completed})
          </Button>
          <Button
            type={statusFilter === 'cancelled' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('cancelled')}
            style={{
              backgroundColor: statusFilter === 'cancelled' ? '#f5222d' : undefined,
              borderColor: '#f5222d',
              color: statusFilter === 'cancelled' ? '#fff' : '#f5222d'
            }}
          >
            Отменено ({stats.cancelled})
          </Button>
          
          {/* Кнопка экспорта производственных заданий (Задача 9.2) */}
          <Button
            onClick={handleExportTasks}
            loading={exportingTasks}
            style={{
              marginLeft: '16px',
              borderColor: '#722ed1',
              color: '#722ed1'
            }}
            title="Экспорт текущего списка производственных заданий с примененными фильтрами"
          >
            📊 Экспорт заданий
          </Button>
        </Space>
      </Card>

      {/* Панель управления системой */}
      <Card style={{ marginBottom: '24px' }}>
        <Title level={4}>Управление системой</Title>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createTaskForm.setFieldsValue({ assignedTo: user?.id });
              setCreateTaskModalVisible(true);
            }}
          >
            Создать задание
          </Button>
          <Button
            type="default"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setBulkRegisterModalVisible(true);
              bulkRegisterForm.setFieldsValue({
                productionDate: new Date()
              });
              loadBulkRegisterProducts(); // Загружаем товары при открытии модального окна
            }}
          >
            Зарегистрировать выпуск продукции
          </Button>
        </Space>
      </Card>

      {/* Основное содержимое */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={handleTabChange}
          items={[
            {
              key: 'list',
              label: 'Планирование заданий',
              children: (() => {
                const groupedTasks = groupTasksByDays(filteredTasks);
                return (
                  <div>
                    {/* Просроченные задания */}
                    {renderTaskGroup(
                      "Просроченные",
                      groupedTasks.overdue,
                      "#ff4d4f",
                      <ExclamationCircleOutlined />,
                      "Требуют немедленного внимания"
                    )}

                    {/* Задания на сегодня */}
                    {renderTaskGroup(
                      "Сегодня",
                      groupedTasks.today,
                      "#52c41a",
                      <CalendarOutlined />,
                      dayjs().format('DD.MM.YYYY')
                    )}

                    {/* Задания на завтра */}
                    {renderTaskGroup(
                      "Завтра",
                      groupedTasks.tomorrow,
                      "#1890ff",
                      <CalendarOutlined />,
                      dayjs().add(1, 'day').format('DD.MM.YYYY')
                    )}

                    {/* Задания на дальние даты */}
                    {renderTaskGroup(
                      "Запланированные",
                      groupedTasks.later,
                      "#722ed1",
                      <ClockCircleOutlined />,
                      "На будущие даты"
                    )}

                    {/* Незапланированные задания */}
                    {renderTaskGroup(
                      "Без плана",
                      groupedTasks.unplanned,
                      "#8c8c8c",
                      <QuestionCircleOutlined />,
                      "Требуют планирования"
                    )}

                    {/* Завершенные задания */}
                    {renderTaskGroup(
                      "Готовые",
                      groupedTasks.completed,
                      "#52c41a",
                      <CheckCircleOutlined />,
                      "Выполненные задания"
                    )}

                    {/* Если нет заданий вообще */}
                    {filteredTasks.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '60px 20px',
                        color: '#999'
                      }}>
                        <CalendarOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                        <div>Нет производственных заданий</div>
                        <div style={{ marginTop: '8px' }}>
                          Создайте первое задание для планирования производства
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            },
            {
              key: 'by-product',
              label: 'По товарам',
              children: (
                <Table
                  columns={productColumns}
                  dataSource={tasksByProduct}
                  rowKey={(record) => record.product.id}
                  loading={loading}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table
                        columns={taskColumns}
                        dataSource={record.tasks}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    ),
                    rowExpandable: (record) => record.tasks.length > 0,
                  }}
                />
              )
            },
            {
              key: 'calendar',
              label: 'Календарь',
              children: (
                <ProductionCalendar 
                  tasks={tasks}
                  onTaskUpdate={loadTasks}
                />
              )
            },
            {
              key: 'statistics',
              label: 'Статистика',
              children: (
                <ProductionStatistics />
              )
            }
          ]}
        />
      </Card>

      {/* Модал подтверждения задания */}
      <Modal
        title="Подтвердить производственное задание"
        open={approveModalVisible}
        onCancel={() => {
          setApproveModalVisible(false);
          setSelectedTask(null);
          approveForm.resetFields();
        }}
        footer={null}
      >
        {selectedTask && (
          <Form
            form={approveForm}
            layout="vertical"
            onFinish={handleUpdateTask}
          >
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Заказ:</Text> #{selectedTask.orderId} - {selectedTask.order?.customerName}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Товар:</Text> {selectedTask.product?.name}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Запрошенное количество:</Text> {selectedTask.requestedQuantity}
            </div>
            
            <Form.Item
              name="approvedQuantity"
              label="Подтвержденное количество"
              rules={[
                { required: true, message: 'Введите количество' },
                { type: 'number', min: 1, message: 'Количество должно быть больше 0' }
              ]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="notes"
              label="Комментарий"
            >
              <TextArea rows={3} placeholder="Дополнительные заметки..." />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Подтвердить
                </Button>
                <Button onClick={() => {
                  setApproveModalVisible(false);
                  setSelectedTask(null);
                  approveForm.resetFields();
                }}>
                  Отмена
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Модал завершения задания */}
      <Modal
        title="Завершить производственное задание"
        open={completeModalVisible}
        onCancel={() => {
          setCompleteModalVisible(false);
          setSelectedTask(null);
          completeForm.resetFields();
          setCompleteFormValues({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });
        }}
        footer={null}
        width={700}
      >
        {selectedTask && (
          <Form
            form={completeForm}
            layout="vertical"
            onFinish={handleCompleteTask}
          >
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Заказ:</Text> #{selectedTask.orderId} - {selectedTask.order?.customerName}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Товар:</Text> {selectedTask.product?.name}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Подтвержденное количество:</Text> {selectedTask.requestedQuantity}
            </div>

            <Alert 
              message="Важно: Произведено = Качественных + Бракованных" 
              description="Поля автоматически пересчитываются для соблюдения этого правила"
              type="info" 
              showIcon 
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="producedQuantity"
                  label="Произведено всего"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 0, message: 'Количество не может быть отрицательным' }
                  ]}
                >
                  <InputNumber 
                    min={0} 
                    style={{ width: '100%' }}
                    placeholder="Общее количество"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="qualityQuantity"
                  label="Качественных"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 0, message: 'Количество не может быть отрицательным' }
                  ]}
                >
                  <InputNumber 
                    min={0} 
                    style={{ width: '100%' }}
                    placeholder="Годных изделий"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="defectQuantity"
                  label="Бракованных"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 0, message: 'Количество не может быть отрицательным' }
                  ]}
                >
                  <InputNumber 
                    min={0} 
                    style={{ width: '100%' }}
                    placeholder="Количество брака"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Показываем сумму для проверки */}
            <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
              <Text type="secondary">
                Проверка: {completeFormValues.qualityQuantity} + {completeFormValues.defectQuantity} = {completeFormValues.qualityQuantity + completeFormValues.defectQuantity}
                {completeFormValues.qualityQuantity + completeFormValues.defectQuantity === completeFormValues.producedQuantity 
                  ? ' ✅' 
                  : ' ❌ Не совпадает с произведенным количеством'}
              </Text>
            </div>

            <Form.Item
              name="notes"
              label="Комментарий к завершению"
            >
              <TextArea rows={3} placeholder="Заметки о производстве..." />
            </Form.Item>

            <Divider>Дополнительные товары</Divider>
            
            <Form.List name="extras">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={16} align="middle">
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'productId']}
                          label="Товар"
                          rules={[{ required: true, message: 'Выберите товар' }]}
                        >
                          <Select placeholder="Выберите товар">
                            {products.map(product => (
                              <Option key={product.id} value={product.id}>
                                {product.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'quantity']}
                          label="Количество"
                          rules={[{ required: true, message: 'Введите количество' }]}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'notes']}
                          label="Комментарий"
                        >
                          <Input placeholder="Заметки..." />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button 
                          type="link" 
                          danger 
                          onClick={() => remove(name)}
                        >
                          Удалить
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      icon={<PlusOutlined />}
                      style={{ width: '100%' }}
                    >
                      Добавить дополнительный товар
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Завершить задание
                </Button>
                <Button onClick={() => {
                  setCompleteModalVisible(false);
                  setSelectedTask(null);
                  completeForm.resetFields();
                  setCompleteFormValues({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });
                }}>
                  Отмена
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Модал создания нового задания */}
      <Modal
        title="Создать производственное задание"
        open={createTaskModalVisible}
        onCancel={() => {
          setCreateTaskModalVisible(false);
          createTaskForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createTaskForm}
          layout="vertical"
          onFinish={handleCreateTask}
        >
          <Form.Item
            name="orderId"
            label="Заказ (необязательно)"
            help="Можно создать задание без привязки к заказу - на будущее"
          >
            <Select
              placeholder="Выберите заказ или оставьте пустым"
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {orders.map(order => (
                <Option key={order.id} value={order.id}>
                  №{order.orderNumber} - {order.customerName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="productId"
            label="Товар"
            rules={[{ required: true, message: 'Выберите товар' }]}
          >
            <Select
              placeholder="Выберите товар"
              showSearch
              optionFilterProp="children"
            >
              {products.map(product => (
                <Option key={product.id} value={product.id}>
                  {product.name} {product.sku && `(${product.sku})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="requestedQuantity"
                label="Количество"
                rules={[
                  { required: true, message: 'Введите количество' },
                  { type: 'number', min: 1, message: 'Количество должно быть больше 0' }
                ]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="Приоритет"
                initialValue={3}
              >
                <Select>
                  <Option value={1}>1 - Низкий</Option>
                  <Option value={2}>2 - Ниже среднего</Option>
                  <Option value={3}>3 - Средний</Option>
                  <Option value={4}>4 - Высокий</Option>
                  <Option value={5}>5 - Критический</Option>
                </Select>
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
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.fullName} (@{user.username})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider />
          
          <Title level={5}>Планирование выполнения</Title>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plannedDate"
                label="Планируемая дата выполнения"
                help="Задание будет отображено в календаре на выбранную дату"
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="Выберите дату"
                  format="DD.MM.YYYY"
                  disabledDate={(current: Dayjs) => {
                    // Запрещаем выбор прошедших дат
                    return current && current.isBefore(dayjs().startOf('day'));
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="plannedStartTime"
                label="Планируемое время начала"
                help="Время в формате ЧЧ:ММ (необязательно)"
              >
                <Input 
                  placeholder="09:00"
                  style={{ width: '100%' }}
                  maxLength={5}
                  onChange={(e) => {
                    // Автоформатирование ввода времени
                    let value = e.target.value.replace(/[^\d]/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + ':' + value.slice(2, 4);
                    }
                    e.target.value = value;
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Примечания"
          >
            <TextArea rows={3} placeholder="Дополнительная информация..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Создать задание
              </Button>
              <Button onClick={() => {
                setCreateTaskModalVisible(false);
                createTaskForm.resetFields();
              }}>
                Отмена
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модал массового завершения заданий по товару */}
      <Modal
        title="Указать произведенное количество"
        open={completeByProductModalVisible}
        onCancel={() => {
          setCompleteByProductModalVisible(false);
          setSelectedProductForCompletion(null);
          completeByProductForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        {selectedProductForCompletion && (
          <Form
            form={completeByProductForm}
            layout="vertical"
            onFinish={handleCompleteTasksByProduct}
          >
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f2f5', borderRadius: '4px' }}>
              <Text strong>Товар:</Text> {selectedProductForCompletion.product.name}
              <br />
              <Text strong>Всего заданий:</Text> {selectedProductForCompletion.tasks.length}
              <br />
              <Text strong>Общее количество в заданиях:</Text> {selectedProductForCompletion.totalQuantity} шт
            </div>

            <Alert 
              message="Произведенное количество может отличаться от запланированного" 
              description="Система автоматически распределит произведенное количество по заданиям в порядке приоритета"
              type="info" 
              showIcon 
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="producedQuantity"
                  label="Произведено всего"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 1, message: 'Количество должно быть больше 0' }
                  ]}
                  initialValue={selectedProductForCompletion.totalQuantity}
                >
                  <InputNumber 
                    min={1} 
                    style={{ width: '100%' }}
                    placeholder="Общее количество"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="qualityQuantity"
                  label="Качественных"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 0, message: 'Количество не может быть отрицательным' }
                  ]}
                  initialValue={selectedProductForCompletion.totalQuantity}
                >
                  <InputNumber 
                    min={0} 
                    style={{ width: '100%' }}
                    placeholder="Годных изделий"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="defectQuantity"
                  label="Бракованных"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 0, message: 'Количество не может быть отрицательным' }
                  ]}
                  initialValue={0}
                >
                  <InputNumber 
                    min={0} 
                    style={{ width: '100%' }}
                    placeholder="Количество брака"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="productionDate"
              label="Дата производства"
              initialValue={new Date()}
            >
              <Input 
                type="date" 
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="notes"
              label="Комментарий к производству"
            >
              <TextArea rows={3} placeholder="Заметки о производстве..." />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Указать произведенное
                </Button>
                <Button onClick={() => {
                  setCompleteByProductModalVisible(false);
                  setSelectedProductForCompletion(null);
                  completeByProductForm.resetFields();
                }}>
                  Отмена
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Модальное окно редактирования задания */}
      <Modal
        title="Редактировать производственное задание"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingTask(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        {editingTask && (
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleUpdateTask}
          >
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Заказ:</Text> {editingTask.orderId ? `#${editingTask.order?.orderNumber} - ${editingTask.order?.customerName}` : 'Задание на будущее'}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Товар:</Text> {editingTask.product?.name}
            </div>
            
            <Form.Item
              name="requestedQuantity"
              label="Запрошенное количество"
              rules={[
                { required: true, message: 'Введите количество' },
                { type: 'number', min: 1, message: 'Количество должно быть больше 0' }
              ]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="priority"
              label="Приоритет"
            >
              <Select placeholder="Выберите приоритет">
                <Option value={1}>1 - Низкий</Option>
                <Option value={2}>2 - Ниже среднего</Option>
                <Option value={3}>3 - Средний</Option>
                <Option value={4}>4 - Высокий</Option>
                <Option value={5}>5 - Критический</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="assignedTo"
              label="Назначить на"
            >
              <Select
                placeholder="Выберите исполнителя"
                allowClear
              >
                {users.map(user => (
                  <Option key={user.id} value={user.id}>
                    {user.fullName} (@{user.username})
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="plannedDate"
              label="Планируемая дата выполнения"
              help="Дата планирования задания"
            >
              <DatePicker 
                style={{ width: '100%' }}
                placeholder="Выберите дату"
                format="DD.MM.YYYY"
              />
            </Form.Item>

            <Form.Item
              name="notes"
              label="Примечания"
            >
              <TextArea rows={3} placeholder="Дополнительная информация..." />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Сохранить изменения
                </Button>
                <Button onClick={() => {
                  setEditModalVisible(false);
                  setEditingTask(null);
                  editForm.resetFields();
                }}>
                  Отмена
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Модальное окно для частичного выполнения задания (WBS 2 - Adjustments Задача 4.1) */}
      {selectedTask && partialCompleteModalVisible && (
        <Modal
          title={
            <div>
              <PlusOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              Зарегистрировать выпуск продукции
            </div>
          }
          open={partialCompleteModalVisible}
          onCancel={() => {
            setPartialCompleteModalVisible(false);
            setSelectedTask(null);
            partialCompleteForm.resetFields();
            setPartialCompleteFormValues({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });
          }}
          footer={null}
          width={600}
        >
          <div style={{ marginBottom: 16 }}>
            <Alert
              message={
                <div>
                  <strong>Задание:</strong> {selectedTask.product.name}<br/>
                  <strong>Запрошено:</strong> {selectedTask.requestedQuantity} шт.<br/>
                  <strong>Уже произведено:</strong> {selectedTask.producedQuantity || 0} шт.<br/>
                  <strong>Осталось произвести:</strong> {selectedTask.requestedQuantity - (selectedTask.producedQuantity || 0)} шт.
                </div>
              }
              description="Вы можете произвести любое количество. Если больше чем нужно - излишки добавятся в остатки товара."
              type="info"
              showIcon
            />
          </div>
          
          <Form
            form={partialCompleteForm}
            layout="vertical"
            onFinish={handlePartialCompleteTask}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="producedQuantity"
                  label="Произведено (шт)"
                  help="Можно указать любое количество. Если больше запланированного - излишки добавятся в остатки"
                  rules={[
                    { required: true, message: 'Укажите количество' },
                    { type: 'number', min: 1, message: 'Минимум 1 шт' }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={partialCompleteFormValues.producedQuantity}
                    onChange={(value) => {
                      const produced = value || 0;
                      setPartialCompleteFormValues(prev => ({
                        ...prev,
                        producedQuantity: produced,
                        qualityQuantity: produced,
                        defectQuantity: 0
                      }));
                      partialCompleteForm.setFieldsValue({
                        qualityQuantity: produced,
                        defectQuantity: 0
                      });
                    }}
                    min={1}
                    placeholder="Укажите количество"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="qualityQuantity"
                  label="Годных (шт)"
                  rules={[
                    { required: true, message: 'Укажите количество годных' },
                    { type: 'number', min: 0, message: 'Не может быть отрицательным' }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={partialCompleteFormValues.qualityQuantity}
                    onChange={(value) => {
                      const quality = value || 0;
                      const defect = partialCompleteFormValues.producedQuantity - quality;
                      setPartialCompleteFormValues(prev => ({
                        ...prev,
                        qualityQuantity: quality,
                        defectQuantity: Math.max(0, defect)
                      }));
                      partialCompleteForm.setFieldValue('defectQuantity', Math.max(0, defect));
                    }}
                    min={0}
                    max={partialCompleteFormValues.producedQuantity}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="defectQuantity"
                  label="Брак (шт)"
                  rules={[
                    { required: true, message: 'Укажите количество брака' },
                    { type: 'number', min: 0, message: 'Не может быть отрицательным' }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={partialCompleteFormValues.defectQuantity}
                    onChange={(value) => {
                      const defect = value || 0;
                      const quality = partialCompleteFormValues.producedQuantity - defect;
                      setPartialCompleteFormValues(prev => ({
                        ...prev,
                        defectQuantity: defect,
                        qualityQuantity: Math.max(0, quality)
                      }));
                      partialCompleteForm.setFieldValue('qualityQuantity', Math.max(0, quality));
                    }}
                    min={0}
                    max={partialCompleteFormValues.producedQuantity}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row>
              <Col span={24}>
                <div style={{ marginBottom: 8, fontSize: '14px', color: '#666' }}>
                  Проверка: {partialCompleteFormValues.qualityQuantity + partialCompleteFormValues.defectQuantity === partialCompleteFormValues.producedQuantity ? 
                    '✅ Сумма сходится' : 
                    '❌ Сумма годных и брака должна равняться произведенному количеству'
                  }
                </div>
              </Col>
            </Row>

            <Form.Item
              name="notes"
              label="Примечания"
            >
              <Input.TextArea
                rows={3}
                placeholder="Комментарий к выпуску продукции..."
                maxLength={500}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button 
                  onClick={() => {
                    setPartialCompleteModalVisible(false);
                    setSelectedTask(null);
                    partialCompleteForm.resetFields();
                    setPartialCompleteFormValues({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });
                  }}
                >
                  Отмена
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<PlusOutlined />}
                  disabled={partialCompleteFormValues.qualityQuantity + partialCompleteFormValues.defectQuantity !== partialCompleteFormValues.producedQuantity}
                >
                  Зарегистрировать выпуск
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* Модальное окно для массовой регистрации выпуска продукции (WBS 2 - Adjustments Задача 4.2) */}
      <Modal
        title={
          <div>
            <CheckCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
            Массовая регистрация выпуска продукции
          </div>
        }
        open={bulkRegisterModalVisible}
        onCancel={() => {
          setBulkRegisterModalVisible(false);
          bulkRegisterForm.resetFields();
          setBulkRegisterItems([{ id: 1, article: '', producedQuantity: 10, qualityQuantity: 10, defectQuantity: 0 }]);
        }}
        footer={null}
        width={1000}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Укажите артикулы и количества произведенных товаров за смену. Система автоматически распределит их по активным заданиям в порядке приоритета."
            type="info"
            showIcon
          />
        </div>

        <Form
          form={bulkRegisterForm}
          layout="vertical"
          onFinish={handleBulkRegister}
        >
          {/* Динамическая таблица товаров */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Произведенные товары:</Text>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => {
                  const newId = Math.max(...bulkRegisterItems.map(item => item.id)) + 1;
                  setBulkRegisterItems([...bulkRegisterItems, {
                    id: newId,
                    article: '',
                    producedQuantity: 10,
                    qualityQuantity: 10,
                    defectQuantity: 0
                  }]);
                }}
              >
                Добавить товар
              </Button>
            </div>

            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <div style={{ display: 'flex', backgroundColor: '#fafafa', padding: '8px 12px', fontWeight: 'bold', borderBottom: '1px solid #d9d9d9' }}>
                <div style={{ flex: 3, paddingRight: 8 }}>Артикул</div>
                <div style={{ flex: 2, textAlign: 'center', paddingRight: 8 }}>Произведено</div>
                <div style={{ flex: 2, textAlign: 'center', paddingRight: 8 }}>Годных</div>
                <div style={{ flex: 2, textAlign: 'center', paddingRight: 8 }}>Брак</div>
                <div style={{ flex: 1, textAlign: 'center' }}>Действия</div>
              </div>

              {bulkRegisterItems.map((item, index) => (
                <div key={item.id} style={{ display: 'flex', padding: '12px', borderBottom: index < bulkRegisterItems.length - 1 ? '1px solid #f0f0f0' : 'none', alignItems: 'flex-start', minHeight: '80px' }}>
                  <div style={{ flex: 3, paddingRight: 8, wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    <Select
                      showSearch
                      placeholder="Выберите товар по артикулу"
                      value={item.productId ? item.article : undefined}
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        (option?.label?.toString().toLowerCase().includes(input.toLowerCase())) ?? false
                      }
                      style={{ width: '100%' }}
                      size="large"
                      dropdownStyle={{ maxHeight: 400, overflowY: 'auto' }}
                      optionRender={(option) => (
                        <div style={{ 
                          padding: '6px 8px',
                          minHeight: '50px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}>
                          <div style={{ 
                            fontSize: '11px',
                            color: '#1890ff',
                            fontFamily: 'monospace',
                            fontWeight: '500',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'normal',
                            lineHeight: '1.2'
                          }}>
                            {option.data.article}
                          </div>
                          <div style={{ 
                            fontSize: '10px',
                            color: '#666',
                            marginTop: '2px',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'normal'
                          }}>
                            {option.data.name}
                          </div>
                        </div>
                      )}
                      className="bulk-register-select"
                      optionLabelProp="label"
                      labelInValue={false}
                      getPopupContainer={(trigger) => trigger.parentElement}
                      allowClear
                      onSelect={(productId) => {
                        const product = bulkRegisterProducts.find(p => p.id === Number(productId));
                        if (product) {
                          const newItems = [...bulkRegisterItems];
                          newItems[index] = { 
                            ...item, 
                            productId: product.id,
                            article: product.article || '',
                            productName: product.name
                          };
                          setBulkRegisterItems(newItems);
                        }
                      }}
                      onChange={(value) => {
                        if (!value) {
                          const newItems = [...bulkRegisterItems];
                          newItems[index] = { 
                            ...item, 
                            article: '', 
                            productId: undefined,
                            productName: undefined 
                          };
                          setBulkRegisterItems(newItems);
                        }
                      }}
                    >
                      {bulkRegisterProducts.map(product => {
                        const label = product.article || product.name;
                        return (
                          <Option key={product.id} value={product.id} label={label} data={product}>
                            {product.article}
                          </Option>
                        );
                      })}
                    </Select>
                  </div>
                  <div style={{ flex: 2, paddingRight: 8 }}>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      value={item.producedQuantity}
                      onChange={(value) => {
                        const produced = value || 0;
                        const newItems = [...bulkRegisterItems];
                        newItems[index] = {
                          ...item,
                          producedQuantity: produced,
                          qualityQuantity: produced,
                          defectQuantity: 0
                        };
                        setBulkRegisterItems(newItems);
                      }}
                    />
                  </div>
                  <div style={{ flex: 2, paddingRight: 8 }}>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      max={item.producedQuantity}
                      value={item.qualityQuantity}
                      onChange={(value) => {
                        const quality = value || 0;
                        const defect = item.producedQuantity - quality;
                        const newItems = [...bulkRegisterItems];
                        newItems[index] = {
                          ...item,
                          qualityQuantity: quality,
                          defectQuantity: Math.max(0, defect)
                        };
                        setBulkRegisterItems(newItems);
                      }}
                    />
                  </div>
                  <div style={{ flex: 2, paddingRight: 8 }}>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      max={item.producedQuantity}
                      value={item.defectQuantity}
                      onChange={(value) => {
                        const defect = value || 0;
                        const quality = item.producedQuantity - defect;
                        const newItems = [...bulkRegisterItems];
                        newItems[index] = {
                          ...item,
                          defectQuantity: defect,
                          qualityQuantity: Math.max(0, quality)
                        };
                        setBulkRegisterItems(newItems);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    {bulkRegisterItems.length > 1 && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                          setBulkRegisterItems(bulkRegisterItems.filter(i => i.id !== item.id));
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Валидация сумм */}
            <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              {bulkRegisterItems.map((item, index) => {
                const isValid = item.qualityQuantity + item.defectQuantity === item.producedQuantity;
                const hasArticle = item.article.trim() !== '';
                
                if (!hasArticle || isValid) return null;
                
                return (
                  <div key={item.id} style={{ color: '#ff4d4f' }}>
                    Строка {index + 1}: Сумма годных и брака должна равняться произведенному количеству
                  </div>
                );
              })}
            </div>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="productionDate"
                label="Дата производства"
              >
                <Input 
                  type="date" 
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Общие примечания"
          >
            <Input.TextArea
              rows={3}
              placeholder="Комментарий к смене..."
              maxLength={500}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button 
                onClick={() => {
                  setBulkRegisterModalVisible(false);
                  bulkRegisterForm.resetFields();
                  setBulkRegisterItems([{ id: 1, article: '', producedQuantity: 10, qualityQuantity: 10, defectQuantity: 0 }]);
                }}
              >
                Отмена
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<CheckCircleOutlined />}
                disabled={
                  bulkRegisterItems.filter(item => item.article.trim() !== '').length === 0 ||
                  bulkRegisterItems.some(item => 
                    item.article.trim() !== '' && 
                    (item.qualityQuantity + item.defectQuantity !== item.producedQuantity)
                  )
                }
              >
                Зарегистрировать выпуск
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно просмотра деталей задания */}
      <Modal
        title="Детали производственного задания"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingTask(null);
        }}
        footer={[
          <Button 
            key="close" 
            onClick={() => {
              setViewModalVisible(false);
              setViewingTask(null);
            }}
          >
            Закрыть
          </Button>
        ]}
        width={800}
      >
        {viewingTask && (
          <div style={{ padding: '16px 0' }}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="📦 Информация о товаре" size="small">
                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <strong>Название товара:</strong>
                      <div style={{ marginTop: 4, fontSize: '16px', fontWeight: 500 }}>
                        {viewingTask.product?.name || 'Не указано'}
                      </div>
                    </Col>
                    <Col span={12}>
                      <strong>Артикул товара:</strong>
                      <div style={{ marginTop: 4, fontSize: '16px', fontWeight: 500, color: '#1890ff' }}>
                        {viewingTask.product?.article || viewingTask.product?.code || 'Не указан'}
                      </div>
                    </Col>
                    <Col span={12}>
                      <strong>Категория:</strong>
                      <div style={{ marginTop: 4 }}>
                        {viewingTask.product?.category?.name || 'Не указана'}
                      </div>
                    </Col>
                    <Col span={12}>
                      <strong>ID товара:</strong>
                      <div style={{ marginTop: 4, color: '#666' }}>
                        #{viewingTask.productId}
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>

              <Col span={24}>
                <Card title="🔧 Характеристики товара" size="small">
                  <Row gutter={[16, 8]}>
                    {viewingTask.product?.surface && (
                      <Col span={8}>
                        <strong>Поверхность:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.surface.name}
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.logo && (
                      <Col span={8}>
                        <strong>Логотип:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.logo.name}
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.material && (
                      <Col span={8}>
                        <strong>Материал:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.material.name}
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.dimensions && (
                      <Col span={8}>
                        <strong>Размеры:</strong>
                        <div style={{ marginTop: 4 }}>
                          {(() => {
                            const dims = viewingTask.product.dimensions;
                            if (typeof dims === 'object' && dims !== null) {
                              const { length, width, height } = dims as any;
                              return `${length || '?'} × ${width || '?'} × ${height || '?'} мм`;
                            }
                            return 'Не указаны';
                          })()}
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.weight && (
                      <Col span={8}>
                        <strong>Вес:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.weight} кг
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.grade && (
                      <Col span={8}>
                        <strong>Сорт:</strong>
                        <div style={{ marginTop: 4 }}>
                          <Tag color={viewingTask.product.grade === 'premium' ? 'gold' : 'blue'}>
                            {viewingTask.product.grade === 'premium' ? 'Премиум' : 'Обычный'}
                          </Tag>
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.borderType && (
                      <Col span={8}>
                        <strong>Борт:</strong>
                        <div style={{ marginTop: 4 }}>
                          <Tag color={viewingTask.product.borderType === 'with_border' ? 'green' : 'default'}>
                            {viewingTask.product.borderType === 'with_border' ? 'С бортом' : 'Без борта'}
                          </Tag>
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.matArea && (
                      <Col span={8}>
                        <strong>Площадь мата:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.matArea} м²
                        </div>
                      </Col>
                    )}
                    {viewingTask.product?.puzzleOptions && (
                      <Col span={12}>
                        <strong>Опции паззла:</strong>
                        <div style={{ marginTop: 4 }}>
                          {(() => {
                            const puzzle = viewingTask.product.puzzleOptions;
                            if (typeof puzzle === 'object' && puzzle !== null) {
                              const { sides, type, enabled } = puzzle as any;
                              if (!enabled) return 'Паззл отключен';
                              const sidesText = sides === '1_side' ? '1 сторона' : sides === '2_sides' ? '2 стороны' : sides;
                              const typeText = type === 'old' ? 'Старый' : type === 'new' ? 'Новый' : type;
                              return `${sidesText}, ${typeText}`;
                            }
                            return 'Не настроено';
                          })()}
                        </div>
                      </Col>
                    )}
                  </Row>
                  {(!viewingTask.product?.surface && !viewingTask.product?.logo && !viewingTask.product?.material && 
                    !viewingTask.product?.dimensions && !viewingTask.product?.weight) && (
                    <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                      <i>Характеристики товара не заполнены</i>
                    </div>
                  )}
                </Card>
              </Col>

              <Col span={24}>
                <Card title="📋 Детали задания" size="small">
                  <Row gutter={[16, 8]}>
                    <Col span={8}>
                      <strong>ID задания:</strong>
                      <div style={{ marginTop: 4, fontSize: '16px', fontWeight: 500 }}>
                        #{viewingTask.id}
                      </div>
                    </Col>
                    <Col span={8}>
                      <strong>Статус:</strong>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={
                          viewingTask.status === 'pending' ? 'blue' :
                          viewingTask.status === 'in_progress' ? 'processing' :
                          viewingTask.status === 'completed' ? 'success' :
                          viewingTask.status === 'cancelled' ? 'error' :
                          viewingTask.status === 'paused' ? 'orange' : 'default'
                        }>
                          {viewingTask.status === 'pending' ? 'Ожидает' :
                           viewingTask.status === 'in_progress' ? 'В работе' :
                           viewingTask.status === 'completed' ? 'Завершено' :
                           viewingTask.status === 'cancelled' ? 'Отменено' :
                           viewingTask.status === 'paused' ? 'На паузе' : viewingTask.status}
                        </Tag>
                      </div>
                    </Col>
                    <Col span={8}>
                      <strong>Приоритет:</strong>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={viewingTask.priority <= 2 ? 'red' : viewingTask.priority <= 4 ? 'orange' : 'green'}>
                          {viewingTask.priority}
                        </Tag>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>

              <Col span={24}>
                <Card title="📊 Количество и прогресс" size="small">
                  <Row gutter={[16, 8]}>
                    <Col span={6}>
                      <Statistic
                        title="Запрошено"
                        value={viewingTask.requestedQuantity}
                        suffix="шт"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="Произведено"
                        value={viewingTask.producedQuantity || 0}
                        suffix="шт"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="Качественное"
                        value={viewingTask.qualityQuantity || 0}
                        suffix="шт"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="Брак"
                        value={viewingTask.defectQuantity || 0}
                        suffix="шт"
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Col>
                  </Row>
                  <Divider />
                  <Row>
                    <Col span={24}>
                      <strong>Прогресс выполнения:</strong>
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const requested = viewingTask.requestedQuantity;
                          const produced = viewingTask.producedQuantity || 0;
                          const remaining = requested - produced;
                          const progressPercent = Math.round((produced / requested) * 100);
                          
                          if (remaining === 0) {
                            return <Tag color="success" style={{ fontSize: '14px', padding: '4px 8px' }}>✅ Выполнено полностью</Tag>;
                          } else if (produced > 0) {
                            return (
                              <div>
                                <Tag color="processing" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                  🔄 {progressPercent}% выполнено
                                </Tag>
                                <span style={{ marginLeft: 8, color: '#faad14' }}>
                                  Осталось: <strong>{remaining} шт</strong>
                                </span>
                              </div>
                            );
                          } else {
                            return <Tag color="default" style={{ fontSize: '14px', padding: '4px 8px' }}>⏳ Не начато</Tag>;
                          }
                        })()}
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>

              {viewingTask.order && (
                <Col span={24}>
                  <Card title="🛒 Связанный заказ" size="small">
                    <Row gutter={[16, 8]}>
                      <Col span={8}>
                        <strong>Номер заказа:</strong>
                        <div style={{ marginTop: 4, fontSize: '16px', fontWeight: 500 }}>
                          {viewingTask.order.orderNumber}
                        </div>
                      </Col>
                      <Col span={8}>
                        <strong>Клиент:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.order.customerName}
                        </div>
                      </Col>
                      <Col span={8}>
                        <strong>Приоритет заказа:</strong>
                        <div style={{ marginTop: 4 }}>
                          <Tag color="blue">{viewingTask.order.priority}</Tag>
                        </div>
                      </Col>
                    </Row>
                    {viewingTask.order.deliveryDate && (
                      <Row style={{ marginTop: 8 }}>
                        <Col span={12}>
                          <strong>Дата доставки:</strong>
                          <div style={{ marginTop: 4 }}>
                            📅 {dayjs(viewingTask.order.deliveryDate).format('DD.MM.YYYY')}
                          </div>
                        </Col>
                      </Row>
                    )}
                  </Card>
                </Col>
              )}

              <Col span={24}>
                <Card title="📅 Временные метки" size="small">
                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <strong>Создано:</strong>
                      <div style={{ marginTop: 4 }}>
                        📅 {dayjs(viewingTask.createdAt).format('DD.MM.YYYY HH:mm')}
                      </div>
                    </Col>
                    <Col span={12}>
                      <strong>Обновлено:</strong>
                      <div style={{ marginTop: 4 }}>
                        🔄 {dayjs(viewingTask.updatedAt).format('DD.MM.YYYY HH:mm')}
                      </div>
                    </Col>
                    {viewingTask.plannedDate && (
                      <Col span={12}>
                        <strong>Планируемая дата:</strong>
                        <div style={{ marginTop: 4, color: '#1890ff' }}>
                          🎯 {dayjs(viewingTask.plannedDate).format('DD.MM.YYYY')}
                        </div>
                      </Col>
                    )}
                    {viewingTask.startedAt && (
                      <Col span={12}>
                        <strong>Начато:</strong>
                        <div style={{ marginTop: 4, color: '#52c41a' }}>
                          ▶️ {dayjs(viewingTask.startedAt).format('DD.MM.YYYY HH:mm')}
                        </div>
                      </Col>
                    )}
                    {viewingTask.completedAt && (
                      <Col span={12}>
                        <strong>Завершено:</strong>
                        <div style={{ marginTop: 4, color: '#52c41a' }}>
                          ✅ {dayjs(viewingTask.completedAt).format('DD.MM.YYYY HH:mm')}
                        </div>
                      </Col>
                    )}
                  </Row>
                </Card>
              </Col>

              {viewingTask.notes && (
                <Col span={24}>
                  <Card title="📝 Примечания" size="small">
                    <div style={{ whiteSpace: 'pre-wrap', padding: '8px 0' }}>
                      {viewingTask.notes}
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      </div>
    </App>
  );
};

export default ProductionTasks; 