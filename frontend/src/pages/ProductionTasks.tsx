import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  InboxOutlined,
  StopOutlined,
  FileWordOutlined
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
import SimpleGanttChart from '../components/SimpleGanttChart';
import { catalogApi } from '../services/catalogApi';
import { useAuthStore } from '../stores/authStore';
import usePermissions from '../hooks/usePermissions';
import dayjs, { Dayjs } from 'dayjs';
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType } from 'docx';

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('list');

  // Добавляем стили для переноса текста в Select и таблицах
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
      
      /* Стили для таблиц производственных заданий */
      .ant-table-tbody > tr > td {
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
        vertical-align: top !important;
      }
      
      /* Специальные стили для колонки "Заказ" */
      .ant-table-tbody > tr > td:nth-child(3) {
        min-width: 200px !important;
        max-width: 200px !important;
        word-break: break-word !important;
      }
      
      /* Специальные стили для колонки "Товар" */
      .ant-table-tbody > tr > td:nth-child(4) {
        min-width: 250px !important;
        max-width: 250px !important;
        word-break: break-word !important;
      }
      
      /* Специальные стили для колонки "Планируемая дата" */
      .ant-table-tbody > tr > td:nth-child(8) {
        min-width: 180px !important;
        max-width: 180px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
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
  const [exportWordDatePickerVisible, setExportWordDatePickerVisible] = useState<boolean>(false);
  
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
  const [cancelModalVisible, setCancelModalVisible] = useState<boolean>(false);
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
  const [cancelForm] = Form.useForm();

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
  }>>([{ id: 1, article: '', producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 }]);

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
    const activeTasks = tasksList.filter(t => t.status !== 'cancelled');
    const newStats = {
      total: activeTasks.length, // Только активные задания
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

      // Отмененные задания исключаем из всех групп
      if (task.status === 'cancelled') {
        return;
      }

      // Новая логика группировки с гибким планированием
      if (!task.plannedStartDate && !task.plannedEndDate) {
        groups.unplanned.push(task);
        return;
      }

      const startDate = task.plannedStartDate ? dayjs(task.plannedStartDate).startOf('day') : null;
      const endDate = task.plannedEndDate ? dayjs(task.plannedEndDate).startOf('day') : null;
      
      if (startDate) {
        if (startDate.isBefore(today)) {
          groups.overdue.push(task);
        } else if (startDate.isSame(today)) {
          groups.today.push(task);
        } else if (startDate.isSame(tomorrow)) {
          groups.tomorrow.push(task);
        } else {
          groups.later.push(task);
        }
      } else if (endDate) {
        // Если есть только дата завершения
        if (endDate.isBefore(today)) {
          groups.overdue.push(task);
        } else if (endDate.isSame(today)) {
          groups.today.push(task);
        } else if (endDate.isSame(tomorrow)) {
          groups.tomorrow.push(task);
        } else {
          groups.later.push(task);
        }
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
            scroll={{ x: 1200 }}
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
    } else if (key === 'list' || key === 'gantt') {
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
      qualityQuantity: task.qualityQuantity || 0, // Инициализируем текущий прогресс
      plannedStartDate: task.plannedStartDate ? dayjs(task.plannedStartDate) : null,
      plannedEndDate: task.plannedEndDate ? dayjs(task.plannedEndDate) : null
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
      // Форматируем даты для API
      const updateData: any = { ...values };
      
      if (values.plannedStartDate) {
        updateData.plannedStartDate = values.plannedStartDate.format('YYYY-MM-DD');
      }
      
      if (values.plannedEndDate) {
        updateData.plannedEndDate = values.plannedEndDate.format('YYYY-MM-DD');
      }

      await updateProductionTask(editingTask.id, updateData);
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

  // Отмена задания
  const handleCancelTask = (task: ProductionTask) => {
    setSelectedTask(task);
    setCancelModalVisible(true);
    cancelForm.resetFields();
  };

  const handleConfirmCancelTask = async (values: any) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`/api/production/tasks/${selectedTask.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reason: values.reason
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Ошибка отмены задания');
      }

      message.success('Производственное задание успешно отменено');
      setCancelModalVisible(false);
      setSelectedTask(null);
      cancelForm.resetFields();
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

    // Проверка на нулевые значения
    if (partialCompleteFormValues.producedQuantity === 0) {
      message.warning('Количество не может быть 0. Укажите положительное число.');
      return;
    }

    // Проверка на отрицательные значения (корректировка)
    if (partialCompleteFormValues.producedQuantity < 0) {
      const currentProduced = selectedTask.producedQuantity || 0;
      const maxRemovable = currentProduced;
      if (Math.abs(partialCompleteFormValues.producedQuantity) > maxRemovable) {
        message.error(
          `Максимум можно убрать: ${maxRemovable} шт. Текущее количество: ${currentProduced} шт.`
        );
        return;
      }
      
      // Предупреждение о корректировке
      message.warning(
        `Корректировка: будет убрано ${Math.abs(partialCompleteFormValues.producedQuantity)} шт из задания. Товар будет списан со склада.`
      );
    }

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
      // Проверка на нулевые значения
      const hasZeroValues = bulkRegisterItems.some(item => 
        item.producedQuantity === 0 || item.qualityQuantity === 0
      );
      
      if (hasZeroValues) {
        message.warning('Количество не может быть 0. Укажите положительные числа.');
        return;
      }

      // Проверка на отрицательные значения (корректировка)
      const hasNegativeValues = bulkRegisterItems.some(item => 
        item.producedQuantity < 0 || item.qualityQuantity < 0
      );
      
      if (hasNegativeValues) {
        message.warning('Отрицательные значения используются для корректировки. Товар будет списан со склада.');
      }

      // Валидация: все строки должны быть заполнены
      const validItems = bulkRegisterItems.filter(item => 
        item.article.trim() !== '' && item.producedQuantity !== 0
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
        setBulkRegisterItems([{ id: 1, article: '', producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 }]);
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
        message.success(`Произведено ${qualityQuantity} шт качественных товара "${selectedProductForCompletion.product.name}"`);
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

      // Добавляем планирование (обязательные поля)
      if (values.plannedStartDate && values.plannedEndDate) {
        taskData.plannedStartDate = values.plannedStartDate.format('YYYY-MM-DD');
        taskData.plannedEndDate = values.plannedEndDate.format('YYYY-MM-DD');
      } else {
        return message.error('Необходимо указать дату начала и дату завершения производства');
      }

      const result = await createProductionTask(taskData);
      
      if (result.success) {
        message.success('Производственное задание создано');
        setCreateTaskModalVisible(false);
        createTaskForm.resetFields();
        loadTasks();
        
        // Показываем информацию о планировании
        const startDateStr = values.plannedStartDate.format('DD.MM.YYYY');
        const endDateStr = values.plannedEndDate.format('DD.MM.YYYY');
        if (startDateStr === endDateStr) {
          message.info(`Задание запланировано на ${startDateStr}`);
        } else {
          message.info(`Задание запланировано с ${startDateStr} по ${endDateStr}`);
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

  // Функция для форматирования характеристик товара в текст
  const formatProductCharacteristics = (product: any): string[] => {
    const characteristics: string[] = [];
    
    if (!product) return characteristics;

    // Размеры
    if (product.dimensions && typeof product.dimensions === 'object') {
      const { length, width, height, thickness } = product.dimensions;
      const actualHeight = thickness || height;
      if (length && width && actualHeight) {
        characteristics.push(`Размеры: ${length}×${width}×${actualHeight} мм`);
      }
    }

    // Вес
    if (product.weight) {
      characteristics.push(`Вес: ${product.weight} кг`);
    }

    // Площадь мата
    if (product.matArea) {
      characteristics.push(`Площадь мата: ${product.matArea} м²`);
    }

    // Поверхности (для ковров и рулонных покрытий)
    if (product.productType === 'carpet' || product.productType === 'roll_covering') {
      if (product.surfaces && product.surfaces.length > 0) {
        const surfaceNames = product.surfaces.map((s: any) => s.name).join(', ');
        characteristics.push(`Поверхности: ${surfaceNames}`);
      } else if (product.surface) {
        characteristics.push(`Поверхность: ${product.surface.name}`);
      }

      // Логотип
      if (product.logo) {
        characteristics.push(`Логотип: ${product.logo.name}`);
      }

      // Материал
      if (product.material) {
        characteristics.push(`Материал: ${product.material.name}`);
      }

      // Тип пресса
      if (product.pressType && product.pressType !== 'not_selected') {
        const pressTypeNames = {
          'ukrainian': 'Украинский',
          'chinese': 'Китайский'
        };
        characteristics.push(`Тип пресса: ${pressTypeNames[product.pressType as keyof typeof pressTypeNames] || product.pressType}`);
      }
    }

    // Характеристики только для ковров
    if (product.productType === 'carpet') {
      // Сорт
      if (product.grade) {
        const gradeNames = {
          'usual': 'Обычный',
          'grade_2': 'Второй сорт',
          'telyatnik': 'Телятник',
          'liber': 'Либер'
        };
        characteristics.push(`Сорт: ${gradeNames[product.grade as keyof typeof gradeNames] || product.grade}`);
      }

      // Тип борта
      if (product.borderType) {
        const borderTypeNames = {
          'with_border': 'С бортом',
          'without_border': 'Без борта'
        };
        characteristics.push(`Тип борта: ${borderTypeNames[product.borderType as keyof typeof borderTypeNames] || product.borderType}`);
      }

      // Тип края ковра
      if (product.carpetEdgeType) {
        const edgeTypeNames = {
          'straight_cut': 'Литой',
          'direct_cut': 'Прямой рез',
          'puzzle': 'Пазл',
          'sub_puzzle': 'Подпазл',
          'cast_puzzle': 'Литой пазл'
        };
        characteristics.push(`Тип края: ${edgeTypeNames[product.carpetEdgeType as keyof typeof edgeTypeNames] || product.carpetEdgeType}`);
      }

      // Стороны края
      if (product.carpetEdgeSides && product.carpetEdgeType && 
          product.carpetEdgeType !== 'straight_cut' && 
          product.carpetEdgeType !== 'direct_cut') {
        characteristics.push(`Стороны края: ${product.carpetEdgeSides} ${product.carpetEdgeSides === 1 ? 'сторона' : 'стороны'}`);
      }

      // Край (прочность)
      if (product.carpetEdgeStrength) {
        const strengthNames = {
          'normal': 'Не усиленный',
          'reinforced': 'Усиленный'
        };
        characteristics.push(`Край: ${strengthNames[product.carpetEdgeStrength as keyof typeof strengthNames] || product.carpetEdgeStrength}`);
      }

      // Тип низа ковра
      if (product.bottomType) {
        characteristics.push(`Тип низа: ${product.bottomType.name}`);
      }

      // Тип паззла
      if (product.puzzleType && product.carpetEdgeType === 'puzzle') {
        characteristics.push(`Тип паззла: ${product.puzzleType.name}`);
      }

      // Стороны паззла
      if (product.puzzleSides && product.carpetEdgeType === 'puzzle') {
        characteristics.push(`Стороны паззла: ${product.puzzleSides} ${product.puzzleSides === 1 ? 'сторона' : 'стороны'}`);
      }
    }

    // Характеристики для рулонных покрытий
    if (product.productType === 'roll_covering' && product.rollComposition && product.rollComposition.length > 0) {
      const compositionText = product.rollComposition
        .map((item: any) => `${item.carpet.name} (${item.quantity} шт.)`)
        .join(', ');
      characteristics.push(`Состав: ${compositionText}`);
    }

    // Номер ПУР для товаров типа ПУР
    if (product.productType === 'pur' && product.purNumber) {
      characteristics.push(`Номер ПУР: ${product.purNumber}`);
    }

    return characteristics;
  };

  // Функция экспорта заданий в Word документ
  const handleExportToWord = async (selectedDate: Dayjs) => {
    try {
      console.log('🔍 Начало экспорта в Word для даты:', selectedDate.format('DD.MM.YYYY'));
      console.log('📊 Всего заданий:', tasks.length);

      // Фильтруем задания на выбранную дату
      const tasksForDate = tasks.filter(task => {
        // Исключаем отмененные и завершенные задания
        if (task.status === 'cancelled' || task.status === 'completed') {
          return false;
        }
        
        if (!task.plannedStartDate || !task.plannedEndDate) {
          return false;
        }
        
        const startDate = dayjs(task.plannedStartDate);
        const endDate = dayjs(task.plannedEndDate);
        
        return (selectedDate.isSame(startDate, 'day') || selectedDate.isAfter(startDate)) && 
               (selectedDate.isSame(endDate, 'day') || selectedDate.isBefore(endDate));
      });

      console.log('📊 Заданий на выбранную дату:', tasksForDate.length);

      if (tasksForDate.length === 0) {
        message.warning('На выбранную дату нет заданий для экспорта');
        return;
      }

      // Создаем Word документ
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Заголовок
            new Paragraph({
              children: [
                new TextRun({
                  text: "ЗАДАНИЕ НА ПРОИЗВОДСТВО",
                  bold: true,
                  size: 32
                })
              ],
              spacing: { after: 400 }
            }),
            
            // Дата
            new Paragraph({
              children: [
                new TextRun({
                  text: `Дата: ${selectedDate.format('DD.MM.YYYY')}`,
                  bold: true,
                  size: 24
                })
              ],
              spacing: { after: 600 }
            }),

            // Таблица с заданиями
            new DocxTable({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              rows: [
                // Заголовок таблицы
                new DocxTableRow({
                  children: [
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Заказ", bold: true })]
                      })]
                    }),
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Заказчик", bold: true })]
                      })]
                    }),
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Артикул", bold: true })]
                      })]
                    }),
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Нужно", bold: true })]
                      })]
                    }),
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Произведено", bold: true })]
                      })]
                    }),
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Осталось", bold: true })]
                      })]
                    }),
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "Срок", bold: true })]
                      })]
                    })
                  ]
                }),
                
                // Строки с заданиями
                ...tasksForDate.map(task => {
                  const remaining = task.requestedQuantity - task.qualityQuantity;
                  const orderNumber = task.order ? task.order.orderNumber : 'Задание на будущее';
                  const customerName = task.order ? task.order.customerName : '-';
                  
                  return new DocxTableRow({
                    children: [
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ text: orderNumber })]
                        })]
                      }),
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ text: customerName })]
                        })]
                      }),
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ text: task.product?.article || 'Не указан' })]
                        })]
                      }),
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ text: `${task.requestedQuantity} шт.` })]
                        })]
                      }),
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ text: `${task.qualityQuantity} шт.` })]
                        })]
                      }),
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ 
                            text: `${remaining} шт.`,
                            color: remaining > 0 ? 'FF0000' : '00AA00'
                          })]
                        })]
                      }),
                      new DocxTableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ 
                            text: `${dayjs(task.plannedStartDate).format('DD.MM')} - ${dayjs(task.plannedEndDate).format('DD.MM')}`
                          })]
                        })]
                      })
                    ]
                  });
                })
              ]
            }),

            // Разделитель
            new Paragraph({
              children: [new TextRun({ text: "" })],
              spacing: { after: 400 }
            }),

            // Заголовок секции характеристик
            new Paragraph({
              children: [
                new TextRun({
                  text: "ХАРАКТЕРИСТИКИ ТОВАРОВ",
                  bold: true,
                  size: 28
                })
              ],
              spacing: { after: 400 }
            }),

            // Характеристики для каждого товара
            ...tasksForDate.flatMap(task => {
              const characteristics = formatProductCharacteristics(task.product);
              if (characteristics.length === 0) return [];

              return [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Характеристики товара: ${task.product?.article || 'Не указан'}`,
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: { after: 200 }
                }),
                ...characteristics.map(char => 
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `• ${char}`,
                        size: 20
                      })
                    ],
                    spacing: { after: 100 }
                  })
                ),
                new Paragraph({
                  children: [new TextRun({ text: "" })],
                  spacing: { after: 300 }
                })
              ];
            })

          ]
        }]
      });

      // Генерируем и скачиваем файл
      console.log('📄 Создание Word документа...');
      const blob = await Packer.toBlob(doc);
      console.log('📦 Blob создан, размер:', blob.size, 'байт');
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Задание_на_производство_${selectedDate.format('DD.MM.YYYY')}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log('✅ Экспорт завершен успешно');

      message.success(`Экспортировано ${tasksForDate.length} заданий в Word документ`);

    } catch (error) {
      console.error('❌ Ошибка экспорта в Word:', error);
      if (error instanceof Error) {
        console.error('❌ Стек ошибки:', error.stack);
      }
      message.error('Ошибка при экспорте в Word документ');
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
      width: 200,
      render: (record: ProductionTask) => {
        if (!record) return null;
        if (!record.orderId || !record.order) {
          return (
            <Text type="secondary" style={{ fontStyle: 'italic', wordBreak: 'break-word' }}>
              Задание на будущее
            </Text>
          );
        }
        return (
          <div style={{ wordBreak: 'break-word' }}>
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
      width: 250,
      render: (product: any) => (
        <div style={{ wordBreak: 'break-word' }}>
          <div>{product.name}</div>
          {(product.article || product.code) && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Арт: {product.article || product.code}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Количество',
      key: 'quantity',
      width: 120,
      render: (record: ProductionTask) => {
        const requested = record.requestedQuantity;
        const produced = record.producedQuantity || 0;
        const quality = record.qualityQuantity || 0;
        const remaining = Math.max(0, requested - quality); // остается только по качественной продукции
        const isOverproduced = produced > requested;
        const overproduction = isOverproduced ? produced - requested : 0;
        const progressPercent = Math.round((quality / requested) * 100); // прогресс по качественной продукции
        
        return (
          <div>
            <div>
              <strong>Запрошено:</strong> {requested} шт
            </div>
            {produced > 0 && (
              <>
                <div style={{ color: '#52c41a' }}>
                  <strong>Произведено:</strong> {quality} шт качественных ({progressPercent}%)
                </div>
                {record.defectQuantity > 0 && (
                  <div style={{ color: '#ff7875' }}>
                    <strong>Брак:</strong> {record.defectQuantity} шт
                  </div>
                )}
                {remaining > 0 && (
                  <div style={{ color: '#faad14' }}>
                    <strong>Осталось:</strong> {remaining} шт
                  </div>
                )}
                {quality >= requested && (
                  <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    ✅ Выполнено полностью
                    {overproduction > 0 && (
                      <span style={{ marginLeft: 4 }}>+ {overproduction} шт сверх плана</span>
                    )}
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
      width: 100,
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
      width: 80,
      render: (priority: number) => (
        <Tag color={priority <= 2 ? 'red' : priority <= 4 ? 'orange' : 'green'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Планируемая дата',
      dataIndex: 'plannedStartDate',
      key: 'plannedStartDate',
      width: 180,
      render: (plannedStartDate: string, record: any) => {
        if (!plannedStartDate && !record.plannedEndDate) {
          return <Text type="secondary" style={{ fontStyle: 'italic' }}>Не запланировано</Text>;
        }
        
        const startDate = plannedStartDate ? dayjs(plannedStartDate) : null;
        const endDate = record.plannedEndDate ? dayjs(record.plannedEndDate) : null;
        
        if (startDate && endDate) {
          // Если даты одинаковые - показываем только одну
          if (startDate.isSame(endDate, 'day')) {
            return (
              <Text style={{ whiteSpace: 'nowrap' }}>
                {startDate.format('DD.MM.YYYY')}
              </Text>
            );
          }
          // Если разные - показываем диапазон
          return (
            <Text style={{ whiteSpace: 'nowrap' }}>
              {startDate.format('DD.MM')} - {endDate.format('DD.MM.YYYY')}
            </Text>
          );
        } else if (startDate) {
          return (
            <Text style={{ whiteSpace: 'nowrap' }}>
              С {startDate.format('DD.MM.YYYY')}
            </Text>
          );
        } else if (endDate) {
          return (
            <Text style={{ whiteSpace: 'nowrap' }}>
              До {endDate.format('DD.MM.YYYY')}
            </Text>
          );
        }
        
        return null;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
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
              <Tooltip title="Отменить задание">
                <Button
                  type="default"
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleCancelTask(record)}
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
                  const defaultProduced = 0; // По умолчанию 0, пользователь сам введет
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
              <Tooltip title="Отменить задание">
                <Button
                  type="default"
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleCancelTask(record)}
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
                  const defaultProduced = 0; // По умолчанию 0, пользователь сам введет
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
              <Tooltip title="Отменить задание">
                <Button
                  type="default"
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleCancelTask(record)}
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
          {record.product.article && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Арт: {record.product.article}
            </Text>
          )}
          {record.product.sku && (
            <Text type="secondary" style={{ fontSize: '11px', color: '#999' }}>
              SKU: {record.product.sku}
            </Text>
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
        
        {/* Простое уведомление об отмененных заданиях */}
        {stats.cancelled > 0 && (
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px 12px', 
            backgroundColor: '#f6f8fa', 
            border: '1px solid #d1d9e0',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#6a737d'
          }}>
            ℹ️ {stats.cancelled} отмененных заданий исключены из планирования
          </div>
        )}
        
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
          
          {/* Кнопка экспорта в Word */}
          <Button
            icon={<FileWordOutlined />}
            onClick={() => setExportWordDatePickerVisible(true)}
            style={{
              borderColor: '#1890ff',
              color: '#1890ff'
            }}
            title="Экспорт заданий на выбранную дату в Word документ"
          >
            📄 Экспорт в Word
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
                        scroll={{ x: 1200 }}
                      />
                    ),
                    rowExpandable: (record) => record.tasks.length > 0,
                  }}
                />
              )
            },
            {
              key: 'gantt',
              label: 'Диаграмма Ганта',
              children: (
                <SimpleGanttChart 
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
                  name="qualityQuantity"
                  label="Качественных"
                  help="Можно указать любое количество. Положительные значения добавляют продукцию, отрицательные убирают (корректировка)"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', message: 'Введите число' }
                  ]}
                >
                  <InputNumber 
                    style={{ width: '100%' }}
                    placeholder="Годных изделий"
                    onChange={(value) => {
                      const defect = completeFormValues.defectQuantity || 0;
                      const qualityValue = typeof value === 'number' ? value : 0;
                      completeForm.setFieldsValue({ producedQuantity: qualityValue + defect });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="defectQuantity"
                  label="Бракованных"
                  help="Можно указать любое количество. Положительные значения добавляют продукцию, отрицательные убирают (корректировка)"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', message: 'Введите число' }
                  ]}
                >
                  <InputNumber 
                    style={{ width: '100%' }}
                    placeholder="Количество брака"
                    onChange={(value) => {
                      const quality = completeFormValues.qualityQuantity || 0;
                      const defectValue = typeof value === 'number' ? value : 0;
                      completeForm.setFieldsValue({ producedQuantity: quality + defectValue });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="producedQuantity"
                  label="Произведено всего"
                >
                  <InputNumber 
                    min={0} 
                    style={{ width: '100%' }}
                    placeholder="Автоматически"
                    disabled
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Блок проверки готовности */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <Text strong>Проверка готовности:</Text>
              <br />
              <Text>
                Качественных: {completeFormValues.qualityQuantity || 0} / План: {selectedTask?.requestedQuantity || 0}
                {completeFormValues.qualityQuantity >= (selectedTask?.requestedQuantity || 0) 
                  ? ' ✅ Готово' 
                  : ' ⚠️ Не готово'}
              </Text>
              <br />
              <Text type="secondary">
                Произведено всего: {completeFormValues.qualityQuantity || 0} + {completeFormValues.defectQuantity || 0} = {completeFormValues.producedQuantity || 0}
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
                    <div key={key} style={{ marginBottom: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 6 }}>
                      <Row gutter={16} align="middle">
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
                        <Col span={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'qualityQuantity']}
                            label="Качественных"
                            rules={[{ required: true, message: 'Введите количество' }]}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Годных" />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'defectQuantity']}
                            label="Бракованных"
                          >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Брак" />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'quantity']}
                            label="Всего"
                          >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Авто" disabled />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'notes']}
                            label="Комментарий"
                          >
                            <Input placeholder="..." />
                          </Form.Item>
                        </Col>
                        <Col span={1}>
                          <Button 
                            type="text" 
                            danger 
                            icon={<CloseCircleOutlined />} 
                            onClick={() => remove(name)}
                          />
                        </Col>
                      </Row>
                    </div>
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
          
          <Title level={5}>Планирование производства</Title>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plannedStartDate"
                label="Дата начала производства"
                help="Когда планируется начать производство (можно указать любую дату, включая прошлые)"
                rules={[{ required: true, message: 'Выберите дату начала' }]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="Выберите дату начала"
                  format="DD.MM.YYYY"
                />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="plannedEndDate"
                label="Дата завершения производства"
                help="Когда планируется завершить производство (может быть одинаковой с датой начала)"
                dependencies={['plannedStartDate']}
                rules={[
                  { required: true, message: 'Выберите дату завершения' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('plannedStartDate');
                      if (startDate && value && value.isBefore(startDate)) {
                        return Promise.reject('Дата завершения не может быть раньше даты начала');
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="Выберите дату завершения"
                  format="DD.MM.YYYY"
                  disabledDate={(current) => {
                    const startDate = createTaskForm.getFieldValue('plannedStartDate');
                    return current && startDate && current.isBefore(startDate);
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
              name="qualityQuantity"
              label="Текущий прогресс (без складских операций)"
              help="Текущее количество выполненных качественных изделий. Введите новое абсолютное значение (не приращение). Не влияет на складские остатки."
            >
              <div>
                {editingTask && (
                  <div style={{ 
                    marginBottom: 8, 
                    padding: 8, 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: 4,
                    fontSize: '12px'
                  }}>
                    <Text type="secondary">
                      Текущее значение: <strong>{editingTask.qualityQuantity || 0} шт</strong>
                    </Text>
                  </div>
                )}
                <InputNumber 
                  min={0} 
                  max={editingTask?.requestedQuantity || 999999}
                  style={{ width: '100%' }}
                  placeholder="Введите новое значение"
                  onChange={(value) => {
                    if (value && editingTask?.requestedQuantity) {
                      const progress = Math.round((value / editingTask.requestedQuantity) * 100);
                      // Индикатор прогресса будет обновлен автоматически через form values
                    }
                  }}
                />
                {editingTask && (
                  <Form.Item shouldUpdate={(prevValues, currentValues) => 
                    prevValues.qualityQuantity !== currentValues.qualityQuantity
                  }>
                    {({ getFieldValue }) => {
                      const currentProgress = getFieldValue('qualityQuantity') || 0;
                      const progress = editingTask.requestedQuantity > 0 
                        ? Math.round((currentProgress / editingTask.requestedQuantity) * 100)
                        : 0;
                      const isCompleted = currentProgress >= editingTask.requestedQuantity;
                      
                      return (
                        <div style={{ marginTop: 8, fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ 
                              width: '100%', 
                              height: 6, 
                              backgroundColor: '#f0f0f0', 
                              borderRadius: 3,
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(progress, 100)}%`,
                                height: '100%',
                                backgroundColor: isCompleted ? '#52c41a' : '#1890ff',
                                transition: 'all 0.3s ease'
                              }} />
                            </div>
                            <span style={{ 
                              color: isCompleted ? '#52c41a' : '#1890ff',
                              fontWeight: 'bold',
                              minWidth: '40px'
                            }}>
                              {progress}%
                            </span>
                          </div>
                          {isCompleted && (
                            <div style={{ color: '#52c41a', marginTop: 4, fontWeight: 'bold' }}>
                              ✅ Задание будет автоматически завершено
                            </div>
                          )}
                        </div>
                      );
                    }}
                  </Form.Item>
                )}
              </div>
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

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="plannedStartDate"
                  label="Дата начала производства"
                  help="Когда планируется начать производство"
                  rules={[]}
                >
                  <DatePicker 
                    style={{ width: '100%' }}
                    placeholder="Выберите дату начала"
                    format="DD.MM.YYYY"
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  name="plannedEndDate"
                  label="Дата завершения производства"
                  help="Когда планируется завершить производство (может быть одинаковой с датой начала)"
                  dependencies={['plannedStartDate']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const startDate = getFieldValue('plannedStartDate');
                        if (startDate && value && value.isBefore(startDate)) {
                          return Promise.reject('Дата завершения не может быть раньше даты начала');
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <DatePicker 
                    style={{ width: '100%' }}
                    placeholder="Выберите дату завершения"
                    format="DD.MM.YYYY"
                    disabledDate={(current) => {
                      const startDate = editForm.getFieldValue('plannedStartDate');
                      return current && startDate && current.isBefore(startDate);
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
                  <strong>Уже произведено качественных:</strong> {selectedTask.qualityQuantity || 0} шт.<br/>
                  <strong>Уже произведено брака:</strong> {selectedTask.defectQuantity || 0} шт.
                </div>
              }
              description="Вы можете произвести любое количество. Положительные значения добавляют продукцию, отрицательные убирают (корректировка)."
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
                  help="Можно указать любое количество. Положительные значения добавляют продукцию, отрицательные убирают (корректировка)"
                  rules={[
                    { required: true, message: 'Укажите количество' },
                    { type: 'number', message: 'Введите число' }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={partialCompleteFormValues.producedQuantity}
                    onChange={(value) => {
                      const produced = value ?? 0;
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
                    placeholder="Укажите количество"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="qualityQuantity"
                  label="Годных (шт)"
                  help="Можно указать любое количество. Положительные значения добавляют продукцию, отрицательные убирают (корректировка)"
                  rules={[
                    { required: true, message: 'Укажите количество годных' },
                    { type: 'number', message: 'Введите число' }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={partialCompleteFormValues.qualityQuantity}
                    onChange={(value) => {
                      const quality = value ?? 0;
                      const defect = partialCompleteFormValues.producedQuantity - quality;
                      setPartialCompleteFormValues(prev => ({
                        ...prev,
                        qualityQuantity: quality,
                        defectQuantity: defect
                      }));
                      partialCompleteForm.setFieldValue('defectQuantity', defect);
                    }}
                    max={partialCompleteFormValues.producedQuantity}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="defectQuantity"
                  label="Брак (шт)"
                  help="Можно указать любое количество. Положительные значения добавляют продукцию, отрицательные убирают (корректировка)"
                  rules={[
                    { required: true, message: 'Укажите количество брака' },
                    { type: 'number', message: 'Введите число' }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={partialCompleteFormValues.defectQuantity}
                    onChange={(value) => {
                      const defect = value ?? 0;
                      const quality = partialCompleteFormValues.producedQuantity - defect;
                      setPartialCompleteFormValues(prev => ({
                        ...prev,
                        defectQuantity: defect,
                        qualityQuantity: quality
                      }));
                      partialCompleteForm.setFieldValue('qualityQuantity', quality);
                    }}
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
          setBulkRegisterItems([{ id: 1, article: '', producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 }]);
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
                    producedQuantity: 0,
                    qualityQuantity: 0,
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
                          <Option key={product.id} value={product.id} label={label}>
                            <div style={{ 
                              padding: '4px 0',
                              minHeight: '40px',
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
                                {product.article}
                              </div>
                              <div style={{ 
                                fontSize: '10px',
                                color: '#666',
                                marginTop: '2px',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                whiteSpace: 'normal'
                              }}>
                                {product.name}
                              </div>
                            </div>
                          </Option>
                        );
                      })}
                    </Select>
                  </div>
                  <div style={{ flex: 2, paddingRight: 8, display: 'flex', alignItems: 'center' }}>
                    <InputNumber
                      style={{ width: '100%', height: '50px' }}
                      min={0}
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
                  <div style={{ flex: 2, paddingRight: 8, display: 'flex', alignItems: 'center' }}>
                    <InputNumber
                      style={{ width: '100%', height: '50px' }}
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
                          defectQuantity: defect
                        };
                        setBulkRegisterItems(newItems);
                      }}
                    />
                  </div>
                  <div style={{ flex: 2, paddingRight: 8, display: 'flex', alignItems: 'center' }}>
                    <InputNumber
                      style={{ width: '100%', height: '50px' }}
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
                          qualityQuantity: quality
                        };
                        setBulkRegisterItems(newItems);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  setBulkRegisterItems([{ id: 1, article: '', producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 }]);
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
                      <div style={{ marginTop: 4, fontSize: '16px', fontWeight: 500, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {viewingTask.product?.article || viewingTask.product?.code ? (
                          <Button
                            type="link"
                            style={{ 
                              padding: 0, 
                              height: 'auto', 
                              fontSize: '16px', 
                              fontWeight: 500,
                              color: '#1890ff',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              whiteSpace: 'normal',
                              textAlign: 'left',
                              display: 'block',
                              width: '100%'
                            }}
                            onClick={() => navigate(`/catalog/products/${viewingTask.productId}`)}
                          >
                            {viewingTask.product?.article || viewingTask.product?.code}
                          </Button>
                        ) : (
                          <span style={{ color: '#999' }}>Не указан</span>
                        )}
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
                    {/* Основные характеристики - для всех типов товаров */}
                    
                    {/* Тип товара */}
                    <Col span={8}>
                      <strong>Тип товара:</strong>
                      <div style={{ marginTop: 4 }}>
                        {viewingTask.product?.productType === 'carpet' ? (
                          <Tag color="blue" icon="🪄">Ковровое изделие</Tag>
                        ) : viewingTask.product?.productType === 'other' ? (
                          <Tag color="green" icon="📦">Другое</Tag>
                        ) : viewingTask.product?.productType === 'pur' ? (
                          <Tag color="orange" icon="🔧">ПУР</Tag>
                        ) : viewingTask.product?.productType === 'roll_covering' ? (
                          <Tag color="purple" icon="🏭">Рулонное покрытие</Tag>
                        ) : (
                          <Tag color="default">Не указан</Tag>
                        )}
                      </div>
                    </Col>

                    {/* Номер ПУР - только для товаров типа ПУР */}
                    {viewingTask.product?.productType === 'pur' && (viewingTask.product as any)?.purNumber && (
                      <Col span={8}>
                        <strong>Номер ПУР:</strong>
                        <div style={{ marginTop: 4 }}>
                          <Tag color="orange">🔧 {(viewingTask.product as any).purNumber}</Tag>
                        </div>
                      </Col>
                    )}
                    
                    {/* Размеры и физические характеристики - для всех типов */}
                    {viewingTask.product?.dimensions && (
                      <Col span={8}>
                        <strong>Размеры:</strong>
                        <div style={{ marginTop: 4 }}>
                          {(() => {
                            const dims = viewingTask.product.dimensions;
                            if (typeof dims === 'object' && dims !== null) {
                              const { length, width, height, thickness } = dims as any;
                              // Используем thickness если есть, иначе height
                              const actualHeight = thickness || height;
                              return `${length || '?'} × ${width || '?'} × ${actualHeight || '?'} мм`;
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
                    {viewingTask.product?.matArea && (
                      <Col span={8}>
                        <strong>Площадь мата:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.matArea} м²
                        </div>
                      </Col>
                    )}
                    
                    {/* Поверхности, логотип, материал, пресс - для ковров и рулонных покрытий */}
                    {(viewingTask.product?.productType === 'carpet' || viewingTask.product?.productType === 'roll_covering') && (
                      <>
                        {/* Поверхности */}
                        {(viewingTask.product as any)?.surfaces && (viewingTask.product as any).surfaces.length > 0 ? (
                          <Col span={8}>
                            <strong>Поверхности:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Space wrap>
                                {(viewingTask.product as any).surfaces.map((surface: any) => (
                                  <Tag key={surface.id} color="blue">🎨 {surface.name}</Tag>
                                ))}
                              </Space>
                            </div>
                          </Col>
                        ) : viewingTask.product?.surface ? (
                          <Col span={8}>
                            <strong>Поверхность:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="blue">🎨 {viewingTask.product.surface.name}</Tag>
                            </div>
                          </Col>
                        ) : null}
                        
                        {viewingTask.product?.logo && (
                          <Col span={8}>
                            <strong>Логотип:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="cyan">🏷️ {viewingTask.product.logo.name}</Tag>
                            </div>
                          </Col>
                        )}
                        
                        {viewingTask.product?.material && (
                          <Col span={8}>
                            <strong>Материал:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="green">🧱 {viewingTask.product.material.name}</Tag>
                            </div>
                          </Col>
                        )}
                        
                        {viewingTask.product?.pressType && (
                          <Col span={8}>
                            <strong>Тип пресса:</strong>
                            <div style={{ marginTop: 4 }}>
                              {(viewingTask.product.pressType as any) === 'not_selected' ? (
                                <Tag color="default">➖ Не выбран</Tag>
                              ) : (viewingTask.product.pressType as any) === 'ukrainian' ? (
                                <Tag color="blue">🇺🇦 Украинский</Tag>
                              ) : (viewingTask.product.pressType as any) === 'chinese' ? (
                                <Tag color="red">🇨🇳 Китайский</Tag>
                              ) : (
                                <Tag color="default">{viewingTask.product.pressType}</Tag>
                              )}
                            </div>
                          </Col>
                        )}
                      </>
                    )}
                    
                    {/* Характеристики только для ковров */}
                    {viewingTask.product?.productType === 'carpet' && (
                      <>
                        {/* Сорт */}
                        {viewingTask.product?.grade && (
                          <Col span={8}>
                            <strong>Сорт:</strong>
                            <div style={{ marginTop: 4 }}>
                              {(viewingTask.product.grade as any) === 'usual' ? (
                                <Tag color="blue">Обычный</Tag>
                              ) : (viewingTask.product.grade as any) === 'grade_2' ? (
                                <Tag color="orange">⚠️ Второй сорт</Tag>
                              ) : (viewingTask.product.grade as any) === 'telyatnik' ? (
                                <Tag color="purple">🐄 Телятник</Tag>
                              ) : (viewingTask.product.grade as any) === 'liber' ? (
                                <Tag color="gold">🏆 Либер</Tag>
                              ) : (
                                <Tag color="default">{viewingTask.product.grade}</Tag>
                              )}
                            </div>
                          </Col>
                        )}
                        
                        {/* Тип борта */}
                        {viewingTask.product?.borderType && (
                          <Col span={8}>
                            <strong>Тип борта:</strong>
                            <div style={{ marginTop: 4 }}>
                              {viewingTask.product.borderType === 'with_border' ? (
                                <Tag color="green">✅ С бортом</Tag>
                              ) : viewingTask.product.borderType === 'without_border' ? (
                                <Tag color="default">❌ Без борта</Tag>
                              ) : (
                                <Tag color="default">{viewingTask.product.borderType}</Tag>
                              )}
                            </div>
                          </Col>
                        )}
                        
                        {/* Тип края ковра */}
                        {viewingTask.product?.carpetEdgeType && (
                          <Col span={8}>
                            <strong>Тип края ковра:</strong>
                            <div style={{ marginTop: 4 }}>
                              {(viewingTask.product.carpetEdgeType as any) === 'straight_cut' ? (
                                <Tag color="blue">Литой</Tag>
                              ) : (viewingTask.product.carpetEdgeType as any) === 'direct_cut' ? (
                                <Tag color="cyan">Прямой рез</Tag>
                              ) : (viewingTask.product.carpetEdgeType as any) === 'puzzle' ? (
                                <Tag color="purple">🧩 Пазл</Tag>
                              ) : (viewingTask.product.carpetEdgeType as any) === 'sub_puzzle' ? (
                                <Tag color="orange">Подпазл</Tag>
                              ) : (viewingTask.product.carpetEdgeType as any) === 'cast_puzzle' ? (
                                <Tag color="gold">Литой пазл</Tag>
                              ) : (
                                <Tag color="default">{viewingTask.product.carpetEdgeType}</Tag>
                              )}
                            </div>
                          </Col>
                        )}
                        
                        {/* Стороны края - только для паззловых типов */}
                        {viewingTask.product?.carpetEdgeSides && 
                         viewingTask.product.carpetEdgeType && 
                         (viewingTask.product.carpetEdgeType as any) !== 'straight_cut' && 
                         (viewingTask.product.carpetEdgeType as any) !== 'direct_cut' && (
                          <Col span={8}>
                            <strong>Стороны края:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="blue">
                                {viewingTask.product.carpetEdgeSides} 
                                {viewingTask.product.carpetEdgeSides === 1 ? ' сторона' : 
                                 viewingTask.product.carpetEdgeSides === 2 ? ' стороны' :
                                 viewingTask.product.carpetEdgeSides === 3 ? ' стороны' :
                                 ' сторон'}
                              </Tag>
                            </div>
                          </Col>
                        )}
                        
                        {/* Край */}
                        {viewingTask.product?.carpetEdgeStrength && (
                          <Col span={8}>
                            <strong>Край:</strong>
                            <div style={{ marginTop: 4 }}>
                              {(viewingTask.product.carpetEdgeStrength as any) === 'normal' ? (
                                <Tag color="blue">Не усиленный</Tag>
                              ) : (viewingTask.product.carpetEdgeStrength as any) === 'reinforced' ? (
                                <Tag color="orange">Усиленный</Tag>
                              ) : (
                                <Tag color="default">{viewingTask.product.carpetEdgeStrength}</Tag>
                              )}
                            </div>
                          </Col>
                        )}
                        
                        {/* Тип низа ковра */}
                        {viewingTask.product?.bottomType && (
                          <Col span={8}>
                            <strong>Тип низа:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="brown">🏠 {viewingTask.product.bottomType.name}</Tag>
                            </div>
                          </Col>
                        )}
                        
                        {/* Тип паззла - только для паззловых типов */}
                        {viewingTask.product?.puzzleType && 
                         (viewingTask.product.carpetEdgeType as any) === 'puzzle' && (
                          <Col span={8}>
                            <strong>Тип паззла:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="purple">🧩 {viewingTask.product.puzzleType.name}</Tag>
                            </div>
                          </Col>
                        )}
                        
                        {/* Стороны паззла - только для паззловых типов */}
                        {viewingTask.product?.puzzleSides && 
                         (viewingTask.product.carpetEdgeType as any) === 'puzzle' && (
                          <Col span={8}>
                            <strong>Стороны паззла:</strong>
                            <div style={{ marginTop: 4 }}>
                              <Tag color="purple">
                                {viewingTask.product.puzzleSides} 
                                {viewingTask.product.puzzleSides === 1 ? ' сторона' : 
                                 viewingTask.product.puzzleSides === 2 ? ' стороны' :
                                 viewingTask.product.puzzleSides === 3 ? ' стороны' :
                                 ' сторон'}
                              </Tag>
                            </div>
                          </Col>
                        )}
                      </>
                    )}
                    
                    {/* Характеристики для рулонных покрытий */}
                    {viewingTask.product?.productType === 'roll_covering' && (
                      <>
                        {viewingTask.product?.rollComposition && viewingTask.product.rollComposition.length > 0 && (
                          <Col span={24}>
                            <strong>Состав рулонного покрытия:</strong>
                            <div style={{ marginTop: 4 }}>
                              {viewingTask.product.rollComposition.map((item: any, index: number) => (
                                <div key={index} style={{ marginBottom: 4 }}>
                                  <Tag color="purple">{item.carpet.name}</Tag>
                                  <span style={{ marginLeft: 8 }}>
                                    {item.quantity} шт. (порядок: {item.sortOrder})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </Col>
                        )}
                      </>
                    )}
                    
                    {/* Дополнительные поля - для всех типов */}
                    {viewingTask.product?.tags && viewingTask.product.tags.length > 0 && (
                      <Col span={24}>
                        <strong>Теги:</strong>
                        <div style={{ marginTop: 4 }}>
                          {viewingTask.product.tags.map((tag: string, index: number) => (
                            <Tag key={index} color="default" style={{ marginBottom: 4 }}>
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      </Col>
                    )}
                    
                    {viewingTask.product?.notes && (
                      <Col span={24}>
                        <strong>Примечания к товару:</strong>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#666' }}>
                          {viewingTask.product.notes}
                        </div>
                      </Col>
                    )}
                  </Row>
                  {(!viewingTask.product?.article && !viewingTask.product?.productType && 
                    !viewingTask.product?.dimensions && !viewingTask.product?.weight && 
                    !viewingTask.product?.matArea && !viewingTask.product?.surface && 
                    !(viewingTask.product as any)?.surfaces && !viewingTask.product?.logo && 
                    !viewingTask.product?.material && !viewingTask.product?.pressType &&
                    !viewingTask.product?.grade && !viewingTask.product?.borderType && 
                    !viewingTask.product?.carpetEdgeType && !viewingTask.product?.bottomType &&
                    !viewingTask.product?.tags && !viewingTask.product?.notes) && (
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
                  
                  {/* Причина отмены для отмененных заданий */}
                  {viewingTask.status === 'cancelled' && (viewingTask as any).cancelReason && (
                    <Row style={{ marginTop: 16 }}>
                      <Col span={24}>
                        <Alert
                          message="Причина отмены"
                          description={(viewingTask as any).cancelReason}
                          type="error"
                          showIcon
                        />
                      </Col>
                    </Row>
                  )}
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
                          const quality = viewingTask.qualityQuantity || 0;
                          const defect = viewingTask.defectQuantity || 0;
                          const remaining = Math.max(0, requested - quality); // остается только по качественной продукции
                          const isCompleted = quality >= requested;
                          const overproduction = Math.max(0, produced - requested);
                          const progressPercent = Math.round((quality / requested) * 100);
                          
                          if (isCompleted) {
                            return (
                              <div>
                                <Tag color="success" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                  ✅ Выполнено полностью
                                </Tag>
                                {overproduction > 0 && (
                                  <span style={{ marginLeft: 8, color: '#52c41a', fontWeight: 'bold' }}>
                                    +{overproduction} шт сверх плана
                                  </span>
                                )}
                                {defect > 0 && (
                                  <span style={{ marginLeft: 8, color: '#ff7875' }}>
                                    (брак: {defect} шт)
                                  </span>
                                )}
                              </div>
                            );
                          } else if (quality > 0) {
                            return (
                              <div>
                                <Tag color="processing" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                  🔄 {progressPercent}% выполнено
                                </Tag>
                                <span style={{ marginLeft: 8, color: '#faad14' }}>
                                  Осталось: <strong>{remaining} шт</strong>
                                </span>
                                {defect > 0 && (
                                  <span style={{ marginLeft: 8, color: '#ff7875' }}>
                                    (брак: {defect} шт)
                                  </span>
                                )}
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
                    {(viewingTask.plannedStartDate || viewingTask.plannedEndDate) && (
                      <Col span={12}>
                        <strong>Планируемая дата:</strong>
                        <div style={{ marginTop: 4, color: '#1890ff' }}>
                          🎯 {viewingTask.plannedStartDate && viewingTask.plannedEndDate 
                            ? `${dayjs(viewingTask.plannedStartDate).format('DD.MM.YYYY')} - ${dayjs(viewingTask.plannedEndDate).format('DD.MM.YYYY')}`
                            : viewingTask.plannedStartDate 
                              ? `С ${dayjs(viewingTask.plannedStartDate).format('DD.MM.YYYY')}`
                              : `До ${dayjs(viewingTask.plannedEndDate).format('DD.MM.YYYY')}`
                          }
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

      {/* Модальное окно отмены задания */}
      <Modal
        title={
          <div style={{ color: '#ff4d4f' }}>
            <StopOutlined style={{ marginRight: 8 }} />
            Отменить производственное задание
          </div>
        }
        open={cancelModalVisible}
        onCancel={() => {
          setCancelModalVisible(false);
          setSelectedTask(null);
          cancelForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        {selectedTask && (
          <div>
            <Alert
              message="Внимание!"
              description={
                <div>
                  {selectedTask.status === 'pending' && (
                    <p>Задание будет отменено без последствий.</p>
                  )}
                  {(selectedTask.status === 'in_progress' || selectedTask.status === 'paused') && (
                    <div>
                      <p>Произведенная продукция ({selectedTask.qualityQuantity || 0} шт качественных) останется на складе.</p>
                      {selectedTask.qualityQuantity > 0 && (
                        <p>Качественных изделий: {selectedTask.qualityQuantity} шт.</p>
                      )}
                    </div>
                  )}
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form
              form={cancelForm}
              layout="vertical"
              onFinish={handleConfirmCancelTask}
            >
              <Form.Item
                label="Причина отмены"
                name="reason"
                rules={[
                  { required: true, message: 'Укажите причину отмены' },
                  { min: 5, message: 'Причина должна содержать минимум 5 символов' }
                ]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Укажите подробную причину отмены производственного задания..."
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    danger 
                    htmlType="submit"
                    icon={<StopOutlined />}
                  >
                    Отменить задание
                  </Button>
                  <Button onClick={() => {
                    setCancelModalVisible(false);
                    setSelectedTask(null);
                    cancelForm.resetFields();
                  }}>
                    Закрыть
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Модальное окно выбора даты для экспорта в Word */}
      <Modal
        title="📄 Выберите дату для экспорта в Word"
        open={exportWordDatePickerVisible}
        onCancel={() => setExportWordDatePickerVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <p style={{ marginBottom: '16px', color: '#666' }}>
            Выберите дату, на которую будут экспортированы производственные задания
          </p>
          <DatePicker
            onChange={(date) => {
              if (date) {
                handleExportToWord(date);
                setExportWordDatePickerVisible(false);
              }
            }}
            placeholder="Выберите дату"
            format="DD.MM.YYYY"
            style={{ width: '100%' }}
            size="large"
            autoFocus
          />
        </div>
      </Modal>

      </div>
    </App>
  );
};

export default ProductionTasks; 