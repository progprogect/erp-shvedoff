import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const OrderDetail: React.FC = () => {
  return (
    <Card>
      <Title level={3}>Детали заказа</Title>
      <p>Страница будет реализована в следующих спринтах</p>
    </Card>
  );
};

export default OrderDetail; 