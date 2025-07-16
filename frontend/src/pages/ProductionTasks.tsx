import React, { useState, useEffect } from 'react';
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
  message,
  Popconfirm,
  Tooltip,
  Divider
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
  SortAscendingOutlined,
  ReloadOutlined,
  BellOutlined
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
  getProductionTasksByProduct,
  approveProductionTask,
  rejectProductionTask,
  postponeProductionTask,
  startProductionTask,
  completeProductionTask,
  reorderProductionTasks,
  recalculateProductionNeeds,
  getSyncStatistics,
  notifyReadyOrders,
  syncOrdersToTasks,
  ProductionTask,
  ProductionTaskExtra
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
  
  // Состояние для статистики
  const [stats, setStats] = useState({
    suggested: 0,
    approved: 0,
    inProgress: 0,
    completed: 0
  });
  
  // Состояние для модалов
  const [approveModalVisible, setApproveModalVisible] = useState<boolean>(false);
  const [completeModalVisible, setCompleteModalVisible] = useState<boolean>(false);
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Array<{ id: number; orderNumber: string; customerName: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string; fullName: string }>>([]);
  
  const [approveForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [createTaskForm] = Form.useForm();

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
      const response = await getProductionTasksByProduct();
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
      suggested: tasksList.filter(t => t.status === 'suggested').length,
      approved: tasksList.filter(t => t.status === 'approved').length,
      inProgress: tasksList.filter(t => t.status === 'in_progress').length,
      completed: tasksList.filter(t => t.status === 'completed').length
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
  const handleOnDragEnd = async (result: DropResult) => {
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
  };

  // Подтверждение задания
  const handleApproveTask = async (values: any) => {
    if (!selectedTask) return;

    try {
      await approveProductionTask(
        selectedTask.id,
        values.approvedQuantity,
        values.notes
      );
      
      message.success('Задание подтверждено');
      setApproveModalVisible(false);
      approveForm.resetFields();
      setSelectedTask(null);
      loadTasks();
    } catch (error) {
      console.error('Error approving task:', error);
      message.error('Ошибка подтверждения задания');
    }
  };

  // Отклонение задания
  const handleRejectTask = async (task: ProductionTask) => {
    try {
      await rejectProductionTask(task.id, 'Отклонено менеджером');
      message.success('Задание отклонено');
      loadTasks();
    } catch (error) {
      console.error('Error rejecting task:', error);
      message.error('Ошибка отклонения задания');
    }
  };

  // Отложение задания
  const handlePostponeTask = async (task: ProductionTask) => {
    try {
      await postponeProductionTask(task.id, 'Отложено');
      message.success('Задание отложено');
      loadTasks();
    } catch (error) {
      console.error('Error postponing task:', error);
      message.error('Ошибка отложения задания');
    }
  };

  // Начало выполнения задания
  const handleStartTask = async (task: ProductionTask) => {
    try {
      await startProductionTask(task.id);
      message.success('Задание запущено в производство');
      loadTasks();
    } catch (error) {
      console.error('Error starting task:', error);
      message.error('Ошибка запуска задания');
    }
  };

  // Завершение задания
  const handleCompleteTask = async (values: any) => {
    if (!selectedTask) return;

    try {
      const extras = values.extras?.map((extra: any) => ({
        product_id: extra.productId,
        quantity: extra.quantity,
        notes: extra.notes
      })) || [];

      await completeProductionTask(selectedTask.id, {
        produced_quantity: values.producedQuantity,
        quality_quantity: values.qualityQuantity,
        defect_quantity: values.defectQuantity,
        notes: values.notes,
        extras
      });
      
      message.success('Задание завершено');
      setCompleteModalVisible(false);
      completeForm.resetFields();
      setSelectedTask(null);
      loadTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      message.error('Ошибка завершения задания');
    }
  };

  // Создание нового задания
  const handleCreateTask = async (values: any) => {
    try {
      // Используем suggest API для создания задания
      const response = await fetch(`/api/production/tasks/suggest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: values.orderId,
          productId: values.productId,
          quantity: values.requestedQuantity,
          priority: values.priority || 3,
          notes: values.notes,
          assignedTo: values.assignedTo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
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

  // Обработчики управления системой
  const handleRecalculateNeeds = async () => {
    try {
      setLoading(true);
      const result = await recalculateProductionNeeds();
      message.success(`Пересчет завершен: создано ${result.data.created}, обновлено ${result.data.updated}, отменено ${result.data.cancelled}`);
      loadTasks();
    } catch (error) {
      console.error('Error recalculating needs:', error);
      message.error('Ошибка пересчета потребностей');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrders = async () => {
    try {
      setLoading(true);
      const result = await syncOrdersToTasks();
      message.success(`Синхронизация завершена: создано ${result.data.migrated} заданий`);
      loadTasks();
    } catch (error) {
      console.error('Error syncing orders:', error);
      message.error('Ошибка синхронизации заказов');
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyReady = async () => {
    try {
      const result = await notifyReadyOrders();
      message.success(`Уведомления отправлены: ${result.data.notified} заказов`);
    } catch (error) {
      console.error('Error notifying ready orders:', error);
      message.error('Ошибка отправки уведомлений');
    }
  };

  const handleShowSyncStats = async () => {
    try {
      const stats = await getSyncStatistics();
      Modal.info({
        title: 'Статистика синхронизации',
        content: (
          <div>
            <p><strong>Очередь производства:</strong> {stats.data.production_queue.total} элементов</p>
            <p><strong>Производственные задания:</strong> {stats.data.production_tasks.total} элементов</p>
          </div>
        ),
        width: 500
      });
    } catch (error) {
      console.error('Error getting sync stats:', error);
      message.error('Ошибка получения статистики');
    }
  };

  // Получение цвета статуса
  const getStatusColor = (status: string) => {
    const colors = {
      suggested: 'blue',
      approved: 'green',
      rejected: 'red',
      postponed: 'orange',
      in_progress: 'cyan',
      completed: 'purple',
      cancelled: 'gray'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  // Получение названия статуса
  const getStatusName = (status: string) => {
    const names = {
      suggested: 'Предложено',
      approved: 'Подтверждено', 
      rejected: 'Отклонено',
      postponed: 'Отложено',
      in_progress: 'В производстве',
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
        return (
          <div>
            <div>№{record.orderId}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.order?.customerName}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Товар',
      key: 'product',
      render: (record: ProductionTask) => {
        if (!record || !record.product) return null;
        return (
          <div>
            <div>{record.product.name}</div>
            {record.product.article && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.product.article}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Количество',
      key: 'quantity',
      render: (record: ProductionTask) => {
        if (!record) return null;
        return (
          <div>
            <div>Запрошено: {record.requestedQuantity}</div>
            {record.approvedQuantity && (
              <Text type="secondary">Подтверждено: {record.approvedQuantity}</Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusName(status)}
        </Tag>
      ),
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
          {record.status === 'suggested' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setSelectedTask(record);
                  approveForm.setFieldsValue({
                    approvedQuantity: record.requestedQuantity
                  });
                  setApproveModalVisible(true);
                }}
              >
                Подтвердить
              </Button>
              <Popconfirm
                title="Отклонить задание?"
                onConfirm={() => handleRejectTask(record)}
                okText="Да"
                cancelText="Нет"
              >
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                >
                  Отклонить
                </Button>
              </Popconfirm>
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePostponeTask(record)}
              >
                Отложить
              </Button>
            </>
          )}
          
          {record.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartTask(record)}
            >
              Запустить
            </Button>
          )}
          
          {record.status === 'in_progress' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setSelectedTask(record);
                completeForm.setFieldsValue({
                  producedQuantity: record.approvedQuantity || record.requestedQuantity,
                  qualityQuantity: record.approvedQuantity || record.requestedQuantity,
                  defectQuantity: 0
                });
                setCompleteModalVisible(true);
              }}
            >
              Завершить
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
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Производственные задания</Title>
      
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Предложено"
              value={stats.suggested}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Подтверждено"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
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
      </Row>

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
            icon={<ReloadOutlined />}
            onClick={handleRecalculateNeeds}
            loading={loading}
          >
            Пересчитать потребности
          </Button>
          <Button
            icon={<SortAscendingOutlined />}
            onClick={handleSyncOrders}
            loading={loading}
          >
            Синхронизировать заказы
          </Button>
          <Button
            icon={<BellOutlined />}
            onClick={handleNotifyReady}
            loading={loading}
          >
            Уведомить о готовых заказах
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={handleShowSyncStats}
          >
            Статистика синхронизации
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
                <DragDropContext onDragEnd={handleOnDragEnd}>
                  <Droppable droppableId="tasks-table" direction="vertical">
                    {(provided: DroppableProvided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        <Table
                          columns={taskColumns}
                          dataSource={tasks}
                          rowKey="id"
                          loading={loading}
                          pagination={false} // Отключаем пагинацию для drag-and-drop
                          components={{
                            body: {
                              row: ({ children, index, record, ...restProps }: any) => {
                                if (!record || !record.id) {
                                  return <tr {...restProps}>{children}</tr>;
                                }
                                return (
                                  <Draggable draggableId={`task-${record.id}`} index={index}>
                                    {(provided: DraggableProvided) => (
                                      <tr
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        {...restProps}
                                      style={{
                                        ...provided.draggableProps.style,
                                        cursor: 'grab'
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
                </DragDropContext>
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
            onFinish={handleApproveTask}
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
        }}
        footer={null}
        width={800}
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
              <Text strong>Подтвержденное количество:</Text> {selectedTask.approvedQuantity || selectedTask.requestedQuantity}
            </div>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="producedQuantity"
                  label="Произведено"
                  rules={[
                    { required: true, message: 'Введите количество' },
                    { type: 'number', min: 0, message: 'Количество не может быть отрицательным' }
                  ]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
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
                  <InputNumber min={0} style={{ width: '100%' }} />
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
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

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
            label="Заказ"
            rules={[{ required: true, message: 'Выберите заказ' }]}
          >
            <Select
              placeholder="Выберите заказ"
              showSearch
              optionFilterProp="children"
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
    </div>
  );
};

export default ProductionTasks; 