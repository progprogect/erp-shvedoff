import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, App as AntdApp } from 'antd';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import Production from './pages/Production';
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
    return <Navigate to="/dashboard" replace />;
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
            {/* Дашборд */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />

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
                  <Production />
                </ProtectedRoute>
              } 
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </DashboardLayout>
      )}
    </AntdApp>
  );
};

export default App; 