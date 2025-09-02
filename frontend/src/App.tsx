import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, App as AntdApp } from 'antd';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/Layout/DashboardLayout';
import { PermissionsProvider, usePermissionsContext } from './contexts/PermissionsContext';
import usePermissions from './hooks/usePermissions';

import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import ProductionTasks from './pages/ProductionTasks';
import CuttingOperations from './pages/CuttingOperations';
import Shipments from './pages/Shipments';
import UserManagement from './pages/UserManagement';
import PermissionsManagement from './pages/PermissionsManagement';
import AuditHistory from './pages/AuditHistory';

const { Content } = Layout;

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    resource: string;
    action?: string;
  };
  // Backward compatibility (deprecated)
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission,
  requiredRoles = [] 
}) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Новая система разрешений
  if (requiredPermission) {
    return (
      <PermissionProtectedContent 
        requiredPermission={requiredPermission}
        fallbackPath="/catalog"
      >
        {children}
      </PermissionProtectedContent>
    );
  }

  // Backward compatibility с ролями (deprecated)
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/catalog" replace />;
  }

  return <>{children}</>;
};

// Компонент для проверки разрешений внутри PermissionsProvider
const PermissionProtectedContent: React.FC<{
  children: React.ReactNode;
  requiredPermission: { resource: string; action?: string };
  fallbackPath: string;
}> = ({ children, requiredPermission, fallbackPath }) => {
  const context = usePermissionsContext();
  
  // Используем глобальный контекст напрямую
  const { hasPermission, loading, permissions, error } = context;

  // Отладочный вывод
  console.log('🔍 PermissionProtectedContent DEBUG:', {
    resource: requiredPermission.resource,
    action: requiredPermission.action || 'view',
    loading,
    error,
    permissions: permissions ? 'LOADED' : 'NULL',
    hasPermissionFunction: typeof hasPermission
  });

  // КРИТИЧНО: Показываем loading пока загружаются разрешения
  // НЕ проверяем разрешения пока они не загружены полностью
  if (loading || !permissions) {
    console.log('⏳ Ожидаем загрузку разрешений...', { loading, hasPermissions: !!permissions });
    return <div style={{ padding: '20px', textAlign: 'center' }}>
      Загрузка разрешений... ({requiredPermission.resource})
    </div>;
  }

  // Показываем ошибку если не удалось загрузить разрешения
  if (error) {
    console.log('❌ Показываем ошибку:', error);
    return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
      Ошибка загрузки разрешений: {error}
    </div>;
  }

  // Проверяем разрешение ТОЛЬКО после полной загрузки
  console.log('🔧 Вызываем hasPermission с параметрами:', {
    resource: requiredPermission.resource,
    action: requiredPermission.action || 'view',
    fullRequiredPermission: requiredPermission
  });
  
  const hasAccess = hasPermission(
    requiredPermission.resource, 
    requiredPermission.action || 'view'
  );
  
  console.log('🎯 Результат проверки разрешений:', {
    resource: requiredPermission.resource,
    action: requiredPermission.action || 'view',
    hasAccess,
    permissionsLoaded: !!permissions,
    willNavigateToFallback: !hasAccess
  });

  if (!hasAccess) {
    console.log('🚫 Доступ запрещён, перенаправляем на:', fallbackPath);
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <PermissionsProvider>
      <AntdApp>
        {!isAuthenticated ? (
          <Layout className="full-height">
            <Content className="center-flex">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Content>
          </Layout>
        ) : (
          <DashboardLayout>
          <Routes>


            {/* Каталог товаров */}
            <Route 
              path="/catalog" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'catalog', action: 'view' }}>
                  <Catalog />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/catalog/products/:id" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'catalog', action: 'view' }}>
                  <ProductDetail />
                </ProtectedRoute>
              } 
            />

            {/* Остатки */}
            <Route 
              path="/stock" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'stock', action: 'view' }}>
                  <Stock />
                </ProtectedRoute>
              } 
            />

            {/* Заказы */}
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'orders', action: 'view' }}>
                  <Orders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders/create" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'orders', action: 'create' }}>
                  <CreateOrder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders/:id" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'orders', action: 'view' }}>
                  <OrderDetail />
                </ProtectedRoute>
              } 
            />

                        {/* Производство */}
            <Route 
              path="/production" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'production', action: 'view' }}>
                  <ProductionTasks />
                </ProtectedRoute>
              } 
            />

            {/* Операции резки */}
            <Route 
              path="/cutting" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'cutting', action: 'view' }}>
                  <CuttingOperations />
                </ProtectedRoute>
              } 
            />

            {/* Отгрузки */}
            <Route 
              path="/shipments" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'shipments', action: 'view' }}>
                  <Shipments />
                </ProtectedRoute>
              } 
            />

            {/* Управление пользователями */}
            <Route 
              path="/users" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'users', action: 'manage' }}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />

            {/* Управление разрешениями */}
            <Route 
              path="/permissions" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'permissions', action: 'manage' }}>
                  <PermissionsManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Redirect для совместимости */}
            <Route 
              path="/production-tasks" 
              element={<Navigate to="/production" replace />}
            />

            {/* История изменений */}
            <Route 
              path="/audit" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'audit', action: 'view' }}>
                  <AuditHistory />
                </ProtectedRoute>
              } 
            />

            {/* Redirect */}
            <Route path="/" element={<Navigate to="/catalog" replace />} />
            <Route path="/" element={<Navigate to="/catalog" replace />} />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Routes>
          </DashboardLayout>
        )}
      </AntdApp>
    </PermissionsProvider>
  );
};

export default App; 