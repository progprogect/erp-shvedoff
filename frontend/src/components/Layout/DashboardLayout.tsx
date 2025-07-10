import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Button, Badge } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  TruckOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Меню для разных ролей
  const getMenuItems = () => {
    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Дашборд',
      }
    ];

    const allRolesItems = [
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
      }
    ];

    const warehouseItems = [
      {
        key: '/shipments',
        icon: <TruckOutlined />,
        label: 'Отгрузки',
      }
    ];

    const directorItems = [
      {
        key: '/audit',
        icon: <HistoryOutlined />,
        label: 'История изменений',
      }
    ];

    let menuItems = [...baseItems, ...allRolesItems];

    if (user?.role === 'manager' || user?.role === 'director') {
      menuItems = [...menuItems, ...managerDirectorItems];
    }

    if (user?.role === 'production' || user?.role === 'director') {
      menuItems = [...menuItems, ...productionItems];
    }

    if (user?.role === 'warehouse' || user?.role === 'director') {
      menuItems = [...menuItems, ...warehouseItems];
    }

    if (user?.role === 'director') {
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
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
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