import React from 'react';
import { Modal, Typography, Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  onClose,
  title = 'Операция выполнена успешно',
  message
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width={500}
      closable={false}
      maskClosable={false}
    >
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <CheckCircleOutlined 
          style={{ 
            fontSize: 64, 
            color: '#52c41a',
            marginBottom: 8
          }} 
        />
        
        <Title level={3} style={{ 
          color: '#52c41a',
          margin: 0
        }}>
          {title}
        </Title>
        
        {message && (
          <Text type="secondary" style={{ fontSize: 14 }}>
            {message}
          </Text>
        )}
        
        <div style={{ marginTop: 8 }}>
          <Button 
            type="primary" 
            size="large"
            onClick={onClose}
            style={{ minWidth: 120 }}
          >
            Ок
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SuccessModal;

