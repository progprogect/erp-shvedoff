import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Input, Button, Space, Typography, Row, Col, Statistic, App, Checkbox, Card } from 'antd';
import { ExclamationCircleOutlined, PlusOutlined, MinusOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { StockItem, stockApi } from '../services/stockApi';
import { useAuthStore } from '../stores/authStore';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface StockAdjustmentModalProps {
  visible: boolean;
  stockItem: StockItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  visible,
  stockItem,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [quantity, setQuantity] = useState<number>(0);
  const [showProductionOptions, setShowProductionOptions] = useState(false);
  const [productionAction, setProductionAction] = useState<'none' | 'add' | 'remove'>('none');
  const [productionQuantity, setProductionQuantity] = useState<number>(0);
  const { token } = useAuthStore();
  const { message } = App.useApp();

  useEffect(() => {
    if (visible && stockItem) {
      form.resetFields();
      setQuantity(0);
      setAdjustmentType('add');
      setShowProductionOptions(false);
      setProductionAction('none');
      setProductionQuantity(0);
    }
  }, [visible, stockItem, form]);

  const calculateNewStock = () => {
    if (!stockItem) return 0;
    
    switch (adjustmentType) {
      case 'add':
        return stockItem.currentStock + quantity;
      case 'subtract':
        return stockItem.currentStock - quantity;
      case 'set':
        return quantity;
      default:
        return stockItem.currentStock;
    }
  };

  const getAdjustmentAmount = () => {
    if (!stockItem) return 0;
    
    switch (adjustmentType) {
      case 'add':
        return quantity;
      case 'subtract':
        return -quantity;
      case 'set':
        return quantity - stockItem.currentStock;
      default:
        return 0;
    }
  };

  const handleSubmit = async (values: any) => {
    if (!stockItem || !token) return;

    const adjustmentAmount = getAdjustmentAmount();
    const newStock = calculateNewStock();

    if (newStock < 0) {
      message.error('Остаток не может быть отрицательным');
      return;
    }

    if (adjustmentAmount === 0) {
      message.warning('Укажите количество для корректировки');
      return;
    }

    // Проверка производственных действий
    if (showProductionOptions && productionAction !== 'none') {
      if (productionQuantity <= 0) {
        message.warning('Укажите количество для изменения производственной очереди');
        return;
      }
      
      if (productionAction === 'remove' && productionQuantity > (stockItem.inProductionQuantity || 0)) {
        message.error(`Нельзя убрать больше чем в производстве (${stockItem.inProductionQuantity || 0} шт)`);
        return;
      }
    }

    setLoading(true);
    try {
      const requestData = {
        productId: stockItem.productId,
        adjustment: adjustmentAmount,
        comment: values.comment || 'Ручная корректировка',
        ...(showProductionOptions && productionAction !== 'none' ? {
          productionAction,
          productionQuantity
        } : {})
      };

      const response = await stockApi.adjustStock(requestData, token);

      if (response.success) {
        message.success(`Остаток успешно скорректирован. ${response.message}`);
        onSuccess();
        onClose();
      } else {
        message.error('Ошибка корректировки остатка');
      }
    } catch (error) {
      console.error('Ошибка корректировки:', error);
      message.error('Ошибка связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  if (!stockItem) return null;

  const newStock = calculateNewStock();
  const adjustmentAmount = getAdjustmentAmount();
  const isValidStock = newStock >= 0;

  return (
    <Modal
      title={
        <div>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          Корректировка остатка
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
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
        <Col span={8}>
          <Statistic
            title="Текущий остаток"
            value={stockItem.currentStock}
            suffix="шт"
            valueStyle={{ fontSize: 18 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Резерв"
            value={stockItem.reservedStock}
            suffix="шт"
            valueStyle={{ fontSize: 18, color: '#faad14' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Доступно"
            value={stockItem.availableStock}
            suffix="шт"
            valueStyle={{ fontSize: 18, color: stockItem.availableStock > 0 ? '#52c41a' : '#ff4d4f' }}
          />
        </Col>
      </Row>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {/* Тип корректировки */}
        <Form.Item label="Тип корректировки">
          <Space size="middle">
            <Button
              type={adjustmentType === 'add' ? 'primary' : 'default'}
              icon={<PlusOutlined />}
              onClick={() => setAdjustmentType('add')}
            >
              Поступление
            </Button>
            <Button
              type={adjustmentType === 'subtract' ? 'primary' : 'default'}
              icon={<MinusOutlined />}
              onClick={() => setAdjustmentType('subtract')}
            >
              Списание
            </Button>
            <Button
              type={adjustmentType === 'set' ? 'primary' : 'default'}
              onClick={() => setAdjustmentType('set')}
            >
              Установить точное значение
            </Button>
          </Space>
        </Form.Item>

        {/* Количество */}
        <Form.Item
          label={adjustmentType === 'set' ? 'Новый остаток' : 'Количество'}
          required
        >
          <InputNumber
            value={quantity}
            onChange={(value) => setQuantity(value || 0)}
            style={{ width: '100%' }}
            min={0}
            precision={0}
            placeholder={adjustmentType === 'set' ? 'Введите новый остаток' : 'Введите количество'}
            addonAfter="шт"
          />
        </Form.Item>

        {/* Предварительный результат */}
        {quantity > 0 && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            backgroundColor: isValidStock ? '#f6ffed' : '#fff2f0', 
            border: `1px solid ${isValidStock ? '#b7eb8f' : '#ffb3b3'}`,
            borderRadius: 6 
          }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>
                  Изменение: {adjustmentAmount > 0 ? '+' : ''}{adjustmentAmount} шт
                </Text>
              </Col>
              <Col span={12}>
                <Text strong style={{ color: isValidStock ? '#52c41a' : '#ff4d4f' }}>
                  Новый остаток: {newStock} шт
                </Text>
              </Col>
            </Row>
            {!isValidStock && (
              <Text type="danger" style={{ fontSize: 12 }}>
                ⚠️ Остаток не может быть отрицательным
              </Text>
            )}
          </div>
        )}

        {/* Управление производством */}
        <Card 
          size="small" 
          title={
            <div>
              <AppstoreAddOutlined style={{ marginRight: 8 }} />
              Производственная очередь
            </div>
          }
          style={{ marginBottom: 16 }}
        >
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">
              Текущее количество в производстве: <Text strong>{stockItem.inProductionQuantity || 0} шт</Text>
            </Text>
          </div>
          
          <Checkbox 
            checked={showProductionOptions}
            onChange={(e) => setShowProductionOptions(e.target.checked)}
          >
            Изменить задания на производство
          </Checkbox>

          {showProductionOptions && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Действие с производственной очередью:</Text>
                </div>
                
                <Space>
                  <Button
                    size="small"
                    type={productionAction === 'add' ? 'primary' : 'default'}
                    icon={<PlusOutlined />}
                    onClick={() => setProductionAction('add')}
                  >
                    Добавить
                  </Button>
                  <Button
                    size="small"
                    type={productionAction === 'remove' ? 'primary' : 'default'}
                    icon={<MinusOutlined />}
                    onClick={() => setProductionAction('remove')}
                  >
                    Убрать
                  </Button>
                  <Button
                    size="small"
                    type={productionAction === 'none' ? 'primary' : 'default'}
                    onClick={() => setProductionAction('none')}
                  >
                    Не изменять
                  </Button>
                </Space>

                {productionAction !== 'none' && (
                  <InputNumber
                    value={productionQuantity}
                    onChange={(value) => setProductionQuantity(value || 0)}
                    style={{ width: '100%' }}
                    min={1}
                    max={productionAction === 'remove' ? stockItem.inProductionQuantity : undefined}
                    precision={0}
                    placeholder={`Количество для ${productionAction === 'add' ? 'добавления' : 'удаления'}`}
                    addonAfter="шт"
                  />
                )}
              </Space>
            </div>
          )}
        </Card>

        {/* Комментарий */}
        <Form.Item
          name="comment"
          label="Комментарий"
          rules={[
            { required: true, message: 'Укажите причину корректировки' }
          ]}
        >
          <TextArea
            rows={3}
            placeholder="Укажите причину корректировки остатка..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* Кнопки действий */}
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={!isValidStock || quantity === 0}
            >
              Применить корректировку
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StockAdjustmentModal; 