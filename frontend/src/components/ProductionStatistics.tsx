import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Select, Table, Statistic, Row, Col, Typography, Spin, message, Tag, Space, Button } from 'antd';
import { BarChartOutlined, CalendarOutlined, ProductOutlined, TrophyOutlined } from '@ant-design/icons';
import { getDayStatistics, getDetailedStatistics } from '../services/productionApi';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const ProductionStatistics: React.FC = () => {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [detailedStats, setDetailedStats] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalTasks: 0,
    totalQuantity: 0,
    totalQuality: 0,
    totalDefects: 0
  });

  // Загрузка статистики
  const loadStatistics = async () => {
    if (!token || !dateRange[0] || !dateRange[1]) return;

    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const [dailyResponse, detailedResponse] = await Promise.all([
        getDayStatistics(startDate, endDate),
        getDetailedStatistics(startDate, endDate, period)
      ]);

      if (dailyResponse.success) {
        setDailyStats(dailyResponse.data);
      }

      if (detailedResponse.success) {
        setDetailedStats(detailedResponse.data);
        
        // Подсчитываем общую статистику
        const totals = detailedResponse.data.reduce((acc: any, item: any) => ({
          totalTasks: acc.totalTasks + (item.totalTasks || 0),
          totalQuantity: acc.totalQuantity + (item.totalQuantity || 0),
          totalQuality: acc.totalQuality + (item.qualityQuantity || 0),
          totalDefects: acc.totalDefects + (item.defectQuantity || 0)
        }), { totalTasks: 0, totalQuantity: 0, totalQuality: 0, totalDefects: 0 });
        
        setSummary(totals);
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
  }, [token, dateRange, period]);

  // Обработчик изменения периода
  const handlePeriodChange = (newPeriod: 'day' | 'week' | 'month') => {
    setPeriod(newPeriod);
  };

  // Обработчик изменения диапазона дат
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  // Форматирование периода для отображения
  const formatPeriod = (periodStr: string) => {
    if (!periodStr) return '';
    
    switch (period) {
      case 'week':
        return dayjs(periodStr).format('DD.MM.YYYY') + ' - ' + dayjs(periodStr).add(6, 'days').format('DD.MM.YYYY');
      case 'month':
        return dayjs(periodStr).format('MMMM YYYY');
      default:
        return dayjs(periodStr).format('DD.MM.YYYY');
    }
  };

  // Колонки для таблицы детальной статистики
  const detailedColumns = [
    {
      title: 'Период',
      dataIndex: 'period',
      key: 'period',
      render: (period: string) => (
        <Text strong>{formatPeriod(period)}</Text>
      )
    },
    {
      title: 'Товар',
      key: 'product',
      render: (record: any) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.productName}</Text>
          {record.productArticle && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Артикул: {record.productArticle}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Заданий',
      dataIndex: 'totalTasks',
      key: 'totalTasks',
      render: (count: number) => (
        <Tag icon={<BarChartOutlined />} color="blue">
          {count}
        </Tag>
      )
    },
    {
      title: 'Произведено',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (quantity: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {quantity || 0} шт.
        </Text>
      )
    },
    {
      title: 'Годных',
      dataIndex: 'qualityQuantity',
      key: 'qualityQuantity',
      render: (quantity: number) => (
        <Text style={{ color: '#52c41a' }}>
          {quantity || 0} шт.
        </Text>
      )
    },
    {
      title: 'Брак',
      dataIndex: 'defectQuantity',
      key: 'defectQuantity',
      render: (quantity: number) => (
        <Text style={{ color: '#f5222d' }}>
          {quantity || 0} шт.
        </Text>
      )
    },
    {
      title: 'Качество',
      key: 'quality',
      render: (record: any) => {
        const total = record.totalQuantity || 0;
        const quality = record.qualityQuantity || 0;
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
      title: 'Общее количество',
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
          <Col span={8}>
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
            <Space>
              <Text strong>Группировка:</Text>
              <Select
                value={period}
                onChange={handlePeriodChange}
                style={{ width: 120 }}
              >
                <Option value="day">По дням</Option>
                <Option value="week">По неделям</Option>
                <Option value="month">По месяцам</Option>
              </Select>
            </Space>
          </Col>
          <Col span={4}>
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

      {/* Общая статистика */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего заданий"
              value={summary.totalTasks}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Произведено"
              value={summary.totalQuantity}
              suffix="шт."
              prefix={<ProductOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Годных"
              value={summary.totalQuality}
              suffix="шт."
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Брак"
              value={summary.totalDefects}
              suffix="шт."
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Статистика по дням */}
      <Card 
        title={
          <Space>
            <CalendarOutlined />
            Статистика по дням
          </Space>
        }
        style={{ marginBottom: '16px' }}
      >
        <Spin spinning={loading}>
          <Table
            columns={dailyColumns}
            dataSource={dailyStats}
            rowKey="production_date"
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        </Spin>
      </Card>

      {/* Детальная статистика по товарам */}
      <Card 
        title={
          <Space>
            <ProductOutlined />
            Детальная статистика по товарам
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={detailedColumns}
            dataSource={detailedStats}
            rowKey={(record) => `${record.period}_${record.productId}`}
            pagination={{ pageSize: 20 }}
            size="middle"
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: '8px 16px' }}>
                  <Text type="secondary">
                    Дополнительная информация по товару {record.productName}
                  </Text>
                  <Row gutter={16} style={{ marginTop: '8px' }}>
                    <Col span={6}>
                      <Text strong>Среднее за задание: </Text>
                      <Text>
                        {record.totalTasks > 0 ? 
                          Math.round(record.totalQuantity / record.totalTasks) : 0
                        } шт.
                      </Text>
                    </Col>
                    <Col span={6}>
                      <Text strong>Процент брака: </Text>
                      <Text style={{ color: '#f5222d' }}>
                        {record.totalQuantity > 0 ? 
                          ((record.defectQuantity / record.totalQuantity) * 100).toFixed(2) : 0
                        }%
                      </Text>
                    </Col>
                  </Row>
                </div>
              ),
              rowExpandable: () => true,
            }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default ProductionStatistics; 