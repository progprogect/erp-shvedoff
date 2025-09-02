import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, message } from 'antd';
import { FolderAddOutlined } from '@ant-design/icons';
import { catalogApi, Category } from '../services/catalogApi';
import { useAuthStore } from '../stores/authStore';
import { handleFormError } from '../utils/errorUtils';

const { Option } = Select;
const { TextArea } = Input;

interface CreateCategoryModalProps {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  visible,
  categories,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const handleSubmit = async (values: any) => {
    if (!token) return;

    setLoading(true);
    try {
      const categoryData = {
        name: values.name,
        parentId: values.parentId || undefined,
        description: values.description || undefined
      };

      const response = await catalogApi.createCategory(categoryData);
      
      if (response.success) {
        message.success('Категория успешно создана');
        form.resetFields();
        onSuccess();
        onClose();
      } else {
        message.error('Ошибка создания категории');
      }
    } catch (error: any) {
      console.error('🚨 Ошибка создания категории:', error);
      handleFormError(error, form, {
        key: 'create-category-error',
        duration: 6
      });
    } finally {
      setLoading(false);
    }
  };

  const flatCategories = (categories: Category[]): Category[] => {
    let result: Category[] = [];
    categories.forEach(category => {
      result.push(category);
      if (category.children) {
        result = result.concat(flatCategories(category.children));
      }
    });
    return result;
  };

  return (
    <Modal
      title={
        <div>
          <FolderAddOutlined style={{ color: '#1890ff', marginRight: 8 }} />
          Добавить новую категорию
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="Название категории"
          rules={[
            { required: true, message: 'Введите название категории' },
            { min: 2, message: 'Минимум 2 символа' }
          ]}
        >
          <Input 
            placeholder="Например: Лежаки резиновые"
          />
        </Form.Item>

        <Form.Item
          name="parentId"
          label="Родительская категория"
          help="Оставьте пустым для создания корневой категории"
        >
          <Select 
            placeholder="Выберите родительскую категорию (опционально)"
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {flatCategories(categories).map(category => (
              <Option key={category.id} value={category.id}>
                📁 {category.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="description"
          label="Описание"
        >
          <TextArea 
            rows={3}
            placeholder="Описание категории (опционально)..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<FolderAddOutlined />}
            >
              Создать категорию
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCategoryModal; 