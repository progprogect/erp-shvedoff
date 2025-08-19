import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Row, Col, Button, Space, Typography, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { catalogApi, Category } from '../services/catalogApi';
import { surfacesApi, Surface } from '../services/surfacesApi';
import { logosApi, Logo } from '../services/logosApi';
import { materialsApi, Material } from '../services/materialsApi';
import { puzzleTypesApi, PuzzleType } from '../services/puzzleTypesApi';
import { useAuthStore } from '../stores/authStore';
import carpetEdgeTypesApi, { CarpetEdgeType } from '../services/carpetEdgeTypesApi';

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
  const { message } = App.useApp();
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
  // Состояние для новых полей края ковра
  const [carpetEdgeTypes, setCarpetEdgeTypes] = useState<CarpetEdgeType[]>([]);
  const [selectedCarpetEdgeType, setSelectedCarpetEdgeType] = useState<string>('straight_cut');
  const [carpetEdgeSides, setCarpetEdgeSides] = useState<number>(1);
  const [carpetEdgeStrength, setCarpetEdgeStrength] = useState<string>('normal');
  
  // Состояние для площади мата
  const [calculatedMatArea, setCalculatedMatArea] = useState<number | null>(null);
  const [matAreaOverride, setMatAreaOverride] = useState<string>('');
  const { token } = useAuthStore();

  // Загрузка справочников при открытии модала
  useEffect(() => {
    if (visible && token) {
      loadReferences();
    }
  }, [visible, token]);

  // В useEffect загружаем типы края ковра
  useEffect(() => {
    const loadCarpetEdgeTypes = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await carpetEdgeTypesApi.getCarpetEdgeTypes(token);
          if (response.success) {
            setCarpetEdgeTypes(response.data);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки типов края ковра:', error);
      }
    };

    loadCarpetEdgeTypes();
  }, []);

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
        // setPuzzleOptions(prev => ({ ...prev, type: response.data.code as string })); // Удалено
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
        // Новые поля для края ковра
        carpetEdgeType: values.carpetEdgeType || 'straight_cut',
        carpetEdgeSides: values.carpetEdgeSides || 1,
        carpetEdgeStrength: values.carpetEdgeStrength || 'normal',
        // Поля паззла (если выбран паззловый край)
        puzzleTypeId: values.carpetEdgeType === 'puzzle' ? values.puzzleTypeId : null,
        puzzleSides: values.carpetEdgeType === 'puzzle' ? values.carpetEdgeSides : 1,
        matArea: values.matArea ? parseFloat(values.matArea) : undefined,
        weight: values.weight ? parseFloat(values.weight) : undefined,
        grade: values.grade || 'usual',
        borderType: values.borderType || null,
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
        setSelectedCarpetEdgeType('straight_cut');
        setCarpetEdgeSides(1);
        setCarpetEdgeStrength('normal');
        setCalculatedMatArea(null);
        setMatAreaOverride('');
        // Устанавливаем значения по умолчанию
        form.setFieldsValue({ 
          grade: 'usual',
          carpetEdgeType: 'straight_cut',
          carpetEdgeStrength: 'normal'
        });
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

  // Генерация артикула на основе названия и расчет площади мата (ВСЕ параметры включены)
  const generateArticle = () => {
    const name = form.getFieldValue('name');
    const length = form.getFieldValue('length');
    const width = form.getFieldValue('width');
    const thickness = form.getFieldValue('thickness');
    const surfaceId = form.getFieldValue('surfaceId');
    const materialId = form.getFieldValue('materialId');
    const logoId = form.getFieldValue('logoId');
    const borderType = form.getFieldValue('borderType');
    const grade = form.getFieldValue('grade');
    
    // Генерация артикула согласно Задаче 7.4 (ПОЛНАЯ версия со ВСЕМИ параметрами)
    if (name) {
      let article = '';
      
      // 1. Краткое название - ВКЛЮЧАЕМ ВСЕ значимые слова
      const nameWords = name
        .toLowerCase()
        .replace(/[^а-яёa-z\s]/gi, '')
        .split(' ')
        .filter((word: string) => word.length > 1) // Берем все слова длиннее 1 символа
      
      // Создаем понятные сокращения (можно чуть длиннее для ясности)
      const nameCode = nameWords.map((word: string) => {
        // Расширенные предопределенные сокращения для основных слов
        const predefinedCodes: { [key: string]: string } = {
          'лежак': 'ЛЕЖАК',
          'лежачий': 'ЛЕЖАЧ',
          'резиновый': 'РЕЗИН',
          'резина': 'РЕЗИН',
          'коврик': 'КОВР',
          'ковер': 'КОВР', 
          'покрытие': 'ПОКР',
          'мат': 'МАТ',
          'мата': 'МАТ',
          'матовый': 'МАТОВ',
          'чешский': 'ЧЕШСК',
          'чешуйчатый': 'ЧЕШУЙ',
          'гладкий': 'ГЛАДК',
          'стандартный': 'СТАНД',
          'обычный': 'ОБЫЧН',
          'специальный': 'СПЕЦ',
          'большой': 'БОЛЬШ',
          'малый': 'МАЛЫЙ',
          'средний': 'СРЕДН',
          'паззл': 'ПАЗЛ',
          'пазл': 'ПАЗЛ',
          'элементов': 'ЭЛЕМ',
          'деталей': 'ДЕТ',
          'частей': 'ЧАСТ',
          'штук': 'ШТ',
          'сторона': 'СТ',
          'сторонний': 'СТОР',
          'двухсторонний': '2СТ',
          'односторонний': '1СТ',
          'многосторонний': 'МСТОР'
        };
        
        if (predefinedCodes[word]) {
          return predefinedCodes[word];
        }
        
        // Если нет предопределенного кода, берем первые 3-4 буквы для ясности
        if (word.length <= 4) {
          return word.toUpperCase();
        }
        return word.slice(0, 4).toUpperCase();
      }).join('-');
      
      if (nameCode) {
        article = nameCode;
      }
      
      // 2. Размеры в формате Длина×Ширина×Толщина (ВСЕ размеры включены)
      if (length && width && thickness) {
        article += `-${length}x${width}x${thickness}`;
      } else if (length && width) {
        article += `-${length}x${width}`;
      }
      
      // 3. Материал (понятный код чуть длиннее)
      if (materialId) {
        const material = materials.find(m => m.id === materialId);
        if (material) {
          const materialCodes: { [key: string]: string } = {
            'протектор': 'ПРОТ',
            'дробленка': 'ДРОБ',
            'резина': 'РЕЗИН',
            'пластик': 'ПЛАСТ',
            'каучук': 'КАУЧ'
          };
          
          const materialName = material.name.toLowerCase();
          let materialCode = '';
          
          // Ищем предопределенный код
          for (const [key, code] of Object.entries(materialCodes)) {
            if (materialName.includes(key)) {
              materialCode = code;
              break;
            }
          }
          
          // Если нет предопределенного, берем первые 3-4 буквы для понятности
          if (!materialCode) {
            const firstWord = material.name
              .replace(/[^а-яёa-z\s]/gi, '')
              .split(' ')[0];
            materialCode = firstWord.length <= 4 ? firstWord.toUpperCase() : firstWord.slice(0, 4).toUpperCase();
          }
          
          if (materialCode) {
            article += `-${materialCode}`;
          }
        }
      }
      
      // 4. Поверхность (понятный код чуть длиннее)
      if (surfaceId) {
        const surface = surfaces.find(s => s.id === surfaceId);
        if (surface) {
          const surfaceCodes: { [key: string]: string } = {
            'чешуйки': 'ЧЕШУЙ',
            'чешуйка': 'ЧЕШУЙ', 
            'черточки': 'ЧЕРТ',
            'гладкая': 'ГЛАДК',
            'коровка': 'КОРОВ',
            '1 коровка': '1КОР',
            '3 коровки': '3КОР'
          };
          
          const surfaceName = surface.name.toLowerCase();
          let surfaceCode = '';
          
          // Ищем предопределенный код
          for (const [key, code] of Object.entries(surfaceCodes)) {
            if (surfaceName.includes(key)) {
              surfaceCode = code;
              break;
            }
          }
          
          // Если нет предопределенного, берем первые 3-4 буквы для понятности
          if (!surfaceCode) {
            const firstWord = surface.name
              .replace(/[^а-яёa-z\s]/gi, '')
              .split(' ')[0];
            surfaceCode = firstWord.length <= 4 ? firstWord.toUpperCase() : firstWord.slice(0, 4).toUpperCase();
          }
          
          if (surfaceCode) {
            article += `-${surfaceCode}`;
          }
        }
      }
      
      // 5. Наличие борта (всегда указываем для полноты)
      if (borderType) {
        const borderCode = borderType === 'with_border' ? 'СБОРТ' : 'БЕЗБОРТ';
        article += `-${borderCode}`;
      }
      
      // 6. Логотип (понятный код чуть длиннее)
      if (logoId) {
        const logo = logos.find(l => l.id === logoId);
        if (logo) {
          const logoCodes: { [key: string]: string } = {
            'gea': 'GEA',
            'maximilk': 'MAXIM',
            'veles': 'VELES',
            'агротек': 'АГРОТ',
            'арнтьен': 'АРНТ'
          };
          
          const logoName = logo.name.toLowerCase();
          let logoCode = '';
          
          // Ищем предопределенный код
          for (const [key, code] of Object.entries(logoCodes)) {
            if (logoName.includes(key)) {
              logoCode = code;
              break;
            }
          }
          
          // Если нет предопределенного, берем первые 3-4 буквы для понятности
          if (!logoCode) {
            const firstWord = logo.name
              .replace(/[^а-яёa-z\s]/gi, '')
              .split(' ')[0];
            logoCode = firstWord.length <= 4 ? firstWord.toUpperCase() : firstWord.slice(0, 4).toUpperCase();
          }
          
          if (logoCode) {
            article += `-${logoCode}`;
          }
        }
      }
      
      // 7. Сорт (всегда указываем для полноты)
      if (grade && grade !== 'usual') {
        article += `-2СОРТ`;
      } else if (grade === 'usual') {
        article += `-1СОРТ`;
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
              label="Высота (мм)"
              rules={[
                { required: false, message: 'Введите высоту' },
                { type: 'number', min: 1, message: 'Высота должна быть больше 0' }
              ]}
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
                  // if (isPuzzle) { // Удалено
                  //   // Автоматически включаем опции паззла при выборе поверхности "Паззл" // Удалено
                  //   setPuzzleOptions({ sides: '1_side', type: 'old', enabled: true }); // Удалено
                  // } else { // Удалено
                  //   setPuzzleOptions({ sides: '1_side', type: 'old', enabled: false }); // Удалено
                  // }
                  // Генерируем артикул при изменении поверхности (Задача 7.4)
                  setTimeout(generateArticle, 100);
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
                onChange={() => setTimeout(generateArticle, 100)}
                popupRender={(menu) => (
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
                onChange={() => setTimeout(generateArticle, 100)}
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
              <Select 
                style={{ width: '100%' }}
                onChange={() => setTimeout(generateArticle, 100)}
              >
                <Option value="usual">Обычный</Option>
                <Option value="grade_2">2 сорт</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="borderType"
              label="Наличие борта"
            >
              <Select 
                style={{ width: '100%' }} 
                placeholder="Выберите тип борта"
                onChange={() => setTimeout(generateArticle, 100)}
              >
                <Option value="with_border">С бортом</Option>
                <Option value="without_border">Без борта</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Край ковра - новые поля */}
        <Row gutter={16} style={{ backgroundColor: '#f0f8ff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <Col span={24}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>✂️ Настройки края ковра</span>
            </div>
          </Col>
          
          <Col span={8}>
            <Form.Item
              name="carpetEdgeType"
              label="Край ковра"
              rules={[{ required: true, message: 'Выберите тип края' }]}
              initialValue="straight_cut"
            >
              <Select
                placeholder="Выберите тип края"
                onChange={(value) => {
                  setSelectedCarpetEdgeType(value);
                  // Очищаем поля паззла при смене на прямой рез
                  if (value === 'straight_cut') {
                    form.setFieldsValue({
                      carpetEdgeSides: 1,
                      puzzleTypeId: undefined
                    });
                  }
                }}
              >
                {carpetEdgeTypes.map(type => (
                  <Option key={type.code} value={type.code}>
                    {type.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          
          {selectedCarpetEdgeType === 'puzzle' && (
            <>
              <Col span={8}>
                <Form.Item
                  name="carpetEdgeSides"
                  label="Количество сторон"
                  rules={[{ required: true, message: 'Выберите количество сторон' }]}
                  initialValue={1}
                >
                  <Select placeholder="Выберите количество сторон">
                    <Option value={1}>1 сторона</Option>
                    <Option value={2}>2 стороны</Option>
                    <Option value={3}>3 стороны</Option>
                    <Option value={4}>4 стороны</Option>
                  </Select>
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item
                  name="puzzleTypeId"
                  label="Тип паззла"
                  rules={[{ required: true, message: 'Выберите тип паззла' }]}
                >
                  <Select placeholder="Выберите тип паззла">
                    {puzzleTypes.map(type => (
                      <Option key={type.id} value={type.id}>
                        {type.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </>
          )}
        </Row>

        {/* Усиленный край */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="carpetEdgeStrength"
              label="Усиленный край"
              rules={[{ required: true, message: 'Выберите тип усиления' }]}
              initialValue="normal"
            >
              <Select placeholder="Выберите тип усиления">
                <Option value="normal">Обычный</Option>
                <Option value="reinforced">Усиленный</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

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