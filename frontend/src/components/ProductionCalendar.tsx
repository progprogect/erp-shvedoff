import React, { useState, useEffect } from 'react';
import { Calendar, Badge, Card, Modal, List, Tag, Button, Form, Select, DatePicker, message, Typography, Space } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { getTasksByDateRange, updateTaskSchedule, CalendarTask, ProductionTask } from '../services/productionApi';
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
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<CalendarTask[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
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

  // Рендер содержимого дня в календаре
  const dateCellRender = (value: Dayjs) => {
    const tasksForDate = getTasksForDate(value);
    
    if (tasksForDate.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {tasksForDate.slice(0, 3).map(task => (
          <li key={task.id} style={{ marginBottom: 2 }}>
            <Badge 
              status={getTaskStatusBadge(task.status)} 
              text={
                <span style={{ fontSize: 10 }}>
                  {task.productName.length > 20 ? 
                    `${task.productName.substring(0, 20)}...` : 
                    task.productName
                  }
                </span>
              }
            />
          </li>
        ))}
        {tasksForDate.length > 3 && (
          <li style={{ fontSize: 10, color: '#666' }}>
            +{tasksForDate.length - 3} еще...
          </li>
        )}
      </ul>
    );
  };

  // Получение статуса Badge для задания
  const getTaskStatusBadge = (status: string) => {
    const statusMap: Record<string, any> = {
      'pending': 'processing',
      'in_progress': 'success',
      'completed': 'default',
      'cancelled': 'error',
      'paused': 'warning'
    };
    return statusMap[status] || 'default';
  };

  // Получение текста статуса
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Ожидает',
      'in_progress': 'В работе',
      'completed': 'Завершено',
      'cancelled': 'Отменено',
      'paused': 'На паузе'
    };
    return statusMap[status] || status;
  };

  // Обработчик клика по дате
  const onDateSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const tasksForDate = getTasksForDate(date);
    
    setSelectedDate(dateStr);
    setSelectedTasks(tasksForDate);
    setModalVisible(true);
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

  return (
    <div>
      <Card 
        title={
          <Space>
            <CalendarOutlined />
            Календарь производственных заданий
          </Space>
        }
        style={{ marginBottom: '16px' }}
      >
        <Calendar
          cellRender={dateCellRender}
          onSelect={onDateSelect}
          onPanelChange={onPanelChange}
        />
      </Card>

      {/* Планирование неспланированных заданий */}
      {tasks.filter(task => !task.plannedDate).length > 0 && (
        <Card 
          title={
            <Space>
              <ClockCircleOutlined />
              Неспланированные задания
            </Space>
          }
          size="small"
        >
          <List
            dataSource={tasks.filter(task => !task.plannedDate)}
            renderItem={(task) => (
              <List.Item
                actions={[
                  <Button 
                    size="small" 
                    onClick={() => openScheduleModal(task)}
                  >
                    Запланировать
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={getTaskStatusBadge(task.status)}>
                        {getStatusText(task.status)}
                      </Tag>
                      {task.product.name}
                    </Space>
                  }
                  description={
                    <Space>
                      <Text type="secondary">Количество: {task.requestedQuantity}</Text>
                      {task.order && (
                        <Text type="secondary">
                          Заказ: {task.order.orderNumber} ({task.order.customerName})
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Модал просмотра заданий дня */}
      <Modal
        title={`Задания на ${selectedDate ? dayjs(selectedDate).format('DD.MM.YYYY') : ''}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <List
          dataSource={selectedTasks}
          renderItem={(task) => (
            <List.Item
              actions={[
                <Button 
                  size="small" 
                  onClick={() => {
                    const fullTask = tasks.find(t => t.id === task.id);
                    if (fullTask) openScheduleModal(fullTask);
                  }}
                >
                  Изменить
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={getTaskStatusBadge(task.status)}>
                      {getStatusText(task.status)}
                    </Tag>
                    {task.productName}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={4}>
                    <Text>Количество: {task.requestedQuantity} шт.</Text>
                    {task.orderNumber && (
                      <Text type="secondary">
                        Заказ: {task.orderNumber} 
                        {task.customerName && ` (${task.customerName})`}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

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