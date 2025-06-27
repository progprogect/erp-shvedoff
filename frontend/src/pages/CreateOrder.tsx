import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const CreateOrder: React.FC = () => {
  return (
    <Card>
      <Title level={3}>Создание заказа</Title>
      <p>Страница будет реализована в следующих спринтах</p>
    </Card>
  );
};

export default CreateOrder; 