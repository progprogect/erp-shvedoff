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
  message
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DragOutlined,
  PlusOutlined
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
  completeTasksByProduct,
  updateProductionTask,
  deleteProductionTask,
  reorderProductionTasks,
  createProductionTask,
  ProductionTask,
  ProductionTaskExtra,
  UpdateProductionTaskRequest
} from '../services/productionApi';
import { catalogApi } from '../services/catalogApi';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;
// Убрали устаревший TabPane, теперь используем items
const { TextArea } = Input;
const { Option } = Select;

interface Product {
  id: number;
  name: string;
  sku?: string;
}

interface TasksByProduct {
  product: Product;
  tasks: ProductionTask[];
  totalQuantity: number;
}

const ProductionTasks: React.FC = () => {
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('list');
  
  // Состояние для списка заданий
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [tasksByProduct, setTasksByProduct] = useState<TasksByProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Фильтры
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');
  
  // Состояние для статистики
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0
  });
  
  // Состояние для модалов
  const [approveModalVisible, setApproveModalVisible] = useState<boolean>(false);
  const [completeModalVisible, setCompleteModalVisible] = useState<boolean>(false);
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState<boolean>(false);
  const [completeByProductModalVisible, setCompleteByProductModalVisible] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
  const [selectedProductForCompletion, setSelectedProductForCompletion] = useState<TasksByProduct | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Array<{ id: number; orderNumber: string; customerName: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string; fullName: string }>>([]);
  
  const [approveForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [createTaskForm] = Form.useForm();
  const [completeByProductForm] = Form.useForm();

  // Состояние для формы завершения
  const [completeFormValues, setCompleteFormValues] = useState<{
    producedQuantity: number;
    qualityQuantity: number;
    defectQuantity: number;
  }>({ producedQuantity: 0, qualityQuantity: 0, defectQuantity: 0 });

  // Состояние для модального окна редактирования
  const [editModalVisible, setEditModalVisible] = useState(false);

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
      completed: tasksList.filter(t => t.status === 'completed').length,
      cancelled: tasksList.filter(t => t.status === 'cancelled').length
    };
    setStats(newStats);
  };

  // Обработчик изменения вкладки
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'by-product') {
      loadTasksByProduct();
    } else {
      loadTasks();
    }
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

  const handleEditTask = (task: ProductionTask) => {
    setEditingTask(task);
    editForm.setFieldsValue({
      requestedQuantity: task.requestedQuantity,
      priority: task.priority,
      notes: task.notes,
      assignedTo: task.assignedTo
    });
    setEditModalVisible(true);
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
    if (!selectedTask) return;

    try {
      await updateProductionTask(selectedTask.id, values);
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

      const result = await createProductionTask(taskData);
      
      if (result.success) {
        message.success('Производственное задание создано');
        setCreateTaskModalVisible(false);
        createTaskForm.resetFields();
        loadTasks();
      } else {
        message.error(result.message || 'Ошибка создания задания');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      message.error('Ошибка создания задания');
    }
  };



  // Получение цвета статуса
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'blue',
      in_progress: 'cyan',
      completed: 'purple',
      cancelled: 'gray'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  // Получение названия статуса
  const getStatusName = (status: string) => {
    const names = {
      pending: 'Ожидает',
      in_progress: 'В работе',
      completed: 'Завершено',
      cancelled: 'Отменено'
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
      render: (record: ProductionTask) => (
        <div>
          <div>Запрошено: {record.requestedQuantity}</div>
          {record.producedQuantity > 0 && (
            <Text type="secondary">Произведено: {record.producedQuantity}</Text>
          )}
        </div>
      ),
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
          cancelled: { color: 'error', text: 'Отменено' }
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
      title: 'Действия',
      key: 'actions',
      render: (record: ProductionTask) => (
        <Space size="small">
          {record.status === 'pending' && (
            <>
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
            </>
          )}
          
          {record.status === 'in_progress' && (
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
          )}
          
          {record.status === 'completed' && (
            <Button
              type="default"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedTask(record);
                // setViewModalVisible(true); // This state was not defined in the original file
              }}
            >
              Просмотр
            </Button>
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
            {hasActiveTasks && (user?.role === 'production' || user?.role === 'director') && (
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
        <Col span={6}>
          <Card>
            <Statistic
              title="Предложено"
              value={stats.pending}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="В производстве"
              value={stats.inProgress}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Завершено"
              value={stats.completed}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
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
            Все ({stats.pending + stats.inProgress + stats.completed + stats.cancelled})
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
              label: 'Список заданий',
                            children: (
                <DragDropWrapper>
                  <Droppable droppableId="tasks-table" direction="vertical" type="task">
                    {(provided: DroppableProvided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        <Table
                          columns={taskColumns}
                          dataSource={filteredTasks}
                          rowKey="id"
                          loading={loading}
                          pagination={false} // Отключаем пагинацию для drag-and-drop
                          components={{
                            body: {
                              row: ({ children, index, record, ...restProps }: any) => {
                                const taskIndex = filteredTasks.findIndex(task => task.id === record?.id);
                                if (!record || !record.id || taskIndex === -1) {
                                  return <tr {...restProps}>{children}</tr>;
                                }
                                return (
                                  <Draggable draggableId={`task-${record.id}`} index={taskIndex} key={`task-${record.id}`}>
                                    {(provided: DraggableProvided, snapshot) => (
                                      <tr
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        {...restProps}
                                        style={{
                                          ...provided.draggableProps.style,
                                          cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                                          backgroundColor: snapshot.isDragging ? '#f0f0f0' : 'white'
                                        }}
                                      >
                                        {children}
                                      </tr>
                                    )}
                                  </Draggable>
                                );
                              }
                            }
                          }}
                        />
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropWrapper>
              )
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
      </div>
    </App>
  );
};

export default ProductionTasks; 