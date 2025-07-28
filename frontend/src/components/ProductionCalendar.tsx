import React, { useState, useEffect } from 'react';
import { Calendar, Badge, Card, List, Tag, Button, Form, Select, DatePicker, Typography, Space, Table, Popconfirm, Tooltip, Modal, message, App } from 'antd';
import { 
  CalendarOutlined, ClockCircleOutlined, UserOutlined, EditOutlined,
  PlayCircleOutlined, PauseCircleOutlined, CheckCircleOutlined, DeleteOutlined,
  PlusOutlined, MoreOutlined
} from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { 
  getTasksByDateRange, updateTaskSchedule, CalendarTask, ProductionTask,
  startTask
} from '../services/productionApi';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;

interface ProductionCalendarProps {
  tasks: ProductionTask[];
  onTaskUpdate: () => void;
}

const ProductionCalendar: React.FC<ProductionCalendarProps> = ({ tasks, onTaskUpdate }) => {
  const { token } = useAuthStore();
  const { message } = App.useApp();
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<CalendarTask[]>([]);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleForm] = Form.useForm();

  // Загрузка календарных заданий для текущего месяца
  const loadCalendarTasks = async (date?: Dayjs) => {
    if (!token) return;

    const startOfMonth = (date || dayjs()).startOf('month').format('YYYY-MM-DD');
    const endOfMonth = (date || dayjs()).endOf('month').format('YYYY-MM-DD');

    try {
      const response = await getTasksByDateRange(startOfMonth, endOfMonth);
      if (response.success) {
        setCalendarTasks(response.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки календарных заданий:', error);
    }
  };

  useEffect(() => {
    loadCalendarTasks();
  }, [token]);

  // Получение заданий для конкретной даты
  const getTasksForDate = (date: Dayjs): CalendarTask[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return calendarTasks.filter(task => 
      dayjs(task.plannedDate).format('YYYY-MM-DD') === dateStr
    );
  };

  // Отображение событий на календаре
  const dateCellRender = (value: Dayjs) => {
    const dayTasks = getTasksForDate(value);
    
    if (dayTasks.length === 0) return null;

    return (
      <div style={{ padding: '2px' }}>
        {dayTasks.slice(0, 2).map((task, index) => (
          <div key={task.id} style={{ fontSize: '10px', lineHeight: '12px', marginBottom: '1px' }}>
            <Badge 
              status={
                task.status === 'completed' ? 'success' : 
                task.status === 'in_progress' ? 'processing' : 
                task.status === 'paused' ? 'warning' : 'default'
              } 
              text={
                <span style={{ fontSize: '10px' }}>
                  {task.productName.length > 10 ? `${task.productName.substring(0, 10)}...` : task.productName}
                </span>
              }
            />
          </div>
        ))}
        {dayTasks.length > 2 && (
          <div style={{ fontSize: '9px', color: '#999', textAlign: 'center' }}>
            +{dayTasks.length - 2} еще
          </div>
        )}
      </div>
    );
  };

  // Обработчик выбора даты
  const onDateSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const tasksForDate = getTasksForDate(date);
    
    setSelectedDate(dateStr);
    setSelectedTasks(tasksForDate);
  };

  // Обработчик изменения месяца
  const onPanelChange = (date: Dayjs) => {
    loadCalendarTasks(date);
  };

  // Открытие модала планирования для задания
  const openScheduleModal = (task: ProductionTask) => {
    setSelectedTask(task);
    scheduleForm.setFieldsValue({
      plannedDate: task.plannedDate ? dayjs(task.plannedDate) : null
    });
    setScheduleModalVisible(true);
  };

  // Сохранение планирования задания
  const handleScheduleSave = async (values: any) => {
    if (!selectedTask || !token) return;

    setLoading(true);
    try {
      const scheduleData = {
        plannedDate: values.plannedDate ? values.plannedDate.format('YYYY-MM-DD') : null
      };

      await updateTaskSchedule(selectedTask.id, scheduleData);
      message.success('Планирование задания обновлено');
      
      setScheduleModalVisible(false);
      setSelectedTask(null);
      scheduleForm.resetFields();
      
      // Обновляем данные
      await loadCalendarTasks();
      onTaskUpdate();
    } catch (error) {
      console.error('Ошибка обновления планирования:', error);
      message.error('Ошибка обновления планирования');
    } finally {
      setLoading(false);
    }
  };

  // Функции управления заданиями
  const handleStartTask = async (taskId: number) => {
    try {
      const result = await startTask(taskId);
      message.success('Задание запущено в производство');
      await loadCalendarTasks();
      onTaskUpdate();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Колонки для таблицы заданий
  const taskColumns = [
    {
      title: 'Товар',
      dataIndex: 'productName',
      key: 'productName',
      width: 200,
      render: (text: string, record: CalendarTask) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: 'Количество',
      key: 'quantity',
      width: 120,
      render: (record: CalendarTask) => (
        <div>
          <Text>{record.requestedQuantity} шт.</Text>
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'default', text: 'Ожидает' },
          in_progress: { color: 'blue', text: 'В работе' },
          paused: { color: 'orange', text: 'Пауза' },
          completed: { color: 'green', text: 'Завершено' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Время',
      key: 'time',
      width: 100,
      render: (record: CalendarTask) => (
        <div>
          {record.plannedStartTime && (
            <Tag icon={<ClockCircleOutlined />} color="blue">
              {record.plannedStartTime}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Заказ',
      key: 'order',
      width: 120,
      render: (record: CalendarTask) => (
        record.orderNumber ? (
          <div>
            <Text>{record.orderNumber}</Text>
            {record.customerName && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                {record.customerName}
              </div>
            )}
          </div>
        ) : <Text type="secondary">Без заказа</Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (record: CalendarTask) => (
        <Space size="small">
          {record.status === 'pending' && (
            <Tooltip title="Запустить в производство">
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartTask(record.id)}
              >
                Запустить
              </Button>
            </Tooltip>
          )}
          
          <Tooltip title="Изменить план">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openScheduleModal(record as any)}
            >
              План
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="Календарь производственных заданий">
        <Calendar
          dateCellRender={dateCellRender}
          onSelect={onDateSelect}
          onPanelChange={onPanelChange}
        />
      </Card>

      {/* Нижняя панель с заданиями выбранной даты */}
      {selectedDate && (
        <Card 
          style={{ marginTop: 16 }}
          title={
            <Space>
              <CalendarOutlined />
              {`Задания на ${dayjs(selectedDate).format('DD.MM.YYYY (dddd)')}`}
              {selectedTasks.length > 0 && (
                <Tag color="blue">{selectedTasks.length} заданий</Tag>
              )}
            </Space>
          }
          extra={
            <Button 
              type="text" 
              onClick={() => {
                setSelectedDate(null);
                setSelectedTasks([]);
              }}
            >
              Скрыть
            </Button>
          }
        >
          {selectedTasks.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: '#999'
            }}>
              <CalendarOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>На эту дату заданий нет</div>
              <div style={{ marginTop: '8px' }}>
                Вы можете запланировать задания на эту дату в разделе "Планирование заданий"
              </div>
            </div>
          ) : (
            <Table
              columns={taskColumns}
              dataSource={selectedTasks}
              rowKey="id"
              pagination={false}
              size="middle"
              scroll={{ x: 900 }}
            />
          )}
        </Card>
      )}

      {/* Модал планирования задания */}
      <Modal
        title="Планирование задания"
        open={scheduleModalVisible}
        onCancel={() => {
          setScheduleModalVisible(false);
          setSelectedTask(null);
          scheduleForm.resetFields();
        }}
        onOk={() => scheduleForm.submit()}
        confirmLoading={loading}
        width={500}
      >
        {selectedTask && (
          <div style={{ marginBottom: '16px' }}>
            <Title level={5}>{selectedTask.product.name}</Title>
            <Text type="secondary">
              Количество: {selectedTask.requestedQuantity} шт.
              {selectedTask.order && ` • Заказ: ${selectedTask.order.orderNumber}`}
            </Text>
          </div>
        )}
        
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={handleScheduleSave}
        >
          <Form.Item
            name="plannedDate"
            label="Планируемая дата"
            rules={[{ required: true, message: 'Выберите дату' }]}
          >
            <DatePicker 
              style={{ width: '100%' }}
              placeholder="Выберите дату выполнения"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductionCalendar; 