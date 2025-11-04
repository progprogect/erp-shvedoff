import React, { useState, useEffect } from 'react';
import { Table, Typography, Tag, Space, Spin, message, Button, Popconfirm } from 'antd';
import { DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StockMovement, stockApi } from '../services/stockApi';

const { Text } = Typography;

interface StockMovementsListProps {
  referenceTypes: string[];
  canCancel?: boolean;
  pageSize?: number;
}

const StockMovementsList: React.FC<StockMovementsListProps> = ({
  referenceTypes,
  canCancel = false,
  pageSize = 10
}) => {
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadMovements();
  }, [referenceTypes, currentPage]);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await stockApi.getMovementsByReferenceTypes(
        referenceTypes,
        pageSize,
        offset
      );

      if (response.success) {
        setMovements(response.data);
        // Если получили меньше записей, чем pageSize, значит это последняя страница
        setTotal(offset + response.data.length + (response.data.length === pageSize ? 1 : 0));
      } else {
        message.error('Ошибка загрузки истории движения');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка загрузки истории:', error);
      message.error('Ошибка загрузки истории движения');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (movementId: number) => {
    setCancellingId(movementId);
    try {
      const response = await stockApi.cancelMovement(movementId);

      if (response.success) {
        message.success('Движение успешно отменено');
        // Обновляем список
        loadMovements();
      } else {
        message.error(response.message || 'Ошибка отмены движения');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка отмены движения:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка отмены движения';
      message.error(`Ошибка: ${errorMessage}`);
    } finally {
      setCancellingId(null);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    const types: Record<string, { text: string; color: string; icon: string }> = {
      'incoming': { text: 'Поступление', color: 'green', icon: '📦' },
      'outgoing': { text: 'Списание', color: 'red', icon: '🚚' },
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
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'center' as const,
      render: (quantity: number, record: StockMovement) => {
        const positiveTypes = ['incoming', 'cutting_in', 'release_reservation'];
        const isPositive = positiveTypes.includes(record.movementType);
        const displayQuantity = Math.abs(quantity);

        return (
          <Text
            strong
            style={{
              color: isPositive ? '#52c41a' : '#ff4d4f',
              fontSize: 16
            }}
          >
            {isPositive ? '+' : '-'}{displayQuantity} шт
          </Text>
        );
      }
    },
    {
      title: 'Артикул товара',
      key: 'productArticle',
      width: 200,
      render: (_: any, record: StockMovement) => {
        const article = record.productArticle || '—';
        return (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => navigate(`/products/${record.productId}`)}
            style={{ padding: 0, height: 'auto', fontFamily: 'monospace' }}
          >
            {article}
          </Button>
        );
      }
    },
    {
      title: 'Примечание',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (comment: string) => (
        <Text style={{ fontSize: 12 }}>
          {comment || '—'}
        </Text>
      )
    },
    ...(canCancel ? [{
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: any, record: StockMovement) => (
        <Popconfirm
          title="Отменить движение?"
          description={
            <div>
              <div>Дата: {new Date(record.createdAt).toLocaleString('ru-RU')}</div>
              <div>Количество: {record.quantity > 0 ? '+' : ''}{record.quantity} шт</div>
              <div>Товар: {record.productArticle || record.productName}</div>
              <div style={{ marginTop: 8, color: '#ff4d4f' }}>
                Это действие откатит изменения в остатках и удалит запись из истории.
              </div>
            </div>
          }
          onConfirm={() => handleCancel(record.id)}
          okText="Подтвердить"
          cancelText="Отмена"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={cancellingId === record.id}
          >
            Отменить
          </Button>
        </Popconfirm>
      )
    }] : [])
  ];

  return (
    <Spin spinning={loading}>
      <Table
        columns={columns}
        dataSource={movements}
        rowKey="id"
        size="small"
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} из ${total} операций`,
          onChange: (page) => setCurrentPage(page)
        }}
        scroll={{ x: 800 }}
        locale={{
          emptyText: 'Нет истории движения'
        }}
      />
    </Spin>
  );
};

export default StockMovementsList;

