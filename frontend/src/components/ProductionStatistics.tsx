import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Table, Row, Col, Typography, Spin, Tag, Space, Button, App } from 'antd';
import { BarChartOutlined, CalendarOutlined, TrophyOutlined, LineChartOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getDayStatistics } from '../services/productionApi';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const ProductionStatistics: React.FC = () => {
  const { token } = useAuthStore();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  // Загрузка статистики
  const loadStatistics = async () => {
    if (!token || !dateRange[0] || !dateRange[1]) return;

    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const dailyResponse = await getDayStatistics(startDate, endDate);

      if (dailyResponse.success) {
        setDailyStats(dailyResponse.data);
        
        // Преобразуем данные для графика
        const chartDataFormatted = dailyResponse.data.map((item: any) => ({
          date: dayjs(item.production_date).format('DD.MM'),
          fullDate: dayjs(item.production_date).format('DD.MM.YYYY'),
          completedTasks: item.completed_tasks || 0,
          totalProduced: item.total_produced || 0,
          totalQuality: item.total_quality || 0,
          totalDefects: item.total_defects || 0,
          efficiency: item.total_produced > 0 ? 
            Math.round((item.total_quality / item.total_produced) * 100) : 0
        }));
        
        setChartData(chartDataFormatted);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      message.error('Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, [token, dateRange]);

  // Обработчик изменения диапазона дат
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  // Кастомный тултип для графика
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: '#fff',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{`Дата: ${data.fullDate}`}</p>
          <p style={{ margin: 0, color: '#722ed1' }}>{`Завершено заданий: ${data.completedTasks}`}</p>
          <p style={{ margin: 0, color: '#1890ff' }}>{`Произведено: ${data.totalProduced} шт.`}</p>
          <p style={{ margin: 0, color: '#52c41a' }}>{`Годных: ${data.totalQuality} шт.`}</p>
          <p style={{ margin: 0, color: '#f5222d' }}>{`Брак: ${data.totalDefects} шт.`}</p>
          <p style={{ margin: 0, color: '#fa8c16' }}>{`Эффективность: ${data.efficiency}%`}</p>
        </div>
      );
    }
    return null;
  };

  // Колонки для таблицы дневной статистики
  const dailyColumns = [
    {
      title: 'Дата',
      dataIndex: 'production_date',
      key: 'production_date',
      render: (date: string) => (
        <Text strong>{dayjs(date).format('DD.MM.YYYY')}</Text>
      )
    },
    {
      title: 'Заданий завершено',
      dataIndex: 'completed_tasks',
      key: 'completed_tasks',
      render: (count: number) => (
        <Tag icon={<TrophyOutlined />} color="purple">
          {count || 0}
        </Tag>
      )
    },
    {
      title: 'Произведено',
      dataIndex: 'total_produced',
      key: 'total_produced',
      render: (quantity: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {quantity || 0} шт.
        </Text>
      )
    },
    {
      title: 'Годных',
      dataIndex: 'total_quality',
      key: 'total_quality',
      render: (quantity: number) => (
        <Text style={{ color: '#52c41a' }}>
          {quantity || 0} шт.
        </Text>
      )
    },
    {
      title: 'Брак',
      dataIndex: 'total_defects',
      key: 'total_defects',
      render: (quantity: number) => (
        <Text style={{ color: '#f5222d' }}>
          {quantity || 0} шт.
        </Text>
      )
    },
    {
      title: 'Эффективность',
      key: 'efficiency',
      render: (record: any) => {
        const total = record.total_produced || 0;
        const quality = record.total_quality || 0;
        const percentage = total > 0 ? ((quality / total) * 100).toFixed(1) : '0';
        
        return (
          <Tag 
            color={parseFloat(percentage) >= 95 ? 'green' : parseFloat(percentage) >= 90 ? 'orange' : 'red'}
          >
            {percentage}%
          </Tag>
        );
      }
    }
  ];

  return (
    <div>
      {/* Панель управления */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Space>
              <CalendarOutlined />
              <Text strong>Период:</Text>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                format="DD.MM.YYYY"
              />
            </Space>
          </Col>
          <Col span={6}>
            <Button
              type="primary"
              icon={<BarChartOutlined />}
              onClick={loadStatistics}
              loading={loading}
            >
              Обновить
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {/* График производства по дням */}
        <Card 
          title={
            <Space>
              <LineChartOutlined />
              График производства по дням
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="completedTasks" 
                stroke="#722ed1" 
                strokeWidth={2}
                name="Завершено заданий"
              />
              <Line 
                type="monotone" 
                dataKey="totalProduced" 
                stroke="#1890ff" 
                strokeWidth={2}
                name="Произведено шт."
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Столбчатая диаграмма качества */}
        <Card 
          title={
            <Space>
              <BarChartOutlined />
              Качество производства по дням
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="totalQuality" fill="#52c41a" name="Годных шт." />
              <Bar dataKey="totalDefects" fill="#f5222d" name="Брак шт." />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Таблица с детализацией */}
        <Card 
          title={
            <Space>
              <CalendarOutlined />
              Детализация по дням
            </Space>
          }
        >
          <Table
            columns={dailyColumns}
            dataSource={dailyStats}
            rowKey="production_date"
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        </Card>
      </Spin>
    </div>
  );
};

export default ProductionStatistics; 