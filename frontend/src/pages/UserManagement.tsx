import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Form, 
  Select, 
  Input,
  message, 
  Space, 
  Tooltip, 
  Card, 
  Statistic, 
  Row, 
  Col,
  Popconfirm,
  Descriptions,
  Divider,
  Tag,
  Progress,
  Typography,
  Switch,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  UsergroupAddOutlined,
  UserSwitchOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from '../hooks/usePermissions';
import usersApi, { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest,
  ChangePasswordRequest
} from '../services/usersApi';

const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

export const UserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const { canManage, canCreate, canEdit, canDelete } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Модальные окна
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  
  // Данные для модальных окон
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Формы
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  
  // Фильтры
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  
  // Статистика
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    directors: 0,
    managers: 0,
    production: 0,
    warehouse: 0
  });

  // Загрузка данных
  useEffect(() => {
    if (canManage('users')) {
      loadData();
      loadStatistics();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (roleFilter !== 'all') {
        params.role = roleFilter;
      }
      
      if (searchText.trim()) {
        params.search = searchText.trim();
      }
      
      const data = await usersApi.getUsers(params);
      setUsers(data);
    } catch (error) {
      message.error('Ошибка загрузки пользователей');
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await usersApi.getUserStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // Обновление данных при изменении фильтров
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (canManage('users')) {
        loadData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [roleFilter, searchText, user]);

  // Создание пользователя
  const handleCreateUser = async (values: any) => {
    try {
      setActionLoading(true);
      
      const request: CreateUserRequest = {
        username: values.username,
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: values.role
      };
      
      await usersApi.createUser(request);
      message.success('Пользователь создан');
      
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка создания пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  // Обновление пользователя
  const handleUpdateUser = async (values: any) => {
    if (!selectedUser) return;
    
    try {
      setActionLoading(true);
      
      const request: UpdateUserRequest = {
        fullName: values.fullName,
        email: values.email,
        role: values.role,
        isActive: values.isActive
      };
      
      await usersApi.updateUser(selectedUser.id, request);
      message.success('Пользователь обновлен');
      
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedUser(null);
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка обновления пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  // Изменение пароля
  const handleChangePassword = async (values: any) => {
    if (!selectedUser) return;
    
    try {
      setActionLoading(true);
      
      const request: ChangePasswordRequest = {
        newPassword: values.newPassword
      };
      
      await usersApi.changePassword(selectedUser.id, request);
      message.success('Пароль изменен');
      
      setPasswordModalVisible(false);
      passwordForm.resetFields();
      setSelectedUser(null);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка изменения пароля');
    } finally {
      setActionLoading(false);
    }
  };

  // Деактивация пользователя
  const handleDeactivateUser = async (userData: User) => {
    try {
      setActionLoading(true);
      await usersApi.deactivateUser(userData.id);
      message.success('Пользователь деактивирован');
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка деактивации пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  // Активация пользователя
  const handleActivateUser = async (userData: User) => {
    try {
      setActionLoading(true);
      await usersApi.activateUser(userData.id);
      message.success('Пользователь активирован');
      loadData();
      loadStatistics();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка активации пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  // Просмотр деталей пользователя
  const handleViewDetails = async (userData: User) => {
    try {
      setLoading(true);
      const details = await usersApi.getUser(userData.id);
      setSelectedUser(details);
      setDetailsModalVisible(true);
    } catch (error: any) {
      message.error('Ошибка загрузки деталей пользователя');
    } finally {
      setLoading(false);
    }
  };

  // Открытие модального окна редактирования
  const openEditModal = (userData: User) => {
    setSelectedUser(userData);
    editForm.setFieldsValue({
      fullName: userData.fullName,
      email: userData.email,
      role: userData.role,
      isActive: userData.isActive
    });
    setEditModalVisible(true);
  };

  // Открытие модального окна смены пароля
  const openPasswordModal = (userData: User) => {
    setSelectedUser(userData);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  // Генерация случайного пароля
  const generatePassword = () => {
    const password = usersApi.generateRandomPassword(8);
    createForm.setFieldsValue({ password });
    passwordForm.setFieldsValue({ newPassword: password });
  };

  // Генерация логина на основе полного имени или случайно
  const generateUsername = () => {
    const fullName = createForm.getFieldValue('fullName');
    let username = '';
    
    if (fullName && fullName.trim()) {
      // Создаем логин на основе полного имени
      const nameParts = fullName.trim().toLowerCase()
        .replace(/[^а-яё\s]/gi, '') // убираем все кроме кириллицы и пробелов
        .split(' ')
        .filter((part: string) => part.length > 0);
      
      if (nameParts.length >= 2) {
        // Формат: имя.фамилия  
        username = `${transliterate(nameParts[0])}.${transliterate(nameParts[1])}`;
      } else if (nameParts.length === 1) {
        // Только одно слово
        username = transliterate(nameParts[0]);
      } else {
        // Если нет кириллицы, используем как есть
        const parts = fullName.trim().toLowerCase().split(' ');
        username = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
      }
    } else {
      // Генерируем случайный логин
      username = `user${Math.floor(Math.random() * 10000)}`;
    }
    
    // Убираем недопустимые символы и добавляем случайные цифры если нужно
    username = username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
    if (username.length < 3) {
      username += Math.floor(Math.random() * 100);
    }
    
    createForm.setFieldsValue({ username });
  };

  // Функция транслитерации кириллицы в латиницу
  const transliterate = (text: string): string => {
    const map: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    return text.toLowerCase().split('').map(char => map[char] || char).join('');
  };

  // Фильтрация пользователей
  const filteredUsers = users.filter(userData => {
    if (statusFilter === 'active' && !userData.isActive) return false;
    if (statusFilter === 'inactive' && userData.isActive) return false;
    return true;
  });

  // Проверка прав доступа
  if (!canManage('users')) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Доступ запрещен"
          description="У вас нет прав для управления пользователями"
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Колонки таблицы
  const columns = [
    {
      title: 'Имя пользователя',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (text: string, record: User) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          {record.fullName && (
            <div style={{ fontSize: '12px', color: '#666' }}>{record.fullName}</div>
          )}
        </div>
      )
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: User['role']) => (
        <Tag color={usersApi.getRoleColor(role)}>
          {usersApi.getRoleText(role)}
        </Tag>
      )
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string) => email || '-'
    },
    {
      title: 'Статус',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Badge 
          color={usersApi.getStatusColor(isActive)} 
          text={usersApi.getStatusText(isActive)} 
        />
      )
    },
    {
      title: 'Дата создания',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => usersApi.formatDate(date)
    },
    {
      title: 'Последнее изменение',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => usersApi.formatDate(date)
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (record: User) => {
        const isCurrentUser = record.id === user?.id;
        
        return (
          <Space size="small">
            <Tooltip title="Просмотр">
              <Button 
                type="text" 
                icon={<EyeOutlined />} 
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>
            
            <Tooltip title="Редактировать">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
            
            <Tooltip title="Изменить пароль">
              <Button 
                type="text" 
                icon={<KeyOutlined />} 
                onClick={() => openPasswordModal(record)}
              />
            </Tooltip>
            
            {record.isActive ? (
              !isCurrentUser && (
                <Tooltip title="Деактивировать">
                  <Popconfirm
                    title="Деактивировать пользователя?"
                    description="Пользователь не сможет войти в систему"
                    onConfirm={() => handleDeactivateUser(record)}
                  >
                    <Button 
                      type="text" 
                      icon={<CloseCircleOutlined />} 
                      danger 
                      loading={actionLoading}
                    />
                  </Popconfirm>
                </Tooltip>
              )
            ) : (
              <Tooltip title="Активировать">
                <Popconfirm
                  title="Активировать пользователя?"
                  description="Пользователь сможет войти в систему"
                  onConfirm={() => handleActivateUser(record)}
                >
                  <Button 
                    type="text" 
                    icon={<CheckCircleOutlined />} 
                    style={{ color: '#52c41a' }}
                    loading={actionLoading}
                  />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, display: 'inline-flex', alignItems: 'center' }}>
          <UsergroupAddOutlined style={{ marginRight: '8px' }} />
          Управление пользователями
        </Title>
      </div>

      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic title="Всего пользователей" value={statistics.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Активных" 
              value={statistics.active} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Неактивных" 
              value={statistics.inactive} 
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic 
              title="Директоров" 
              value={statistics.directors} 
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic 
              title="Менеджеров" 
              value={statistics.managers} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic 
              title="Производство" 
              value={statistics.production} 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic 
              title="Склад" 
              value={statistics.warehouse} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Управление */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 200 }}
          >
            <Option value="all">Все роли</Option>
            <Option value="director">Директоры</Option>
            <Option value="manager">Менеджеры</Option>
            <Option value="production">Производство</Option>
            <Option value="warehouse">Склад</Option>
          </Select>
          
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
          >
            <Option value="all">Все статусы</Option>
            <Option value="active">Активные</Option>
            <Option value="inactive">Неактивные</Option>
          </Select>
          
          <Input.Search
            placeholder="Поиск по имени, email..."
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            Обновить
          </Button>
        </Space>
        
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          Добавить пользователя
        </Button>
      </div>

      {/* Таблица пользователей */}
      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `Всего ${total} пользователей`,
        }}
      />

      {/* Модальное окно создания пользователя */}
      <Modal
        title="Создать пользователя"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={actionLoading}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Имя пользователя"
                rules={[
                  { required: true, message: 'Введите имя пользователя' },
                  { min: 3, message: 'Минимум 3 символа' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: 'Только латинские буквы, цифры и подчеркивания' }
                ]}
              >
                <Input 
                  placeholder="username" 
                  addonAfter={
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={generateUsername}
                      style={{ padding: 0 }}
                    >
                      Генерировать
                    </Button>
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fullName"
                label="Полное имя"
              >
                <Input placeholder="Иван Иванов" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { type: 'email', message: 'Некорректный формат email' }
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Роль"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
            <Select placeholder="Выберите роль">
              {usersApi.getAvailableRoles().map(role => (
                <Option key={role.value} value={role.value}>
                  {role.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 6, message: 'Минимум 6 символов' }
            ]}
          >
            <Input.Password 
              placeholder="Минимум 6 символов"
              addonAfter={
                <Button 
                  type="link" 
                  size="small" 
                  onClick={generatePassword}
                  style={{ padding: 0 }}
                >
                  Генерировать
                </Button>
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно редактирования пользователя */}
      <Modal
        title="Редактировать пользователя"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedUser(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={actionLoading}
        width={600}
      >
        {selectedUser && (
          <>
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
              <Text strong>Пользователь: </Text>{selectedUser.username}
              <br />
              <Text strong>Текущая роль: </Text>
              <Tag color={usersApi.getRoleColor(selectedUser.role)}>
                {usersApi.getRoleText(selectedUser.role)}
              </Tag>
            </div>
            
            <Form
              form={editForm}
              layout="vertical"
              onFinish={handleUpdateUser}
            >
              <Form.Item
                name="fullName"
                label="Полное имя"
              >
                <Input placeholder="Иван Иванов" />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { type: 'email', message: 'Некорректный формат email' }
                ]}
              >
                <Input placeholder="user@example.com" />
              </Form.Item>

              <Form.Item
                name="role"
                label="Роль"
                rules={[{ required: true, message: 'Выберите роль' }]}
              >
                <Select placeholder="Выберите роль">
                  {usersApi.getAvailableRoles().map(role => (
                    <Option key={role.value} value={role.value}>
                      {role.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="isActive"
                label="Статус"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="Активен" 
                  unCheckedChildren="Неактивен"
                  disabled={selectedUser.id === user?.id}
                />
              </Form.Item>

              {selectedUser.id === user?.id && (
                <Alert
                  message="Вы не можете изменить свою роль или статус активности"
                  type="warning"
                  showIcon
                  style={{ marginTop: '16px' }}
                />
              )}
            </Form>
          </>
        )}
      </Modal>

      {/* Модальное окно смены пароля */}
      <Modal
        title="Изменить пароль"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
          setSelectedUser(null);
        }}
        onOk={() => passwordForm.submit()}
        confirmLoading={actionLoading}
        width={500}
      >
        {selectedUser && (
          <>
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
              <Text strong>Пользователь: </Text>{selectedUser.username}
            </div>
            
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
            >
              <Form.Item
                name="newPassword"
                label="Новый пароль"
                rules={[
                  { required: true, message: 'Введите новый пароль' },
                  { min: 6, message: 'Минимум 6 символов' }
                ]}
              >
                <Input.Password 
                  placeholder="Минимум 6 символов"
                  addonAfter={
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={generatePassword}
                      style={{ padding: 0 }}
                    >
                      Генерировать
                    </Button>
                  }
                />
              </Form.Item>

              <Alert
                message="Уведомите пользователя о смене пароля"
                type="info"
                showIcon
              />
            </Form>
          </>
        )}
      </Modal>

      {/* Модальное окно деталей пользователя */}
      <Modal
        title="Детали пользователя"
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setSelectedUser(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={600}
      >
        {selectedUser && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{selectedUser.id}</Descriptions.Item>
            <Descriptions.Item label="Имя пользователя">{selectedUser.username}</Descriptions.Item>
            <Descriptions.Item label="Полное имя">
              {selectedUser.fullName || 'Не указано'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {selectedUser.email || 'Не указан'}
            </Descriptions.Item>
            <Descriptions.Item label="Роль">
              <Tag color={usersApi.getRoleColor(selectedUser.role)}>
                {usersApi.getRoleText(selectedUser.role)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Статус">
              <Badge 
                color={usersApi.getStatusColor(selectedUser.isActive)} 
                text={usersApi.getStatusText(selectedUser.isActive)} 
              />
            </Descriptions.Item>
            <Descriptions.Item label="Дата создания">
              {usersApi.formatDateTime(selectedUser.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Последнее изменение">
              {usersApi.formatDateTime(selectedUser.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default UserManagement; 