import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Row, Col, Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { catalogApi, Category } from '../services/catalogApi';
import { surfacesApi, Surface } from '../services/surfacesApi';
import { logosApi, Logo } from '../services/logosApi';
import { materialsApi, Material } from '../services/materialsApi';
import { useAuthStore } from '../stores/authStore';

const { Option } = Select;
const { TextArea } = Input;

interface CreateProductModalProps {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const CreateProductModal: React.FC<CreateProductModalProps> = ({
  visible,
  categories,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [creatingLogo, setCreatingLogo] = useState(false);
  const { token } = useAuthStore();

  // Загрузка справочников при открытии модала
  useEffect(() => {
    if (visible && token) {
      loadReferences();
    }
  }, [visible, token]);

  const loadReferences = async () => {
    if (!token) return;
    
    setLoadingReferences(true);
    try {
      const [surfacesResponse, logosResponse, materialsResponse] = await Promise.all([
        surfacesApi.getSurfaces(token),
        logosApi.getLogos(token),
        materialsApi.getMaterials(token)
      ]);

      if (surfacesResponse.success) {
        setSurfaces(surfacesResponse.data);
      }
      if (logosResponse.success) {
        setLogos(logosResponse.data);
      }
      if (materialsResponse.success) {
        setMaterials(materialsResponse.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки справочников:', error);
      message.error('Ошибка загрузки справочников');
    } finally {
      setLoadingReferences(false);
    }
  };

  // Создание нового логотипа
  const createNewLogo = async () => {
    if (!token || !newLogoName.trim()) {
      message.error('Введите название логотипа');
      return;
    }

    setCreatingLogo(true);
    try {
      const response = await logosApi.createLogo({
        name: newLogoName.trim(),
        description: `Пользовательский логотип: ${newLogoName.trim()}`
      }, token);

      if (response.success) {
        // Добавляем новый логотип в список
        setLogos(prev => [...prev, response.data]);
        // Устанавливаем его в форме
        form.setFieldsValue({ logoId: response.data.id });
        setNewLogoName('');
        message.success('Логотип успешно создан');
      }
    } catch (error: any) {
      console.error('Ошибка создания логотипа:', error);
      message.error(error.response?.data?.error?.message || 'Ошибка создания логотипа');
    } finally {
      setCreatingLogo(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!token) return;

    setLoading(true);
    try {
      const productData = {
        name: values.name,
        article: values.article || null,
        categoryId: values.categoryId,
        surfaceId: values.surfaceId || null,
        logoId: values.logoId || null,
        materialId: values.materialId || null,
        dimensions: values.length && values.width && values.thickness ? {
          length: Number(values.length),
          width: Number(values.width),
          thickness: Number(values.thickness)
        } : undefined,
        price: values.price ? parseFloat(values.price) : undefined,
        normStock: values.normStock || 0,
        notes: values.notes || null
      };

      const response = await catalogApi.createProduct(productData);
      
      if (response.success) {
        message.success('Товар успешно создан');
        form.resetFields();
        onSuccess();
        onClose();
      } else {
        message.error('Ошибка создания товара');
      }
    } catch (error) {
      console.error('Ошибка создания товара:', error);
      message.error('Ошибка связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  // Генерация артикула на основе названия
  const generateArticle = () => {
    const name = form.getFieldValue('name');
    if (name) {
      const length = form.getFieldValue('length');
      const width = form.getFieldValue('width');
      const thickness = form.getFieldValue('thickness');
      
      let article = name
        .replace(/[^а-яё\s]/gi, '')
        .split(' ')
        .map((word: string) => word.slice(0, 3).toUpperCase())
        .join('-');
      
      if (length && width && thickness) {
        article += `-${length}-${width}-${thickness}`;
      }
      
      form.setFieldsValue({ article });
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
          <PlusOutlined style={{ color: '#1890ff', marginRight: 8 }} />
          Добавить новый товар
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {/* Основная информация */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Название товара"
              rules={[
                { required: true, message: 'Введите название товара' },
                { min: 2, message: 'Минимум 2 символа' }
              ]}
            >
              <Input 
                placeholder="Например: Лежак резиновый чешский"
                onChange={generateArticle}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="article"
              label="Артикул"
            >
              <Input 
                placeholder="Автоматически или введите вручную"
                addonAfter={
                  <Button 
                    type="link" 
                    size="small"
                    onClick={generateArticle}
                    style={{ padding: '0 4px' }}
                  >
                    🎲
                  </Button>
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="categoryId"
              label="Категория"
              rules={[{ required: true, message: 'Выберите категорию' }]}
            >
              <Select 
                placeholder="Выберите категорию товара"
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
          </Col>
        </Row>

        {/* Размеры */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="length"
              label="Длина (мм)"
            >
              <InputNumber 
                placeholder="1800"
                style={{ width: '100%' }}
                min={1}
                onChange={generateArticle}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="width"
              label="Ширина (мм)"
            >
              <InputNumber 
                placeholder="1200"
                style={{ width: '100%' }}
                min={1}
                onChange={generateArticle}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="thickness"
              label="Толщина (мм)"
            >
              <InputNumber 
                placeholder="30"
                style={{ width: '100%' }}
                min={1}
                onChange={generateArticle}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Характеристики */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="surfaceId"
              label="Поверхность"
            >
              <Select 
                placeholder="Выберите тип поверхности"
                loading={loadingReferences}
                showSearch
                optionFilterProp="children"
                allowClear
              >
                {surfaces.map(surface => (
                  <Option key={surface.id} value={surface.id}>
                    🎨 {surface.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="logoId"
              label="Логотип"
            >
              <Select 
                placeholder="Выберите логотип или создайте новый"
                loading={loadingReferences}
                showSearch
                optionFilterProp="children"
                allowClear
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                      <Input
                        placeholder="Название нового логотипа"
                        value={newLogoName}
                        onChange={(e) => setNewLogoName(e.target.value)}
                        onPressEnter={createNewLogo}
                        style={{ marginBottom: 8 }}
                      />
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={createNewLogo}
                        loading={creatingLogo}
                        disabled={!newLogoName.trim()}
                        style={{ width: '100%' }}
                      >
                        Создать новый логотип
                      </Button>
                    </div>
                  </>
                )}
              >
                {logos.map(logo => (
                  <Option key={logo.id} value={logo.id}>
                    📝 {logo.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="materialId"
              label="Материал"
            >
              <Select 
                placeholder="Выберите материал"
                loading={loadingReferences}
                showSearch
                optionFilterProp="children"
                allowClear
              >
                {materials.map(material => (
                  <Option key={material.id} value={material.id}>
                    🛠️ {material.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Цены и нормы */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="price"
              label="Цена продажи (₽)"
            >
              <InputNumber 
                placeholder="15000"
                style={{ width: '100%' }}
                min={0}
                precision={2}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="normStock"
              label="Норма остатка (шт)"
            >
              <InputNumber 
                placeholder="10"
                style={{ width: '100%' }}
                min={0}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Примечания */}
        <Row>
          <Col span={24}>
            <Form.Item
              name="notes"
              label="Примечания"
            >
              <TextArea 
                rows={3}
                placeholder="Дополнительная информация о товаре..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Кнопки */}
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<PlusOutlined />}
            >
              Создать товар
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateProductModal; 