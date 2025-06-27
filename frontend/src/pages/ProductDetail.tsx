import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const ProductDetail: React.FC = () => {
  return (
    <Card>
      <Title level={3}>Детали товара</Title>
      <p>Страница будет реализована в следующих спринтах</p>
    </Card>
  );
};

export default ProductDetail; 