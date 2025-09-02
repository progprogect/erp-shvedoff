import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Select, 
  Radio, 
  Space, 
  Typography, 
  Alert, 
  Divider, 
  Button,
  message,
  Spin
} from 'antd';
import { 
  ExclamationCircleOutlined, 
  DeleteOutlined, 
  ArrowRightOutlined,
  FolderOutlined,
  ShoppingOutlined
} from '@ant-design/icons';
import { 
  catalogApi, 
  Category, 
  CategoryDeleteOptions,
  CategoryDeleteResult 
} from '../services/catalogApi';
import { useAuthStore } from '../stores/authStore';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface DeleteCategoryModalProps {
  visible: boolean;
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  visible,
  category,
  categories,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [categoryDetails, setCategoryDetails] = useState<{
    productsCount: number;
    childCategories: Category[];
  } | null>(null);
  const [productAction, setProductAction] = useState<'delete' | 'move'>('move');
  const [childAction, setChildAction] = useState<'delete' | 'move' | 'promote'>('promote');
  const { token } = useAuthStore();

  // Загружаем детальную информацию о категории
  useEffect(() => {
    if (visible && category && token) {
      loadCategoryDetails();
    }
  }, [visible, category, token]);

  const loadCategoryDetails = async () => {
    if (!category || !token) return;

    try {
      const [detailsResponse, allCategories] = await Promise.all([
        catalogApi.getCategoryDetails(category.id),
        catalogApi.getCategories()
      ]);

      if (detailsResponse.success) {
        // Найдем дочерние категории
        const findChildCategories = (cats: Category[], parentId: number): Category[] => {
          const children: Category[] = [];
          cats.forEach(cat => {
            if (cat.parentId === parentId) {
              children.push(cat);
            }
            if (cat.children) {
              children.push(...findChildCategories(cat.children, parentId));
            }
          });
          return children;
        };

        const childCategories = findChildCategories(allCategories.data, category.id);
        
        setCategoryDetails({
          productsCount: detailsResponse.data.productsCount,
          childCategories
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки деталей категории:', error);
      message.error('Ошибка загрузки информации о категории');
    }
  };

  // Получаем список категорий для выбора (исключая удаляемую и её дочерние)
  const getAvailableCategories = (): Category[] => {
    if (!category) return [];

    const flattenCategories = (cats: Category[]): Category[] => {
      let result: Category[] = [];
      cats.forEach(cat => {
        result.push(cat);
        if (cat.children) {
          result.push(...flattenCategories(cat.children));
        }
      });
      return result;
    };

    const allFlat = flattenCategories(categories);
    
    // Исключаем саму категорию и её дочерние
    const excludedIds = new Set([category.id]);
    if (categoryDetails?.childCategories) {
      categoryDetails.childCategories.forEach(child => excludedIds.add(child.id));
    }

    return allFlat.filter(cat => !excludedIds.has(cat.id));
  };

  const handleSubmit = async () => {
    if (!category || !token || !categoryDetails) return;

    try {
      await form.validateFields();
      setLoading(true);

      const values = form.getFieldsValue();
      const options: CategoryDeleteOptions = {};

      // 🔥 ИСПРАВЛЕНИЕ: Добавляем параметры для товаров только если они есть
      if (categoryDetails.productsCount > 0) {
        options.productAction = productAction;
        if (productAction === 'move') {
          options.targetCategoryId = values.targetCategoryId;
        }
      }

      // 🔥 ИСПРАВЛЕНИЕ: Добавляем параметры для дочерних категорий только если они есть
      if (categoryDetails.childCategories.length > 0) {
        options.childAction = childAction;
        if (childAction === 'move') {
          options.targetParentId = values.targetParentId;
        }
      }

      const result: CategoryDeleteResult = await catalogApi.deleteCategoryWithAction(
        category.id, 
        options
      );

      if (result.success) {
        message.success(result.message);
        onSuccess();
        onClose();
      } else {
        message.error('Ошибка удаления категории');
      }
    } catch (error: any) {
      console.error('Ошибка удаления категории:', error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('Ошибка связи с сервером');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setProductAction('move');
    setChildAction('promote');
    setCategoryDetails(null);
    onClose();
  };

  if (!category) return null;

  const availableCategories = getAvailableCategories();

  return (
    <Modal
      title={
        <Space>
          <DeleteOutlined style={{ color: '#ff4d4f' }} />
          <span>Удаление категории</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Отмена
        </Button>,
        <Button 
          key="delete" 
          type="primary" 
          danger 
          loading={loading}
          onClick={handleSubmit}
          icon={<DeleteOutlined />}
        >
          Удалить категорию
        </Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Информация о категории */}
        <Alert
          message="Внимание!"
          description={`Вы собираетесь удалить категорию "${category.name}". Это действие необратимо.`}
          type="warning"
          icon={<ExclamationCircleOutlined />}
          showIcon
        />

        {!categoryDetails ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 10 }}>Загружаем информацию...</div>
          </div>
        ) : (
          <Form form={form} layout="vertical">
            {/* Информация о товарах */}
            {categoryDetails.productsCount > 0 && (
              <div>
                <Title level={5}>
                  <ShoppingOutlined /> Товары в категории ({categoryDetails.productsCount} шт.)
                </Title>
                
                <Radio.Group 
                  value={productAction} 
                  onChange={(e) => setProductAction(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="move">
                      <Space>
                        <ArrowRightOutlined />
                        <Text>Перенести товары в другую категорию</Text>
                      </Space>
                    </Radio>
                    {productAction === 'move' && (
                      <Form.Item
                        name="targetCategoryId"
                        style={{ marginLeft: 24, marginBottom: 8 }}
                        rules={[{ required: true, message: 'Выберите категорию для переноса' }]}
                      >
                        <Select 
                          placeholder="Выберите категорию для переноса товаров"
                          style={{ width: '100%' }}
                        >
                          {availableCategories.map(cat => (
                            <Option key={cat.id} value={cat.id}>
                              📁 {cat.name} {cat.path && `(${cat.path})`}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                    
                    <Radio value="delete">
                      <Space>
                        <DeleteOutlined style={{ color: '#ff4d4f' }} />
                        <Text type="danger">Деактивировать все товары (скрыть из каталога)</Text>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
                
                <Divider />
              </div>
            )}

            {/* Информация о дочерних категориях */}
            {categoryDetails.childCategories.length > 0 && (
              <div>
                <Title level={5}>
                  <FolderOutlined /> Дочерние категории ({categoryDetails.childCategories.length} шт.)
                </Title>
                
                <div style={{ marginBottom: 16 }}>
                  {categoryDetails.childCategories.map(child => (
                    <Text key={child.id} type="secondary" style={{ display: 'block' }}>
                      📁 {child.name}
                    </Text>
                  ))}
                </div>

                <Radio.Group 
                  value={childAction} 
                  onChange={(e) => setChildAction(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="promote">
                      <Space>
                        <ArrowRightOutlined />
                        <Text>Сделать корневыми категориями (убрать родителя)</Text>
                      </Space>
                    </Radio>
                    
                    <Radio value="move">
                      <Space>
                        <ArrowRightOutlined />
                        <Text>Перенести к другой родительской категории</Text>
                      </Space>
                    </Radio>
                    {childAction === 'move' && (
                      <Form.Item
                        name="targetParentId"
                        style={{ marginLeft: 24, marginBottom: 8 }}
                        rules={[{ required: true, message: 'Выберите новую родительскую категорию' }]}
                      >
                        <Select 
                          placeholder="Выберите новую родительскую категорию"
                          style={{ width: '100%' }}
                        >
                          {availableCategories.map(cat => (
                            <Option key={cat.id} value={cat.id}>
                              📁 {cat.name} {cat.path && `(${cat.path})`}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                    
                    <Radio value="delete">
                      <Space>
                        <DeleteOutlined style={{ color: '#ff4d4f' }} />
                        <Text type="danger">Удалить все дочерние категории</Text>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>
            )}

            {/* Информация если категория пуста */}
            {categoryDetails.productsCount === 0 && categoryDetails.childCategories.length === 0 && (
              <Alert
                message="Категория пуста"
                description="В этой категории нет товаров и дочерних категорий. Она будет удалена без дополнительных действий."
                type="info"
                showIcon
              />
            )}
          </Form>
        )}
      </Space>
    </Modal>
  );
};

export default DeleteCategoryModal; 