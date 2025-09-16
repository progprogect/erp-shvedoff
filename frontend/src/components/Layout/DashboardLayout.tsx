import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Button, Badge, Spin } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  ScissorOutlined,
  TruckOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  UsergroupAddOutlined,
  SafetyOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { permissionsApi, MenuPermissions } from '../../services/permissionsApi';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [menuPermissions, setMenuPermissions] = useState<MenuPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const { user, logout } = useAuthStore();
  const permissionsHook = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Загружаем разрешения пользователя
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        setPermissionsLoading(true);
        const permissions = await permissionsApi.getMenuPermissions();
        setMenuPermissions(permissions);
      } catch (error) {
        console.error('Ошибка загрузки разрешений:', error);
        // В случае ошибки используем fallback на основе ролей
        setMenuPermissions(null);
      } finally {
        setPermissionsLoading(false);
      }
    };

    if (user) {
      loadPermissions();
    }
  }, [user]);

  // Меню на основе динамических разрешений
  const getMenuItems = () => {
    // Если разрешения еще загружаются или ошибка - используем fallback на основе ролей
    if (!menuPermissions) {
      return getLegacyMenuItems();
    }

    const menuItems = [];

    // Каталог товаров
    if (menuPermissions.catalog) {
      menuItems.push({
        key: '/catalog',
        icon: <AppstoreOutlined />,
        label: 'Каталог товаров',
      });
    }

    // Остатки на складе
    if (menuPermissions.stock) {
      menuItems.push({
        key: '/stock',
        icon: <InboxOutlined />,
        label: 'Остатки на складе',
      });
    }

    // Заказы
    if (menuPermissions.orders) {
      menuItems.push({
        key: '/orders',
        icon: <ShoppingCartOutlined />,
        label: 'Заказы',
      });
    }

    // Производство
    if (menuPermissions.production) {
      menuItems.push({
        key: '/production',
        icon: <ToolOutlined />,
        label: 'Производство',
      });
    }

    // Операции резки
    if (menuPermissions.cutting) {
      menuItems.push({
        key: '/cutting',
        icon: <ScissorOutlined />,
        label: 'Операции резки',
      });
    }

    // Отгрузки
    if (menuPermissions.shipments) {
      menuItems.push({
        key: '/shipments',
        icon: <TruckOutlined />,
        label: 'Отгрузки',
      });
    }

    // Управление пользователями
    if (menuPermissions.users) {
      menuItems.push({
        key: '/users',
        icon: <UsergroupAddOutlined />,
        label: 'Управление пользователями',
      });
    }

    // Разрешения
    if (menuPermissions.permissions) {
      menuItems.push({
        key: '/permissions',
        icon: <SafetyOutlined />,
        label: 'Разрешения',
      });
    }

    // Аудит
    if (menuPermissions.audit) {
      menuItems.push({
        key: '/audit',
        icon: <HistoryOutlined />,
        label: 'История изменений',
      });
    }

    return menuItems;
  };

  // Fallback меню на основе ролей (для совместимости при ошибке API)
  const getLegacyMenuItems = () => {
    const baseItems = [
      {
        key: '/catalog',
        icon: <AppstoreOutlined />,
        label: 'Каталог товаров',
      },
      {
        key: '/stock',
        icon: <InboxOutlined />,
        label: 'Остатки на складе',
      }
    ];

    const managerDirectorItems = [
      {
        key: '/orders',
        icon: <ShoppingCartOutlined />,
        label: 'Заказы',
      }
    ];

    const productionItems = [
      {
        key: '/production',
        icon: <ToolOutlined />,
        label: 'Производство',
      },
      {
        key: '/cutting',
        icon: <ScissorOutlined />,
        label: 'Операции резки',
      }
    ];

    const logisticsItems = [
      {
        key: '/shipments',
        icon: <TruckOutlined />,
        label: 'Отгрузки',
      }
    ];

    const directorItems = [
      {
        key: '/users',
        icon: <UsergroupAddOutlined />,
        label: 'Управление пользователями',
      },
      {
        key: '/permissions',
        icon: <SafetyOutlined />,
        label: 'Разрешения',
      },
      {
        key: '/audit',
        icon: <HistoryOutlined />,
        label: 'История изменений',
      }
    ];

    let menuItems = [...baseItems];

    if (permissionsHook.canEdit('orders') || permissionsHook.canManage('orders')) {
      menuItems = [...menuItems, ...managerDirectorItems];
    }

    if (permissionsHook.canEdit('production') || permissionsHook.canManage('production')) {
      menuItems = [...menuItems, ...productionItems];
    }

    // Отгрузки доступны всем ролям
    menuItems = [...menuItems, ...logisticsItems];

    if (permissionsHook.canManage('users') || permissionsHook.canManage('permissions')) {
      menuItems = [...menuItems, ...directorItems];
    }

    return menuItems;
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Профиль',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      onClick: handleLogout,
    },
  ];

  const getRoleDisplayName = (role: string) => {
    const roleNames = {
      director: 'Директор по продажам',
      manager: 'Менеджер по продажам', 
      production: 'Сотрудник производства',
      warehouse: 'Сотрудник склада'
    };
    return roleNames[role as keyof typeof roleNames] || role;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,.15)'
        }}
      >
        <div className="logo">
          {collapsed ? '🏭' : 'ERP Shvedoff'}
        </div>
        {permissionsLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="small" />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
              Загрузка меню...
            </div>
          </div>
        ) : (
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={getMenuItems()}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0 }}
          />
        )}
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          <Space size="large">
            <Badge count={0} showZero={false}>
              <Button 
                type="text" 
                icon={<BellOutlined />} 
                size="large"
                style={{ fontSize: '16px' }}
              />
            </Badge>

            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar 
                  style={{ backgroundColor: '#1890ff' }} 
                  icon={<UserOutlined />} 
                />
                <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>
                      {user?.fullName || user?.username}
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {user?.role && getRoleDisplayName(user.role)}
                    </Text>
                  </div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 112px)',
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout; 