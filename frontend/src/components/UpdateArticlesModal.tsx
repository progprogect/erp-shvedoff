import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Progress, Alert, Space, Typography, Checkbox, message } from 'antd';
import { ReloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { articlesApi, ArticleRegenerateResult, ArticleApplyItem } from '../services/articlesApi';

const { Text, Title } = Typography;

interface UpdateArticlesModalProps {
  visible: boolean;
  selectedProductIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

const UpdateArticlesModal: React.FC<UpdateArticlesModalProps> = ({
  visible,
  selectedProductIds,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<ArticleRegenerateResult[]>([]);
  const [canApplyCount, setCanApplyCount] = useState(0);
  const [cannotApplyCount, setCannotApplyCount] = useState(0);
  const [showDialogNextTime, setShowDialogNextTime] = useState(true);
  const [currentStep, setCurrentStep] = useState<'preview' | 'applying' | 'completed'>('preview');

  // Загружаем превью при открытии модала
  useEffect(() => {
    if (visible && selectedProductIds.length > 0) {
      loadPreview();
    }
  }, [visible, selectedProductIds]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await articlesApi.dryRun(selectedProductIds);
      if (response.success) {
        setResults(response.data.results);
        setCanApplyCount(response.data.canApplyCount);
        setCannotApplyCount(response.data.cannotApplyCount);
        setCurrentStep('preview');
      } else {
        message.error('Ошибка загрузки превью изменений');
      }
    } catch (error) {
      console.error('Ошибка загрузки превью:', error);
      message.error('Ошибка загрузки превью изменений');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const itemsToApply = results
      .filter(r => r.canApply && r.newSku)
      .map(r => ({
        productId: r.productId,
        newSku: r.newSku!,
        currentSku: r.currentSku || undefined
      }));

    if (itemsToApply.length === 0) {
      message.warning('Нет товаров для обновления');
      return;
    }

    setApplying(true);
    setCurrentStep('applying');

    try {
      const response = await articlesApi.apply(itemsToApply);
      
      if (response.success) {
        setCurrentStep('completed');
        message.success(`Артикулы обновлены: ${response.data.updated} из ${itemsToApply.length}`);
        
        if (response.data.failed > 0) {
          message.warning(`${response.data.failed} товаров не удалось обновить`);
        }
        
        onSuccess();
      } else {
        message.error('Ошибка обновления артикулов');
        setCurrentStep('preview');
      }
    } catch (error) {
      console.error('Ошибка обновления:', error);
      message.error('Ошибка обновления артикулов');
      setCurrentStep('preview');
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setCurrentStep('preview');
    setResults([]);
    setCanApplyCount(0);
    setCannotApplyCount(0);
    onClose();
  };

  const getStatusColor = (result: ArticleRegenerateResult): 'success' | 'danger' | 'warning' | 'secondary' => {
    if (result.canApply) return 'success';
    if (result.reason === 'SKU_CONFLICT') return 'danger';
    if (result.reason === 'MISSING_PARAMS') return 'warning';
    return 'secondary';
  };

  const getStatusText = (result: ArticleRegenerateResult) => {
    if (result.canApply) return 'Готов к обновлению';
    if (result.reason === 'SKU_CONFLICT') return 'Конфликт артикула';
    if (result.reason === 'MISSING_PARAMS') return 'Недостаточно параметров';
    return 'Ошибка';
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'productId',
      key: 'productId',
      width: 80,
    },
    {
      title: 'Текущий артикул',
      dataIndex: 'currentSku',
      key: 'currentSku',
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>{text || '—'}</Text>
      ),
    },
    {
      title: 'Новый артикул',
      dataIndex: 'newSku',
      key: 'newSku',
      render: (text: string) => (
        <Text code style={{ fontSize: '12px', color: '#52c41a' }}>{text || '—'}</Text>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      render: (record: ArticleRegenerateResult) => (
        <Text type={getStatusColor(record)}>
          {getStatusText(record)}
        </Text>
      ),
    },
    {
      title: 'Детали',
      dataIndex: 'details',
      key: 'details',
      render: (details: string[]) => (
        details && details.length > 0 ? (
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {details.join(', ')}
          </Text>
        ) : '—'
      ),
    },
  ];

  const renderPreviewStep = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <Title level={4}>Обновить артикулы у {selectedProductIds.length} товаров?</Title>
        <Text type="secondary">
          Будут применены актуальные правила генерации по параметрам каждого товара.
        </Text>
      </div>

      {cannotApplyCount > 0 && (
        <Alert
          message={`Можно обновить ${canApplyCount} из ${selectedProductIds.length}. Для ${cannotApplyCount} товаров обнаружены ошибки.`}
          type="warning"
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={results}
        rowKey="productId"
        pagination={{ pageSize: 10 }}
        size="small"
        loading={loading}
        scroll={{ y: 300 }}
      />

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Checkbox
          checked={showDialogNextTime}
          onChange={(e) => setShowDialogNextTime(e.target.checked)}
        >
          Показывать этот диалог в следующий раз
        </Checkbox>
        
        <Space>
          <Button onClick={handleClose}>
            Отмена
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleApply}
            disabled={canApplyCount === 0}
            loading={loading}
          >
            Обновить {canApplyCount > 0 ? `${canApplyCount} товаров` : ''}
          </Button>
        </Space>
      </div>
    </>
  );

  const renderApplyingStep = () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <Progress
        type="circle"
        percent={applying ? undefined : 100}
        status={applying ? 'active' : 'success'}
        format={() => applying ? 'Обновление...' : 'Готово!'}
      />
      <div style={{ marginTop: 16 }}>
        <Text>Обновление артикулов товаров</Text>
      </div>
    </div>
  );

  const renderCompletedStep = () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <CheckOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
      <Title level={3} style={{ color: '#52c41a' }}>
        Артикулы обновлены!
      </Title>
      <Text type="secondary">
        Обновлено {canApplyCount} из {selectedProductIds.length} товаров
      </Text>
      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={handleClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      title={
        <div>
          <ReloadOutlined style={{ color: '#1890ff', marginRight: 8 }} />
          Обновить артикулы
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {currentStep === 'preview' && renderPreviewStep()}
      {currentStep === 'applying' && renderApplyingStep()}
      {currentStep === 'completed' && renderCompletedStep()}
    </Modal>
  );
};

export default UpdateArticlesModal;
