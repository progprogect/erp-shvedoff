import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, App as AntdApp } from 'antd';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/Layout/DashboardLayout';

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
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRoles = [] 
}) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/catalog" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
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
                <ProtectedRoute>
                  <Catalog />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/catalog/products/:id" 
              element={
                <ProtectedRoute>
                  <ProductDetail />
                </ProtectedRoute>
              } 
            />

            {/* Остатки */}
            <Route 
              path="/stock" 
              element={
                <ProtectedRoute>
                  <Stock />
                </ProtectedRoute>
              } 
            />

            {/* Заказы */}
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute requiredRoles={['manager', 'director']}>
                  <Orders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders/create" 
              element={
                <ProtectedRoute requiredRoles={['manager', 'director']}>
                  <CreateOrder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders/:id" 
              element={
                <ProtectedRoute requiredRoles={['manager', 'director']}>
                  <OrderDetail />
                </ProtectedRoute>
              } 
            />

            {/* Производство */}
            <Route 
              path="/production" 
              element={
                <ProtectedRoute requiredRoles={['manager', 'director', 'production']}>
                  <ProductionTasks />
                </ProtectedRoute>
              } 
            />
            
            {/* Операции резки */}
            <Route 
              path="/cutting" 
              element={
                <ProtectedRoute requiredRoles={['manager', 'director', 'production']}>
                  <CuttingOperations />
                </ProtectedRoute>
              } 
            />

            {/* Отгрузки */}
            <Route 
              path="/shipments" 
              element={
                <ProtectedRoute>
                  <Shipments />
                </ProtectedRoute>
              } 
            />

            {/* Управление пользователями */}
            <Route 
              path="/users" 
              element={
                <ProtectedRoute requiredRoles={['director']}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />

            {/* Управление разрешениями */}
            <Route 
              path="/permissions" 
              element={
                <ProtectedRoute requiredRoles={['director']}>
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
                <ProtectedRoute requiredRoles={['director']}>
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
  );
};

export default App; 