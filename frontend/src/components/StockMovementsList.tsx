import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Typography, Spin, message, Button, Popconfirm, Tooltip } from 'antd';
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

  // Мемоизируем referenceTypes для стабильной ссылки
  const referenceTypesKey = useMemo(() => referenceTypes.sort().join(','), [referenceTypes]);

  const loadMovements = useCallback(async () => {
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
        // Если получили ровно pageSize, возможно есть еще записи
        if (response.data.length < pageSize) {
          setTotal(offset + response.data.length);
        } else {
          // Если получили полную страницу, предполагаем что есть еще записи
          // Устанавливаем минимум на следующую страницу
          setTotal(offset + response.data.length + 1);
        }
      } else {
        message.error('Ошибка загрузки истории движения');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка загрузки истории:', error);
      message.error('Ошибка загрузки истории движения');
    } finally {
      setLoading(false);
    }
  }, [referenceTypes, pageSize, currentPage]);

  useEffect(() => {
    setCurrentPage(1); // Сбрасываем на первую страницу при изменении фильтров
  }, [referenceTypesKey]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const handleCancel = async (movementId: number) => {
    setCancellingId(movementId);
    try {
      const response = await stockApi.cancelMovement(movementId);

      if (response.success) {
        message.success('Движение успешно отменено');
        // Обновляем список - если текущая страница стала пустой, переходим на предыдущую
        if (movements.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        } else {
          loadMovements();
        }
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
      title: 'Дата и время',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => {
        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return (
          <div>
            <Text strong style={{ fontSize: 13 }}>{dateStr}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{timeStr}</Text>
          </div>
        );
      }
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
      width: 300,
      render: (_: any, record: StockMovement) => {
        const article = record.productArticle || '—';
        return (
          <Tooltip title={article} placement="topLeft">
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => navigate(`/products/${record.productId}`)}
              style={{ 
                padding: 0, 
                height: 'auto', 
                fontFamily: 'monospace',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block'
              }}
            >
              {article}
            </Button>
          </Tooltip>
        );
      }
    },
    {
      title: 'Примечание',
      key: 'comment',
      width: 300,
      render: (_: any, record: StockMovement) => {
        // Показываем комментарий из задания/операции, если есть, иначе системный комментарий
        const displayComment = record.referenceComment || record.comment || '—';
        return (
          <Tooltip title={displayComment} placement="topLeft">
            <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: displayComment }}>
              {displayComment}
            </Text>
          </Tooltip>
        );
      }
    },
    ...(canCancel ? [{
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: any, record: StockMovement) => {
        const positiveTypes = ['incoming', 'cutting_in', 'release_reservation'];
        const isPositive = positiveTypes.includes(record.movementType);
        const displayQuantity = Math.abs(record.quantity);
        
        return (
        <Popconfirm
          title="Отменить движение?"
          description={
            <div>
              <div>Дата: {new Date(record.createdAt).toLocaleString('ru-RU')}</div>
              <div>Количество: {isPositive ? '+' : '-'}{displayQuantity} шт</div>
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
        );
      }
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
        scroll={{ x: 1000 }}
        locale={{
          emptyText: 'Нет истории движения'
        }}
      />
    </Spin>
  );
};

export default StockMovementsList;

