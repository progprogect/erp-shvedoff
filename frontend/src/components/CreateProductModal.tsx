import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Row, Col, Button, Space, message, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { catalogApi, Category } from '../services/catalogApi';
import { surfacesApi, Surface } from '../services/surfacesApi';
import { logosApi, Logo } from '../services/logosApi';
import { materialsApi, Material } from '../services/materialsApi';
import { puzzleTypesApi, PuzzleType } from '../services/puzzleTypesApi';
import { useAuthStore } from '../stores/authStore';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

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
  const [puzzleTypes, setPuzzleTypes] = useState<PuzzleType[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [creatingLogo, setCreatingLogo] = useState(false);
  const [newPuzzleTypeName, setNewPuzzleTypeName] = useState('');
  const [creatingPuzzleType, setCreatingPuzzleType] = useState(false);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<number | null>(null);
  const [puzzleOptions, setPuzzleOptions] = useState({
    sides: '1_side' as '1_side' | '2_sides' | '3_sides' | '4_sides',
    type: 'old' as string,
    enabled: false
  });
  const [calculatedMatArea, setCalculatedMatArea] = useState<number | null>(null);
  const [matAreaOverride, setMatAreaOverride] = useState<string>('');
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
      const [surfacesResponse, logosResponse, materialsResponse, puzzleTypesResponse] = await Promise.all([
        surfacesApi.getSurfaces(token),
        logosApi.getLogos(token),
        materialsApi.getMaterials(token),
        puzzleTypesApi.getPuzzleTypes(token)
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
      if (puzzleTypesResponse.success) {
        setPuzzleTypes(puzzleTypesResponse.data);
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

  // Создание нового типа паззла
  const createNewPuzzleType = async () => {
    if (!token || !newPuzzleTypeName.trim()) {
      message.error('Введите название типа паззла');
      return;
    }

    setCreatingPuzzleType(true);
    try {
      const response = await puzzleTypesApi.createPuzzleType({
        name: newPuzzleTypeName.trim(),
        description: `Пользовательский тип паззла: ${newPuzzleTypeName.trim()}`
      }, token);

      if (response.success) {
        // Добавляем новый тип в список
        setPuzzleTypes(prev => [...prev, response.data]);
        // Устанавливаем его в состоянии паззла
        setPuzzleOptions(prev => ({ ...prev, type: response.data.code as string }));
        setNewPuzzleTypeName('');
        message.success('Тип паззла успешно создан');
      }
    } catch (error: any) {
      console.error('Ошибка создания типа паззла:', error);
      message.error(error.response?.data?.error?.message || 'Ошибка создания типа паззла');
    } finally {
      setCreatingPuzzleType(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!token) return;

    setLoading(true);
    try {
      // Проверяем выбрана ли поверхность "Паззл"
      const isPuzzleSurface = surfaces.find(s => s.id === values.surfaceId)?.name === 'Паззл';

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
        puzzleOptions: isPuzzleSurface && puzzleOptions.enabled ? puzzleOptions : undefined,
        matArea: values.matArea ? parseFloat(values.matArea) : undefined,
        weight: values.weight ? parseFloat(values.weight) : undefined,
        grade: values.grade || 'usual',
        price: values.price ? parseFloat(values.price) : undefined,
        normStock: values.normStock || 0,
        initialStock: values.initialStock || 0,
        notes: values.notes || null
      };

      const response = await catalogApi.createProduct(productData);
      
      if (response.success) {
        message.success('Товар успешно создан');
        form.resetFields();
        setSelectedSurfaceId(null);
        setPuzzleOptions({ sides: '1_side', type: (puzzleTypes[0]?.code || 'old') as string, enabled: false });
        setCalculatedMatArea(null);
        setMatAreaOverride('');
        // Устанавливаем значения по умолчанию
        form.setFieldsValue({ grade: 'usual' });
        onSuccess();
        onClose();
      } else {
        message.error('Ошибка создания товара');
      }
    } catch (error: any) {
      console.error('Ошибка создания товара:', error);
      
      // Специальная обработка ошибки дублирования артикула
      if (error.response?.data?.message?.includes('Товар с таким артикулом уже существует')) {
        message.error(error.response.data.message);
        // Подсвечиваем поле артикула с ошибкой
        form.setFields([{
          name: 'article',
          errors: [error.response.data.message]
        }]);
      } else {
        message.error(error.response?.data?.message || 'Ошибка связи с сервером');
      }
    } finally {
      setLoading(false);
    }
  };

  // Генерация артикула на основе названия и расчет площади мата
  const generateArticle = () => {
    const name = form.getFieldValue('name');
    const length = form.getFieldValue('length');
    const width = form.getFieldValue('width');
    const thickness = form.getFieldValue('thickness');
    const surfaceId = form.getFieldValue('surfaceId');
    
            // Генерация артикула
        if (name) {
          // Краткий символ из названия
          let article = name
            .replace(/[^а-яё\s]/gi, '')
            .split(' ')
            .map((word: string) => word.slice(0, 3).toUpperCase())
            .join('-');
          
          // Размер через x
          if (length && width && thickness) {
            article += `-${length}x${width}x${thickness}`;
          }
          
          // Краткое обозначение поверхности
          if (surfaceId) {
            const surface = surfaces.find(s => s.id === surfaceId);
            if (surface) {
              const surfaceCode = surface.name
                .replace(/[^а-яё\s]/gi, '')
                .split(' ')
                .map((word: string) => word.slice(0, 2).toUpperCase())
                .join('');
              if (surfaceCode) {
                article += `-${surfaceCode}`;
              }
            }
          }
          
          form.setFieldsValue({ article });
        }

    // Расчет площади мата (длина × ширина в м²)
    if (length && width) {
      const areaM2 = (length * width) / 1000000; // мм² в м²
      const roundedArea = Number(areaM2.toFixed(4));
      setCalculatedMatArea(roundedArea);
      
      // Если пользователь не переопределил площадь, используем расчетную
      if (!matAreaOverride) {
        form.setFieldsValue({ matArea: roundedArea });
      }
    } else {
      setCalculatedMatArea(null);
      if (!matAreaOverride) {
        form.setFieldsValue({ matArea: undefined });
      }
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
                onChange={(value) => {
                  setSelectedSurfaceId(value);
                  const isPuzzle = surfaces.find(s => s.id === value)?.name === 'Паззл';
                  if (isPuzzle) {
                    // Автоматически включаем опции паззла при выборе поверхности "Паззл"
                    setPuzzleOptions({ sides: '1_side', type: 'old', enabled: true });
                  } else {
                    setPuzzleOptions({ sides: '1_side', type: 'old', enabled: false });
                  }
                }}
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

        {/* Дополнительные характеристики */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="weight"
              label="Вес (кг)"
            >
              <InputNumber 
                placeholder="Например: 15.5"
                style={{ width: '100%' }}
                min={0}
                precision={3}
                step={0.1}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="grade"
              label="Сорт товара"
              initialValue="usual"
            >
              <Select style={{ width: '100%' }}>
                <Option value="usual">Обычный</Option>
                <Option value="grade_2">2 сорт</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            {/* Пустая колонка для симметрии */}
          </Col>
        </Row>

        {/* Опции паззла - показываются только при выборе поверхности "Паззл" */}
        {surfaces.find(s => s.id === selectedSurfaceId)?.name === 'Паззл' && (
          <Row gutter={16} style={{ backgroundColor: '#f0f8ff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <Col span={24}>
              <div style={{ marginBottom: '12px' }}>
                                 <span style={{ fontWeight: 'bold', color: '#1890ff' }}>🧩 Настройки паззловой поверхности</span>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={puzzleOptions.enabled}
                    onChange={(e) => setPuzzleOptions({...puzzleOptions, enabled: e.target.checked})}
                    style={{ marginRight: '8px' }}
                  />
                                     <span>Включить опции паззла</span>
                </label>
              </div>
            </Col>
            {puzzleOptions.enabled && (
              <>
                <Col span={9}>
                  <div style={{ marginBottom: '8px' }}>
                                         <span>Количество сторон:</span>
                  </div>
                  <Select
                    value={puzzleOptions.sides}
                    onChange={(value) => setPuzzleOptions({...puzzleOptions, sides: value})}
                    style={{ width: '100%' }}
                  >
                    <Option value="1_side">1 сторона</Option>
                    <Option value="2_sides">2 стороны</Option>
                    <Option value="3_sides">3 стороны</Option>
                    <Option value="4_sides">4 стороны</Option>
                  </Select>
                </Col>
                <Col span={9}>
                  <div style={{ marginBottom: '8px' }}>
                                         <span>Тип паззла:</span>
                  </div>
                  <Select
                    value={puzzleOptions.type}
                    onChange={(value) => setPuzzleOptions({...puzzleOptions, type: value})}
                    style={{ width: '100%' }}
                    loading={loadingReferences}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                          <Input
                            placeholder="Название нового типа паззла"
                            value={newPuzzleTypeName}
                            onChange={(e) => setNewPuzzleTypeName(e.target.value)}
                            onPressEnter={createNewPuzzleType}
                            style={{ marginBottom: 8 }}
                          />
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={createNewPuzzleType}
                            loading={creatingPuzzleType}
                            disabled={!newPuzzleTypeName.trim()}
                            style={{ width: '100%' }}
                          >
                            Создать новый тип
                          </Button>
                        </div>
                      </>
                    )}
                  >
                    {puzzleTypes.map(type => (
                      <Option key={type.id} value={type.code}>
                        🧩 {type.name}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </>
            )}
          </Row>
        )}

        {/* Площадь мата */}
        <Row gutter={16} style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
          <Col span={24}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#52c41a' }}>📐 Площадь мата</span>
            </div>
          </Col>
          <Col span={12}>
            <Form.Item
              name="matArea"
              label={
                <span>
                  Площадь (м²)
                  {calculatedMatArea && (
                    <span style={{ color: '#1890ff', fontWeight: 'normal', marginLeft: 8 }}>
                      (автоматически: {calculatedMatArea} м²)
                    </span>
                  )}
                </span>
              }
            >
              <InputNumber 
                placeholder="Рассчитается автоматически"
                style={{ width: '100%' }}
                min={0}
                precision={4}
                step={0.0001}
                onChange={(value: number | null) => {
                  setMatAreaOverride(value ? value.toString() : '');
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <div style={{ paddingTop: '30px', color: '#666', fontSize: '12px' }}>
              {calculatedMatArea ? (
                <>
                  📏 Расчет: {form.getFieldValue('length') || 0} × {form.getFieldValue('width') || 0} мм = {calculatedMatArea} м²<br/>
                  💡 Можете скорректировать значение при необходимости
                </>
              ) : (
                '📏 Введите длину и ширину для автоматического расчета площади'
              )}
            </div>
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
          <Col span={8}>
            <Form.Item
              name="initialStock"
              label="Начальный остаток (шт)"
              help="Количество товара для начального оприходования на склад"
            >
              <InputNumber 
                placeholder="0"
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