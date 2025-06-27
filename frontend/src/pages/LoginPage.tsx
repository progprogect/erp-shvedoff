import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/authApi';

const { Title, Text } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authApi.login(values.username, values.password);
      
      if (response.success && response.token && response.user) {
        login(response.user, response.token);
        navigate('/dashboard');
      } else {
        setError('Ошибка входа в систему');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: '12px'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          {/* Logo and Title */}
          <div>
            <div style={{
              fontSize: '48px',
              color: '#1890ff',
              marginBottom: '16px'
            }}>
              🏭
            </div>
            <Title level={2} style={{ margin: 0, color: '#262626' }}>
              ERP Shvedoff
            </Title>
            <Text type="secondary">
              Система управления складскими остатками
            </Text>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          {/* Login Form */}
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: 'Введите имя пользователя' },
                { min: 3, message: 'Минимум 3 символа' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Имя пользователя"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Введите пароль' },
                { min: 3, message: 'Минимум 3 символа' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Пароль"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<LoginOutlined />}
                style={{ width: '100%', height: '44px' }}
              >
                {loading ? 'Вход в систему...' : 'Войти'}
              </Button>
            </Form.Item>
          </Form>

          {/* Test Users Info */}
          <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Тестовые пользователи:
            </Text>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                director / 123456 (Директор)
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                manager1 / 123456 (Менеджер)
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                production1 / 123456 (Производство)
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                warehouse1 / 123456 (Склад)
              </Text>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage; 