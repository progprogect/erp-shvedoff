import React, { useState, useEffect } from 'react';
import { Modal, Table, Typography, Tag, Space, Spin, message, Row, Col, Statistic, Button } from 'antd';
import { HistoryOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StockItem, StockMovement, stockApi } from '../services/stockApi';
import { useAuthStore } from '../stores/authStore';

const { Text, Title } = Typography;

interface StockHistoryModalProps {
  visible: boolean;
  stockItem: StockItem | null;
  onClose: () => void;
}

const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
  visible,
  stockItem,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const { token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (visible && stockItem && token) {
      loadMovements();
    }
  }, [visible, stockItem, token]);

  const loadMovements = async () => {
    if (!stockItem || !token) return;

    setLoading(true);
    try {
      const response = await stockApi.getStockMovements(stockItem.productId);
      
      if (response.success) {
        setMovements(response.data);
      } else {
        message.error('Ошибка загрузки истории движения');
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      message.error('Ошибка связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    const types: Record<string, { text: string; color: string; icon: string }> = {
      'incoming': { text: 'Поступление', color: 'green', icon: '📦' },
      'outgoing': { text: 'Отгрузка', color: 'red', icon: '🚚' },
      'cutting_out': { text: 'Резка (расход)', color: 'orange', icon: '✂️' },
      'cutting_in': { text: 'Резка (результат)', color: 'blue', icon: '✨' },
      'reservation': { text: 'Резервирование', color: 'purple', icon: '🔒' },
      'release_reservation': { text: 'Снятие резерва', color: 'cyan', icon: '🔓' },
      'adjustment': { text: 'Корректировка', color: 'gold', icon: '⚡' }
    };
    return types[type] || { text: type, color: 'default', icon: '❓' };
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <div>
          <Text strong>{new Date(date).toLocaleDateString('ru-RU')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </div>
      )
    },
    {
      title: 'Операция',
      dataIndex: 'movementType',
      key: 'movementType',
      width: 150,
      render: (type: string) => {
        const typeInfo = getMovementTypeInfo(type);
        return (
          <Tag color={typeInfo.color}>
            {typeInfo.icon} {typeInfo.text}
          </Tag>
        );
      }
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center' as const,
      render: (quantity: number, record: StockMovement) => {
        const isPositive = quantity > 0;
        return (
          <Text 
            strong 
            style={{ 
              color: isPositive ? '#52c41a' : '#ff4d4f',
              fontSize: 16 
            }}
          >
            {isPositive ? '+' : ''}{quantity} шт
          </Text>
        );
      }
    },
    {
      title: 'Ссылка',
      key: 'reference',
      width: 120,
      render: (_: any, record: StockMovement) => {
        if (record.referenceType && record.referenceId) {
          const refTypes: Record<string, string> = {
            'order': 'Заказ',
            'cutting': 'Резка',
            'adjustment': 'Корректировка'
          };
          const refText = refTypes[record.referenceType] || record.referenceType;
          
          // Если это заказ, делаем кликабельную ссылку
          if (record.referenceType === 'order') {
            return (
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  navigate(`/orders/${record.referenceId}`);
                  onClose(); // Закрываем модальное окно после перехода
                }}
                style={{ padding: 0, height: 'auto' }}
              >
                {refText} #{record.referenceId}
              </Button>
            );
          }
          
          return (
            <Text>
              {refText} #{record.referenceId}
            </Text>
          );
        }
        return <Text type="secondary">—</Text>;
      }
    },
    {
      title: 'Комментарий',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (comment: string) => (
        <Text style={{ fontSize: 12 }}>
          {comment || '—'}
        </Text>
      )
    },
    {
      title: 'Пользователь',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (userName: string) => (
        <Text style={{ fontSize: 12 }}>
          👤 {userName || 'Система'}
        </Text>
      )
    }
  ];

  // Статистика по движениям (всегда вызываем хук)
  const stats = React.useMemo(() => {
    if (!movements.length) {
      return { incoming: 0, outgoing: 0, adjustments: 0, total: 0 };
    }

    const incoming = movements
      .filter(m => ['incoming', 'cutting_in', 'adjustment'].includes(m.movementType) && m.quantity > 0)
      .reduce((sum, m) => sum + m.quantity, 0);
    
    const outgoing = movements
      .filter(m => ['outgoing', 'cutting_out'].includes(m.movementType) || m.quantity < 0)
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    
    const adjustments = movements
      .filter(m => m.movementType === 'adjustment')
      .length;

    return { incoming, outgoing, adjustments, total: movements.length };
  }, [movements]);

  if (!stockItem) return null;

  return (
    <Modal
      title={
        <div>
          <HistoryOutlined style={{ color: '#1890ff', marginRight: 8 }} />
          История движения остатков
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      destroyOnHidden
    >
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          {stockItem.productName}
        </Title>
        <Text type="secondary">
          {stockItem.productArticle} • {stockItem.categoryName}
        </Text>
      </div>

      {/* Текущее состояние */}
      <Row gutter={16} style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        <Col span={6}>
          <Statistic
            title="Текущий остаток"
            value={stockItem.currentStock}
            suffix="шт"
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Резерв"
            value={stockItem.reservedStock}
            suffix="шт"
            valueStyle={{ fontSize: 16, color: '#faad14' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Доступно"
            value={stockItem.availableStock}
            suffix="шт"
            valueStyle={{ fontSize: 16, color: stockItem.availableStock > 0 ? '#52c41a' : '#ff4d4f' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Операций"
            value={stats.total}
            valueStyle={{ fontSize: 16, color: '#1890ff' }}
          />
        </Col>
      </Row>

      {/* Статистика движений */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <div style={{ textAlign: 'center', padding: 12, backgroundColor: '#f6ffed', borderRadius: 6 }}>
            <Text strong style={{ color: '#52c41a', fontSize: 18 }}>
              📦 +{stats.incoming} шт
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Поступления
            </Text>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center', padding: 12, backgroundColor: '#fff2f0', borderRadius: 6 }}>
            <Text strong style={{ color: '#ff4d4f', fontSize: 18 }}>
              🚚 -{stats.outgoing} шт
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Расходы
            </Text>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center', padding: 12, backgroundColor: '#fffbe6', borderRadius: 6 }}>
            <Text strong style={{ color: '#faad14', fontSize: 18 }}>
              ⚡ {stats.adjustments}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Корректировки
            </Text>
          </div>
        </Col>
      </Row>

      {/* Таблица движений */}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={movements}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} операций`,
          }}
          scroll={{ x: 800 }}
          locale={{
            emptyText: 'Нет истории движения'
          }}
        />
      </Spin>
    </Modal>
  );
};

export default StockHistoryModal; 