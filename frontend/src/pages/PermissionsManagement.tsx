import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Switch,
  Button,
  message,
  Spin,
  Typography,
  Space,
  Tag,
  Tooltip,
  Modal,
  Form,
  Select,
  Checkbox,
  Row,
  Col,
  Alert,
  Divider
} from 'antd';
import {
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { 
  permissionsApi, 
  Permission, 
  UserPermissions, 
  UserPermission 
} from '../services/permissionsApi';
import { usersApi, User } from '../services/usersApi';
import { usePermissionsContext } from '../contexts/PermissionsContext';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const roleLabels: Record<string, string> = {
  director: 'Директор',
  manager: 'Менеджер',
  production: 'Производство',
  warehouse: 'Склад'
};

const resourceLabels: Record<string, string> = {
  catalog: 'Каталог товаров',
  stock: 'Остатки',
  orders: 'Заказы',
  production: 'Производство',
  cutting: 'Операции резки',
  shipments: 'Отгрузки',
  users: 'Пользователи',
  permissions: 'Разрешения',
  audit: 'Аудит'
};

const actionLabels: Record<string, string> = {
  view: 'Просмотр',
  create: 'Создание',
  edit: 'Редактирование',
  delete: 'Удаление',
  manage: 'Управление',
  execute: 'Выполнение'
};

export const PermissionsManagement: React.FC = () => {
  const { invalidateAllPermissions } = usePermissionsContext();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, Permission[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [userPermissionsModal, setUserPermissionsModal] = useState<{
    visible: boolean;
    user?: User;
    permissions?: UserPermissions;
  }>({ visible: false });
  const [activeTab, setActiveTab] = useState('roles');

  // Загрузка данных
  const loadData = async () => {
    try {
      setLoading(true);
      const [permissionsData, rolePermissionsData, usersData] = await Promise.all([
        permissionsApi.getPermissions(),
        permissionsApi.getRolePermissions(),
        usersApi.getUsers()
      ]);

      setPermissions(permissionsData.permissions);
      setGroupedPermissions(permissionsData.grouped);
      setRolePermissions(rolePermissionsData);
      setUsers(usersData);
    } catch (error: any) {
      message.error(error.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Обновление разрешений роли
  const handleRolePermissionChange = async (role: string, permission: Permission, checked: boolean) => {
    try {
      const currentPermissions = rolePermissions[role] || [];
      const permissionIds = checked
        ? [...currentPermissions.map(p => p.id), permission.id]
        : currentPermissions.filter(p => p.id !== permission.id).map(p => p.id);

      await permissionsApi.setRolePermissions(role, permissionIds);
      
      // Обновляем локальное состояние
      setRolePermissions(prev => ({
        ...prev,
        [role]: checked
          ? [...currentPermissions, permission]
          : currentPermissions.filter(p => p.id !== permission.id)
      }));

      message.success('Разрешения роли обновлены');
      
      // Принудительно обновляем разрешения во всех компонентах
      invalidateAllPermissions();
    } catch (error: any) {
      message.error(error.message || 'Ошибка обновления разрешений');
    }
  };

  // Открытие модального окна для управления разрешениями пользователя
  const handleUserPermissionsEdit = async (user: User) => {
    try {
      setLoading(true);
      const userPermissions = await permissionsApi.getUserPermissions(user.id);
      setUserPermissionsModal({
        visible: true,
        user,
        permissions: userPermissions
      });
    } catch (error: any) {
      message.error(error.message || 'Ошибка загрузки разрешений пользователя');
    } finally {
      setLoading(false);
    }
  };

  // Сохранение индивидуальных разрешений пользователя
  const handleSaveUserPermissions = async (values: any) => {
    try {
      const { user } = userPermissionsModal;
      if (!user) return;

      // Формируем массив изменений (только те, что отличаются от роли)
      const userPermissionChanges: Array<{ permissionId: number; granted: boolean }> = [];
      
      Object.keys(values).forEach(key => {
        if (key.startsWith('permission_')) {
          const permissionId = parseInt(key.replace('permission_', ''));
          const granted = values[key];
          const permission = permissions.find(p => p.id === permissionId);
          const rolePermission = rolePermissions[user.role]?.find(p => p.id === permissionId);
          
          // Добавляем только если значение отличается от роли
          if (!!rolePermission !== granted) {
            userPermissionChanges.push({ permissionId, granted });
          }
        }
      });

      await permissionsApi.setUserPermissions(user.id, userPermissionChanges);
      setUserPermissionsModal({ visible: false });
      message.success('Разрешения пользователя обновлены');
      
      // Принудительно обновляем разрешения во всех компонентах
      invalidateAllPermissions();
    } catch (error: any) {
      message.error(error.message || 'Ошибка сохранения разрешений');
    }
  };

  // Инициализация базовых разрешений
  const handleInitializePermissions = async () => {
    try {
      await permissionsApi.initializePermissions();
      await loadData();
      message.success('Базовые разрешения инициализированы');
    } catch (error: any) {
      message.error(error.message || 'Ошибка инициализации');
    }
  };

  // Колонки для таблицы ролей
  const roleColumns = [
    {
      title: 'Разрешение',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Permission) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {resourceLabels[record.resource]} → {actionLabels[record.action]}
          </Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
              {record.description}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Ресурс',
      dataIndex: 'resource',
      key: 'resource',
      render: (resource: string) => (
        <Tag color="blue">{resourceLabels[resource] || resource}</Tag>
      )
    },
    {
      title: 'Действие',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color="green">{actionLabels[action] || action}</Tag>
      )
    },
    ...Object.keys(roleLabels).map(role => ({
      title: roleLabels[role],
      key: role,
      align: 'center' as const,
      render: (record: Permission) => {
        const hasPermission = rolePermissions[role]?.some(p => p.id === record.id) || false;
        return (
          <Switch
            checked={hasPermission}
            onChange={(checked) => handleRolePermissionChange(role, record, checked)}
            size="small"
          />
        );
      }
    }))
  ];

  // Колонки для таблицы пользователей
  const userColumns = [
    {
      title: 'Пользователь',
      key: 'user',
      render: (user: User) => (
        <Space>
          <UserOutlined />
          <div>
            <div><Text strong>{user.fullName}</Text></div>
            <div><Text type="secondary">@{user.username}</Text></div>
          </div>
        </Space>
      )
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color="blue">{roleLabels[role] || role}</Tag>
      )
    },
    {
      title: 'Статус',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Активен' : 'Неактивен'}
        </Tag>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (user: User) => (
        <Button
          type="link"
          icon={<SettingOutlined />}
          onClick={() => handleUserPermissionsEdit(user)}
        >
          Разрешения
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <SafetyOutlined /> Управление разрешениями
        </Title>
        <Text type="secondary">
          Настройка доступа к разделам и функциям системы для ролей и отдельных пользователей
        </Text>
      </div>

      <Card>
        <Space style={{ marginBottom: '16px' }}>
          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={handleInitializePermissions}
            loading={loading}
          >
            Инициализировать базовые разрешения
          </Button>
          <Tooltip title="Создает стандартный набор разрешений и назначает их ролям">
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
          </Tooltip>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane 
            tab={
              <span>
                <TeamOutlined />
                Разрешения ролей
              </span>
            } 
            key="roles"
          >
            <Alert
              message="Управление разрешениями по ролям"
              description="Здесь вы можете настроить какие разрешения доступны для каждой роли. Индивидуальные разрешения пользователей имеют приоритет над ролевыми."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Spin spinning={loading}>
              <Table
                columns={roleColumns}
                dataSource={permissions}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1000 }}
              />
            </Spin>
          </TabPane>

          <TabPane 
            tab={
              <span>
                <UserOutlined />
                Пользователи
              </span>
            } 
            key="users"
          >
            <Alert
              message="Индивидуальные разрешения пользователей"
              description="Для каждого пользователя можно установить индивидуальные разрешения, которые переопределяют разрешения роли."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              loading={loading}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Модальное окно редактирования разрешений пользователя */}
      <Modal
        title={`Разрешения пользователя: ${userPermissionsModal.user?.fullName}`}
        open={userPermissionsModal.visible}
        onCancel={() => setUserPermissionsModal({ visible: false })}
        width={800}
        footer={null}
      >
        {userPermissionsModal.permissions && (
          <Form
            layout="vertical"
            onFinish={handleSaveUserPermissions}
            initialValues={
              userPermissionsModal.permissions.permissions.reduce((acc, perm) => {
                acc[`permission_${perm.id}`] = perm.granted;
                return acc;
              }, {} as Record<string, boolean>)
            }
          >
            <Alert
              message={`Роль: ${roleLabels[userPermissionsModal.permissions.role]}`}
              description="Зеленым отмечены разрешения роли, которые можно переопределить индивидуально"
              type="info"
              style={{ marginBottom: '16px' }}
            />

            {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
              <Card 
                key={resource} 
                title={resourceLabels[resource] || resource}
                size="small"
                style={{ marginBottom: '16px' }}
              >
                <Row gutter={[16, 8]}>
                  {resourcePermissions.map(permission => {
                    const userPerm = userPermissionsModal.permissions?.permissions.find(
                      p => p.id === permission.id
                    );
                    const isRolePermission = userPerm?.source === 'role';
                    
                    return (
                      <Col span={12} key={permission.id}>
                        <Form.Item
                          name={`permission_${permission.id}`}
                          valuePropName="checked"
                          style={{ marginBottom: '8px' }}
                        >
                          <Checkbox>
                            <Space>
                              <span>{permission.name}</span>
                              {isRolePermission && (
                                <Tag color="green">
                                  Роль
                                </Tag>
                              )}
                              {userPerm?.source === 'user' && (
                                <Tag color="orange">
                                  Индивидуально
                                </Tag>
                              )}
                            </Space>
                          </Checkbox>
                        </Form.Item>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            ))}

            <Divider />
            
            <Space>
              <Button type="primary" htmlType="submit">
                <CheckCircleOutlined /> Сохранить
              </Button>
              <Button onClick={() => setUserPermissionsModal({ visible: false })}>
                Отмена
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PermissionsManagement; 