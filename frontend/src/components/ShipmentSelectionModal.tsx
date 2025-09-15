import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Input,
  DatePicker,
  Space,
  Button,
  Tag,
  Typography,
  message,
  Spin
} from 'antd';
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons';
import { shipmentsApi, type Shipment } from '../services/shipmentsApi';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface ShipmentSelectionModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (shipmentId: number) => void;
  currentOrderNumber?: string;
}

const ShipmentSelectionModal: React.FC<ShipmentSelectionModalProps> = ({
  visible,
  onCancel,
  onSelect,
  currentOrderNumber
}) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Загрузка открытых отгрузок
  const loadOpenShipments = async () => {
    setLoading(true);
    try {
      const data = await shipmentsApi.getOpenShipments();
      setShipments(data);
    } catch (error) {
      console.error('Ошибка загрузки открытых отгрузок:', error);
      message.error('Ошибка загрузки открытых отгрузок');
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация отгрузок
  const filteredShipments = shipments.filter(shipment => {
    // Фильтр по тексту поиска (номер отгрузки, клиент, заказ)
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      const hasMatchingOrder = shipment.orders?.some(so => 
        so.order.orderNumber.toLowerCase().includes(searchLower) ||
        so.order.customerName.toLowerCase().includes(searchLower)
      );
      const hasMatchingShipment = shipment.shipmentNumber.toLowerCase().includes(searchLower);
      
      if (!hasMatchingOrder && !hasMatchingShipment) {
        return false;
      }
    }

    // Фильтр по дате отгрузки
    if (dateRange && dateRange[0] && dateRange[1]) {
      const shipmentDate = shipment.plannedDate ? dayjs(shipment.plannedDate) : dayjs(shipment.createdAt);
      const startDate = dateRange[0];
      const endDate = dateRange[1];
      
      if (!shipmentDate.isAfter(startDate.subtract(1, 'day')) || !shipmentDate.isBefore(endDate.add(1, 'day'))) {
        return false;
      }
    }

    return true;
  });

  // Загрузка данных при открытии модального окна
  useEffect(() => {
    if (visible) {
      loadOpenShipments();
    }
  }, [visible]);

  // Колонки таблицы (переиспользуем логику из Shipments.tsx)
  const columns = [
    {
      title: 'Номер отгрузки',
      dataIndex: 'shipmentNumber',
      key: 'shipmentNumber',
      width: 150,
      render: (text: string, record: Shipment) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          {shipmentsApi.isOverdue(record) && (
            <Tag color="red">Просрочено</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Заказ/Клиент',
      key: 'order',
      width: 200,
      render: (record: Shipment) => {
        const orders = record.orders?.map(so => so.order) || record.relatedOrders || [];
        
        if (orders.length === 0) {
          return (
            <div>
              <div style={{ fontStyle: 'italic', color: '#999' }}>Нет заказов</div>
            </div>
          );
        }
        
        if (orders.length === 1) {
          const order = orders[0];
          return (
            <div>
              <div style={{ fontWeight: 'bold' }}>
                {order.orderNumber}
                {order.contractNumber && ` - ${order.contractNumber}`}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>{order.customerName}</div>
            </div>
          );
        }
        
        return (
          <div>
            <div style={{ fontStyle: 'italic' }}>Сборная отгрузка</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {orders.length} заказов
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              {orders.slice(0, 2).map(o => 
                o.contractNumber ? `${o.orderNumber} - ${o.contractNumber}` : o.orderNumber
              ).join(', ')}
              {orders.length > 2 && ` +${orders.length - 2}`}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Товары',
      key: 'items',
      width: 120,
      render: (record: Shipment) => {
        const summary = shipmentsApi.calculateShipmentSummary(record);
        return (
          <div>
            <div>{summary.totalItems} шт.</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {summary.totalProducts} наименований
            </div>
          </div>
        );
      }
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: Shipment['status']) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: shipmentsApi.getStatusColor(status),
              marginRight: '8px'
            }} 
          />
          {shipmentsApi.getStatusText(status)}
        </div>
      )
    },
    {
      title: 'Плановая дата',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      width: 120,
      render: (date: string) => shipmentsApi.formatDate(date)
    },
    {
      title: 'Действие',
      key: 'action',
      width: 100,
      render: (record: Shipment) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => onSelect(record.id)}
        >
          Выбрать
        </Button>
      )
    }
  ];

  return (
    <Modal
      title={
        <div>
          <Text strong>Выберите отгрузку</Text>
          {currentOrderNumber && (
            <div style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>
              Заказ <Text code>{currentOrderNumber}</Text> будет добавлен в выбранную отгрузку
            </div>
          )}
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Input.Search
            placeholder="Поиск по номеру отгрузки, заказу, клиенту..."
            style={{ width: 300 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            prefix={<SearchOutlined />}
          />
          
          <RangePicker
            placeholder={['Дата от', 'Дата до']}
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            style={{ width: 250 }}
            suffixIcon={<CalendarOutlined />}
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredShipments}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} из ${total} отгрузок`
        }}
        size="small"
        scroll={{ y: 400 }}
      />

      {filteredShipments.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <Text type="secondary">
            {searchText || dateRange ? 'Отгрузки не найдены по заданным фильтрам' : 'Нет открытых отгрузок'}
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default ShipmentSelectionModal;
