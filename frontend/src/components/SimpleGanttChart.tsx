import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, Row, Col, Button, Select, Space, Tooltip, message, DatePicker } from 'antd';
import { LeftOutlined, RightOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { ProductionTask, updateProductionTask } from '../services/productionApi';

// Устанавливаем русскую локаль для dayjs
dayjs.locale('ru');

const { Option } = Select;

interface SimpleGanttChartProps {
  tasks: ProductionTask[];
  onTaskUpdate?: (taskId: number, updates: Partial<ProductionTask>) => void;
}

interface GanttTask {
  id: number;
  title: string;
  orderNumber?: string;
  customerName?: string;
  startDate: Dayjs;
  endDate: Dayjs;
  status: string;
  priority: number;
}

const SimpleGanttChart: React.FC<SimpleGanttChartProps> = ({ 
  tasks, 
  onTaskUpdate 
}) => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('week'),
    dayjs().endOf('week').add(2, 'week') // Показываем 3 недели по умолчанию
  ]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [draggedTask, setDraggedTask] = useState<GanttTask | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [resizeMode, setResizeMode] = useState<'start' | 'end' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Группировка заданий по заказам
  const groupedTasks = useMemo(() => {
    const grouped: { [key: string]: GanttTask[] } = {};
    
    tasks
      .filter(task => {
        if (statusFilter === 'all') return true;
        return task.status === statusFilter;
      })
      .forEach(task => {
        const orderKey = task.order?.orderNumber || `Задание ${task.id}`;
        
        if (!grouped[orderKey]) {
          grouped[orderKey] = [];
        }
        
        if (task.plannedStartDate && task.plannedEndDate) {
          grouped[orderKey].push({
            id: task.id,
            title: task.product?.name || 'Неизвестный товар',
            orderNumber: task.order?.orderNumber,
            customerName: task.order?.customerName,
            startDate: dayjs(task.plannedStartDate),
            endDate: dayjs(task.plannedEndDate),
            status: task.status,
            priority: task.priority
          });
        }
      });
    
    return grouped;
  }, [tasks, statusFilter]);

  // Получение дней в выбранном диапазоне для отображения
  const visibleDays = useMemo(() => {
    const [startDate, endDate] = dateRange;
    const days = [];
    
    let currentDay = startDate;
    while (currentDay.isSame(endDate, 'day') || currentDay.isBefore(endDate)) {
      days.push(currentDay);
      currentDay = currentDay.add(1, 'day');
    }
    
    return days;
  }, [dateRange]);

  // Получение цвета статуса
  const getStatusColor = (status: string) => {
    const colors = {
      pending: '#1890ff',      // синий
      in_progress: '#faad14',  // желтый
      completed: '#52c41a',    // зеленый
      cancelled: '#ff4d4f',    // красный
      paused: '#d9d9d9'        // серый
    };
    return colors[status as keyof typeof colors] || '#d9d9d9';
  };

  // Проверка, пересекается ли задание с видимым диапазоном
  const isTaskInRange = (startDate: Dayjs, endDate: Dayjs) => {
    const [rangeStart, rangeEnd] = dateRange;
    
    return startDate.isBefore(rangeEnd.add(1, 'day')) && endDate.isAfter(rangeStart.subtract(1, 'day'));
  };

  // Получение позиции и ширины полосы
  const getTaskPosition = (startDate: Dayjs, endDate: Dayjs) => {
    const [rangeStart, rangeEnd] = dateRange;
    
    // Ограничиваем даты рамками диапазона
    const taskStart = startDate.isBefore(rangeStart) ? rangeStart : startDate;
    const taskEnd = endDate.isAfter(rangeEnd) ? rangeEnd : endDate;
    
    // Вычисляем позицию в днях относительно начала диапазона
    const startDay = taskStart.diff(rangeStart, 'day');
    const duration = taskEnd.diff(taskStart, 'day') + 1;
    const totalDays = rangeEnd.diff(rangeStart, 'day') + 1;
    
    return {
      left: `${(startDay / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`
    };
  };

  // Навигация по диапазону дат
  const goToPreviousWeek = () => {
    const [startDate, endDate] = dateRange;
    const duration = endDate.diff(startDate, 'day');
    const newEndDate = startDate.subtract(1, 'day');
    const newStartDate = newEndDate.subtract(duration, 'day');
    setDateRange([newStartDate, newEndDate]);
  };

  const goToNextWeek = () => {
    const [startDate, endDate] = dateRange;
    const duration = endDate.diff(startDate, 'day');
    const newStartDate = endDate.add(1, 'day');
    const newEndDate = newStartDate.add(duration, 'day');
    setDateRange([newStartDate, newEndDate]);
  };

  const goToToday = () => {
    const today = dayjs();
    const [startDate, endDate] = dateRange;
    const duration = endDate.diff(startDate, 'day');
    const newStartDate = today.startOf('week');
    const newEndDate = newStartDate.add(duration, 'day');
    setDateRange([newStartDate, newEndDate]);
  };

  // Обработчик изменения диапазона дат
  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  // Обработка скролла для навигации по диапазону дат
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!timelineRef.current?.contains(e.target as Node)) return;
      
      e.preventDefault();
      
      if (e.deltaY > 0) {
        // Скролл вниз - следующий период
        goToNextWeek();
      } else {
        // Скролл вверх - предыдущий период
        goToPreviousWeek();
      }
    };

    const timeline = timelineRef.current;
    if (timeline) {
      timeline.addEventListener('wheel', handleWheel, { passive: false });
      return () => timeline.removeEventListener('wheel', handleWheel);
    }
  }, [dateRange]);

  // Обработка drag & drop и resize
  const handleMouseDown = (task: GanttTask, event: React.MouseEvent, mode: 'move' | 'resize-start' | 'resize-end' = 'move') => {
    setDraggedTask(task);
    setDragStartX(event.clientX);
    setResizeMode(mode === 'move' ? null : mode === 'resize-start' ? 'start' : 'end');
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!draggedTask || !containerRef.current) return;

    const timelineRect = containerRef.current.querySelector('.timeline-area')?.getBoundingClientRect();
    
    if (!timelineRect) return;

    const relativeX = event.clientX - timelineRect.left;
    
    // Валидация координат
    if (relativeX < 0 || relativeX > timelineRect.width) return;
    
    const totalDays = visibleDays.length;
    const dayWidth = timelineRect.width / totalDays;
    const dayOffset = Math.round(relativeX / dayWidth);
    
    // Валидация dayOffset
    if (dayOffset < 0 || dayOffset >= totalDays) return;
    
    // Обновляем позицию полосы визуально
    const taskElement = document.querySelector(`[data-task-id="${draggedTask.id}"]`) as HTMLElement;
    if (taskElement) {
      if (resizeMode === 'start') {
        // Изменяем только начало
        const currentWidth = parseFloat(taskElement.style.width || '100%');
        const newLeft = `${(dayOffset / totalDays) * 100}%`;
        const newWidth = `${currentWidth + (parseFloat(taskElement.style.left || '0%') - parseFloat(newLeft))}%`;
        taskElement.style.left = newLeft;
        taskElement.style.width = newWidth;
      } else if (resizeMode === 'end') {
        // Изменяем только конец (ширину)
        const currentLeft = parseFloat(taskElement.style.left || '0%');
        const newWidth = `${((dayOffset / totalDays) * 100) - currentLeft}%`;
        taskElement.style.width = newWidth;
      } else {
        // Обычное перемещение
        const newLeft = `${(dayOffset / totalDays) * 100}%`;
        taskElement.style.left = newLeft;
      }
    }
  };

  const handleMouseUp = async (event: React.MouseEvent) => {
    if (!draggedTask || !containerRef.current) {
      setDraggedTask(null);
      return;
    }

    const timelineRect = containerRef.current.querySelector('.timeline-area')?.getBoundingClientRect();
    
    if (!timelineRect) {
      message.error('Не удалось определить область временной шкалы');
      setDraggedTask(null);
      return;
    }

    const relativeX = event.clientX - timelineRect.left;
    const totalDays = visibleDays.length;
    const dayWidth = timelineRect.width / totalDays;
    
    // Валидация координат
    if (relativeX < 0 || relativeX > timelineRect.width) {
      message.warning('Перетаскивание за границы временной шкалы');
      setDraggedTask(null);
      setResizeMode(null);
      return;
    }
    
    const dayOffset = Math.round(relativeX / dayWidth);
    
    // Валидация dayOffset
    if (dayOffset < 0 || dayOffset >= totalDays) {
      message.warning('Некорректная позиция для задания');
      setDraggedTask(null);
      setResizeMode(null);
      return;
    }
    
    // Вычисляем новые даты в зависимости от режима
    const [rangeStart, rangeEnd] = dateRange;
    let newStartDate: Dayjs;
    let newEndDate: Dayjs;
    
    if (resizeMode === 'start') {
      newStartDate = rangeStart.add(dayOffset, 'day');
      newEndDate = draggedTask.endDate; // Конец остается тот же
    } else if (resizeMode === 'end') {
      newStartDate = draggedTask.startDate; // Начало остается то же
      newEndDate = rangeStart.add(dayOffset, 'day');
    } else {
      // Обычное перемещение
      newStartDate = rangeStart.add(dayOffset, 'day');
      const duration = draggedTask.endDate.diff(draggedTask.startDate, 'day');
      newEndDate = newStartDate.add(duration, 'day');
    }

    // Проверяем, что даты не выходят за границы диапазона
    if (newStartDate.isBefore(rangeStart) || newEndDate.isAfter(rangeEnd)) {
      message.warning('Задание не может быть перемещено за границы выбранного периода');
      setDraggedTask(null);
      setResizeMode(null);
      return;
    }

    // Проверяем, что даты не изменились
    if (newStartDate.isSame(draggedTask.startDate, 'day') && newEndDate.isSame(draggedTask.endDate, 'day')) {
      setDraggedTask(null);
      return;
    }

    try {
      // Обновляем задание через API
      await updateProductionTask(draggedTask.id, {
        plannedStartDate: newStartDate.format('YYYY-MM-DD'),
        plannedEndDate: newEndDate.format('YYYY-MM-DD')
      });

      message.success('Даты задания обновлены');
      if (onTaskUpdate) {
        onTaskUpdate(draggedTask.id, {
          plannedStartDate: newStartDate.format('YYYY-MM-DD'),
          plannedEndDate: newEndDate.format('YYYY-MM-DD')
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      message.error('Ошибка при обновлении задания');
      
      // Сбрасываем визуальные изменения при ошибке
      const taskElement = document.querySelector(`[data-task-id="${draggedTask.id}"]`) as HTMLElement;
      if (taskElement) {
        const originalPosition = getTaskPosition(draggedTask.startDate, draggedTask.endDate);
        taskElement.style.left = originalPosition.left;
      }
    } finally {
      setDraggedTask(null);
      setResizeMode(null);
    }
  };

  return (
    <Card>
      {/* Панель управления */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button 
                icon={<LeftOutlined />} 
                onClick={goToPreviousWeek}
                size="small"
              >
                Пред. период
              </Button>
              <Button 
                onClick={goToToday}
                size="small"
              >
                Сегодня
              </Button>
              <Button 
                icon={<RightOutlined />} 
                onClick={goToNextWeek}
                size="small"
              >
                След. период
              </Button>
            </Space>
          </Col>
          
          <Col>
            <Space>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                format="DD.MM.YYYY"
                size="small"
                style={{ width: 240 }}
                placeholder={['От', 'До']}
                allowClear={false}
              />
              
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                size="small"
              >
                <Option value="all">Все</Option>
                <Option value="pending">Ожидает</Option>
                <Option value="in_progress">В работе</Option>
                <Option value="completed">Завершено</Option>
              </Select>
              
              <span style={{ fontSize: '14px', color: '#666' }}>
                {visibleDays.length} дней: {dateRange[0].format('DD.MM')} - {dateRange[1].format('DD.MM.YYYY')}
              </span>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Диаграмма Ганта */}
      <div 
        ref={containerRef}
        style={{ 
          border: '1px solid #d9d9d9', 
          borderRadius: '6px',
          overflow: 'hidden'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setDraggedTask(null);
          setResizeMode(null);
        }}
      >
        {/* Заголовок с днями недели */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          borderBottom: '1px solid #d9d9d9',
          backgroundColor: '#fafafa'
        }}>
          <div style={{ 
            padding: '8px 12px', 
            borderRight: '1px solid #d9d9d9',
            fontWeight: 'bold'
          }}>
            Задания
          </div>
          
          <div 
            ref={timelineRef}
            className="timeline-area"
            style={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)`,
              textAlign: 'center'
            }}
          >
            {visibleDays.map((day, index) => (
              <div 
                key={index}
                style={{ 
                  padding: '8px 4px',
                  borderRight: index < visibleDays.length - 1 ? '1px solid #d9d9d9' : 'none',
                  backgroundColor: day.isSame(dayjs(), 'day') ? '#e6f7ff' : 'transparent'
                }}
              >
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {day.format('ddd')}
                </div>
                <div style={{ fontWeight: 'bold' }}>
                  {day.format('DD')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Задания */}
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {Object.entries(groupedTasks).map(([orderKey, orderTasks]) => (
            <div key={orderKey}>
              {/* Заголовок заказа */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '200px 1fr',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{ 
                  padding: '8px 12px',
                  borderRight: '1px solid #d9d9d9',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  📦 {orderKey}
                  {orderTasks[0]?.customerName && (
                    <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>
                      {orderTasks[0].customerName}
                    </div>
                  )}
                </div>
                
                <div 
                  className="timeline-area"
                  style={{ 
                    display: 'grid',
                    gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)`,
                    height: '40px'
                  }}
                >
                  {visibleDays.map((_, index) => (
                    <div 
                      key={index}
                      style={{ 
                        borderRight: index < visibleDays.length - 1 ? '1px solid #d9d9d9' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Задания заказа */}
              {orderTasks.map((task) => {
                if (!isTaskInRange(task.startDate, task.endDate)) {
                  return null;
                }

                const position = getTaskPosition(task.startDate, task.endDate);
                
                return (
                  <div key={task.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr',
                    borderBottom: '1px solid #f0f0f0',
                    position: 'relative'
                  }}>
                    {/* Название задания */}
                    <div style={{ 
                      padding: '8px 12px',
                      borderRight: '1px solid #d9d9d9',
                      fontSize: '13px'
                    }}>
                      🎨 {task.title}
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        Приоритет: {task.priority}
                      </div>
                    </div>
                    
                    {/* Область для полосы */}
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)`,
                      height: '40px',
                      position: 'relative'
                    }}>
                      {visibleDays.map((_, index) => (
                        <div 
                          key={index}
                          style={{ 
                            borderRight: index < visibleDays.length - 1 ? '1px solid #d9d9d9' : 'none'
                          }}
                        />
                      ))}
                      
                      {/* Полоса задания */}
                      <Tooltip 
                        title={`${task.startDate.format('DD.MM')} - ${task.endDate.format('DD.MM.YYYY')}. Перетащите для изменения даты, потяните за края для изменения длительности.`}
                      >
                        <div
                          data-task-id={task.id}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: position.left,
                            width: position.width,
                            height: '32px',
                            backgroundColor: getStatusColor(task.status),
                            borderRadius: '4px',
                            cursor: draggedTask?.id === task.id ? 
                              (resizeMode === 'start' ? 'w-resize' : 
                               resizeMode === 'end' ? 'e-resize' : 'grabbing') : 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            boxShadow: draggedTask?.id === task.id ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
                            opacity: draggedTask?.id === task.id ? 0.8 : 1,
                            transform: draggedTask?.id === task.id ? 'scale(1.05)' : 'scale(1)',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                          }}
                          onMouseDown={(e) => handleMouseDown(task, e, 'move')}
                          onClick={(e) => {
                            if (!draggedTask) {
                              console.log('Task clicked:', task);
                              // TODO: Открыть детали задания
                            }
                            e.preventDefault();
                          }}
                        >
                          {task.status === 'in_progress' && '▶'}
                          
                          {/* Resize handles */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-4px',
                              top: '0',
                              width: '8px',
                              height: '100%',
                              cursor: 'w-resize',
                              backgroundColor: 'rgba(255,255,255,0.3)',
                              borderRadius: '2px 0 0 2px'
                            }}
                            onMouseDown={(e) => handleMouseDown(task, e, 'resize-start')}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              right: '-4px',
                              top: '0',
                              width: '8px',
                              height: '100%',
                              cursor: 'e-resize',
                              backgroundColor: 'rgba(255,255,255,0.3)',
                              borderRadius: '0 2px 2px 0'
                            }}
                            onMouseDown={(e) => handleMouseDown(task, e, 'resize-end')}
                          />
                        </div>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Легенда */}
      <div style={{ marginTop: 16, display: 'flex', gap: '16px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '16px', 
            backgroundColor: '#1890ff', 
            borderRadius: '2px' 
          }} />
          <span>Ожидает</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '16px', 
            backgroundColor: '#faad14', 
            borderRadius: '2px' 
          }} />
          <span>В работе</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '16px', 
            backgroundColor: '#52c41a', 
            borderRadius: '2px' 
          }} />
          <span>Завершено</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '16px', 
            backgroundColor: '#ff4d4f', 
            borderRadius: '2px' 
          }} />
          <span>Отменено</span>
        </div>
      </div>
    </Card>
  );
};

export default SimpleGanttChart;
