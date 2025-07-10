import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Table, Typography, Button, Space, Select, DatePicker, 
  Input, Tag, Drawer, message, Statistic, Tabs, Badge, Timeline
} from 'antd';
import {
  HistoryOutlined, FilterOutlined, ReloadOutlined, EyeOutlined,
  UserOutlined, CalendarOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { auditApi, AuditLog, AuditStats, AuditFilters } from '../services/auditApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const AuditHistory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({
    page: 1,
    limit: 50
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  const { token } = useAuthStore();

  useEffect(() => {
    if (token) {
      loadData();
      loadStats();
    }
  }, [token, filters]);

  const loadData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await auditApi.getAuditLogs(filters, token);
      if (response.success) {
        setLogs(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0,
          current: response.pagination?.page || 1
        }));
      } else {
        message.error(response.message || 'Ошибка загрузки логов');
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
      message.error('Ошибка загрузки логов аудита');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!token) return;
    
    try {
      const response = await auditApi.getAuditStats(token);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading audit stats:', error);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Сбрасываем на первую страницу при изменении фильтров
    }));
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        dateFrom: dates[0].format('YYYY-MM-DD'),
        dateTo: dates[1].format('YYYY-MM-DD'),
        page: 1
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        dateFrom: undefined,
        dateTo: undefined,
        page: 1
      }));
    }
  };

  const handleTableChange = (paginationInfo: any) => {
    setFilters(prev => ({
      ...prev,
      page: paginationInfo.current,
      limit: paginationInfo.pageSize
    }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50
    });
  };

  const showDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsVisible(true);
  };

  const getOperationColor = (operation: string) => {
    const colors = {
      'INSERT': 'green',
      'UPDATE': 'orange', 
      'DELETE': 'red'
    };
    return colors[operation as keyof typeof colors] || 'default';
  };

  const getTableColor = (tableName: string) => {
    const colors = {
      'products': 'blue',
      'categories': 'purple',
      'orders': 'cyan',
      'users': 'gold',
      'stock': 'lime'
    };
    return colors[tableName as keyof typeof colors] || 'default';
  };

  const columns = [
    {
      title: 'Дата и время',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <div>
          <div>{dayjs(date).format('DD.MM.YYYY')}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(date).format('HH:mm:ss')}
          </Text>
        </div>
      )
    },
    {
      title: 'Операция',
      dataIndex: 'operation',
      key: 'operation',
      width: 120,
      render: (operation: string, record: AuditLog) => (
        <Tag color={getOperationColor(operation)}>
          {record.operationText}
        </Tag>
      )
    },
    {
      title: 'Объект',
      dataIndex: 'tableName',
      key: 'tableName',
      width: 150,
      render: (tableName: string, record: AuditLog) => (
        <div>
          <Tag color={getTableColor(tableName)}>
            {record.tableText}
          </Tag>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.recordId}
          </Text>
        </div>
      )
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Пользователь',
      key: 'user',
      width: 200,
      render: (_: any, record: AuditLog) => (
        <div>
          <Text strong>{record.userName || 'Неизвестно'}</Text>
          <br />
                                    <Tag>{record.userRole}</Tag>
        </div>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: any, record: AuditLog) => (
        <Button 
          size="small" 
          icon={<EyeOutlined />}
          onClick={() => showDetails(record)}
        >
          Детали
        </Button>
      )
    }
  ];

  const hasActiveFilters = Object.keys(filters).some(key => 
    key !== 'page' && key !== 'limit' && filters[key as keyof AuditFilters]
  );

  return (
    <div>
      <Row gutter={[0, 24]}>
        {/* Header */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                <HistoryOutlined style={{ marginRight: 12 }} />
                История изменений
              </Title>
              <Text type="secondary">
                Журнал всех операций в системе с возможностью фильтрации
              </Text>
            </div>
            
            <Space>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => { loadData(); loadStats(); }}
                loading={loading}
              >
                Обновить
              </Button>
            </Space>
          </div>
        </Col>

        {/* Statistics */}
        {stats && (
          <Col span={24}>
            <Tabs defaultActiveKey="overview">
              <TabPane 
                tab={
                  <span>
                    <DatabaseOutlined />
                    Обзор
                  </span>
                } 
                key="overview"
              >
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Всего операций"
                        value={stats.operations.reduce((sum, op) => sum + op.count, 0)}
                        prefix={<HistoryOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Создано"
                        value={stats.operations.find(op => op.operation === 'INSERT')?.count || 0}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Изменено"
                        value={stats.operations.find(op => op.operation === 'UPDATE')?.count || 0}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Удалено"
                        value={stats.operations.find(op => op.operation === 'DELETE')?.count || 0}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <UserOutlined />
                    Активные пользователи
                  </span>
                } 
                key="users"
              >
                <Row gutter={16}>
                  {stats.users.slice(0, 4).map((user, index) => (
                    <Col xs={24} sm={12} lg={6} key={user.userId}>
                      <Card>
                        <Statistic
                          title={user.userName || 'Неизвестный пользователь'}
                          value={user.count}
                          prefix={<Badge count={index + 1} style={{ backgroundColor: '#108ee9' }} />}
                                                     suffix={<Tag>{user.userRole}</Tag>}
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <CalendarOutlined />
                    Активность за неделю
                  </span>
                } 
                key="activity"
              >
                <Timeline mode="left">
                  {stats.weeklyActivity.map((activity) => (
                    <Timeline.Item key={activity.date}>
                      <div>
                        <Text strong>{dayjs(activity.date).format('DD.MM.YYYY')}</Text>
                        <br />
                        <Text>{activity.count} операций</Text>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </TabPane>
            </Tabs>
          </Col>
        )}

        {/* Filters */}
        <Col span={24}>
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={6}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>Операция:</Text>
                  <Select
                    placeholder="Все операции"
                    style={{ width: '100%' }}
                    allowClear
                    value={filters.operation}
                    onChange={(value) => handleFilterChange('operation', value)}
                  >
                    <Option value="INSERT">Создание</Option>
                    <Option value="UPDATE">Изменение</Option>
                    <Option value="DELETE">Удаление</Option>
                  </Select>
                </Space>
              </Col>
              
              <Col xs={24} md={6}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>Таблица:</Text>
                  <Select
                    placeholder="Все таблицы"
                    style={{ width: '100%' }}
                    allowClear
                    value={filters.tableName}
                    onChange={(value) => handleFilterChange('tableName', value)}
                  >
                    <Option value="products">Товары</Option>
                    <Option value="categories">Категории</Option>
                    <Option value="orders">Заказы</Option>
                    <Option value="users">Пользователи</Option>
                    <Option value="stock">Остатки</Option>
                  </Select>
                </Space>
              </Col>
              
              <Col xs={24} md={8}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>Период:</Text>
                  <RangePicker
                    style={{ width: '100%' }}
                    format="DD.MM.YYYY"
                    onChange={handleDateRangeChange}
                    value={filters.dateFrom && filters.dateTo ? [
                      dayjs(filters.dateFrom),
                      dayjs(filters.dateTo)
                    ] : undefined}
                  />
                </Space>
              </Col>
              
              <Col xs={24} md={4}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>&nbsp;</Text>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    style={{ width: '100%' }}
                  >
                    Сбросить
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Table */}
        <Col span={24}>
          <Card>
            <Table
              columns={columns}
              dataSource={logs}
              rowKey="id"
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} из ${total} записей`
              }}
              onChange={handleTableChange}
              scroll={{ x: 1000 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Details Drawer */}
      <Drawer
        title="Детали операции"
        placement="right"
        width={600}
        open={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      >
        {selectedLog && (
          <div>
            <Row gutter={[0, 16]}>
              <Col span={24}>
                <Card title="Основная информация">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text strong>Операция:</Text>
                      <br />
                      <Tag color={getOperationColor(selectedLog.operation)}>
                        {selectedLog.operationText}
                      </Tag>
                    </Col>
                    <Col span={12}>
                      <Text strong>Объект:</Text>
                      <br />
                      <Tag color={getTableColor(selectedLog.tableName)}>
                        {selectedLog.tableText} #{selectedLog.recordId}
                      </Tag>
                    </Col>
                  </Row>
                  <br />
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text strong>Пользователь:</Text>
                      <br />
                      <Text>{selectedLog.userName || 'Неизвестно'}</Text>
                      <br />
                      <Tag>{selectedLog.userRole}</Tag>
                    </Col>
                    <Col span={12}>
                      <Text strong>Дата и время:</Text>
                      <br />
                      <Text>{dayjs(selectedLog.createdAt).format('DD.MM.YYYY HH:mm:ss')}</Text>
                    </Col>
                  </Row>
                </Card>
              </Col>

              {selectedLog.oldValues && (
                <Col span={24}>
                  <Card title="Старые значения">
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: '12px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(selectedLog.oldValues, null, 2)}
                    </pre>
                  </Card>
                </Col>
              )}

              {selectedLog.newValues && (
                <Col span={24}>
                  <Card title="Новые значения">
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: '12px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(selectedLog.newValues, null, 2)}
                    </pre>
                  </Card>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AuditHistory; 