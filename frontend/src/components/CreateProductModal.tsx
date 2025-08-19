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
import bottomTypesApi, { BottomType } from '../services/bottomTypesApi';

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
  
  // Состояние для низа ковра
  const [bottomTypes, setBottomTypes] = useState<BottomType[]>([]);
  const [selectedBottomTypeId, setSelectedBottomTypeId] = useState<number | null>(null);
  
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
      const [surfacesResponse, logosResponse, materialsResponse, puzzleTypesResponse, bottomTypesResponse] = await Promise.all([
        surfacesApi.getSurfaces(token),
        logosApi.getLogos(token),
        materialsApi.getMaterials(token),
        puzzleTypesApi.getPuzzleTypes(token),
        bottomTypesApi.getBottomTypes(token)
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
      if (bottomTypesResponse.success) {
        setBottomTypes(bottomTypesResponse.data);
        // Устанавливаем значение по умолчанию (шип-0)
        const defaultBottomType = bottomTypesResponse.data.find(bt => bt.code === 'spike_0');
        if (defaultBottomType) {
          setSelectedBottomTypeId(defaultBottomType.id);
        }
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
        // Поле для низа ковра
        bottomTypeId: values.bottomTypeId,
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
    const bottomTypeId = form.getFieldValue('bottomTypeId');
    
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

      // 8. Низ ковра (понятный код чуть длиннее)
      if (bottomTypeId) {
        const bottomType = bottomTypes.find(bt => bt.id === bottomTypeId);
        if (bottomType) {
          const bottomTypeCodes: { [key: string]: string } = {
            'шип-0': 'ШИП0',
            'шип-2': 'ШИП2',
            'шип-5': 'ШИП5',
            'шип-7': 'ШИП7',
            'шип-11': 'ШИП11'
          };
          
          const bottomTypeName = bottomType.name.toLowerCase();
          let bottomTypeCode = '';
          
          // Ищем предопределенный код
          for (const [key, code] of Object.entries(bottomTypeCodes)) {
            if (bottomTypeName.includes(key)) {
              bottomTypeCode = code;
              break;
            }
          }
          
          // Если нет предопределенного, берем первые 3-4 буквы для понятности
          if (!bottomTypeCode) {
            const firstWord = bottomType.name
              .replace(/[^а-яёa-z\s]/gi, '')
              .split(' ')[0];
            bottomTypeCode = firstWord.length <= 4 ? firstWord.toUpperCase() : firstWord.slice(0, 4).toUpperCase();
          }
          
          if (bottomTypeCode) {
            article += `-${bottomTypeCode}`;
          }
        }
      }

      // 9. Тип паззла (если выбран паззловый край)
      const carpetEdgeType = form.getFieldValue('carpetEdgeType');
      const puzzleTypeId = form.getFieldValue('puzzleTypeId');
      if (carpetEdgeType === 'puzzle') {
        const puzzleType = puzzleTypes.find(pt => pt.id === puzzleTypeId);
        if (puzzleType) {
          const puzzleTypeCodes: { [key: string]: string } = {
            'puzzle_type_1': 'ПАЗЛ1',
            'puzzle_type_2': 'ПАЗЛ2',
            'puzzle_type_3': 'ПАЗЛ3'
          };
          
          const puzzleTypeName = puzzleType.name.toLowerCase();
          let puzzleTypeCode = '';
          
          // Ищем предопределенный код
          for (const [key, code] of Object.entries(puzzleTypeCodes)) {
            if (puzzleTypeName.includes(key)) {
              puzzleTypeCode = code;
              break;
            }
          }
          
          // Если нет предопределенного, берем первые 3-4 буквы для понятности
          if (!puzzleTypeCode) {
            const firstWord = puzzleType.name
              .replace(/[^а-яёa-z\s]/gi, '')
              .split(' ')[0];
            puzzleTypeCode = firstWord.length <= 4 ? firstWord.toUpperCase() : firstWord.slice(0, 4).toUpperCase();
          }
          
          if (puzzleTypeCode) {
            article += `-${puzzleTypeCode}`;
          }
        }
      }

      // 10. Площадь мата
      const matArea = form.getFieldValue('matArea');
      if (matArea) {
        article += `-${matArea}м²`;
      }

      // 11. Вес
      const weight = form.getFieldValue('weight');
      if (weight) {
        article += `-${weight}кг`;
      }

      // 12. Оценка
      const gradeValue = form.getFieldValue('grade');
      if (gradeValue && gradeValue !== 'usual') {
        article += `-${gradeValue}`;
      }

      // 13. Тип упаковки
      const borderTypeValue = form.getFieldValue('borderType');
      if (borderTypeValue) {
        const borderTypeCodes: { [key: string]: string } = {
          'with_border': 'СБОРТ',
          'without_border': 'БЕЗБОРТ'
        };
        
        const borderTypeName = borderTypeValue.toLowerCase();
        let borderTypeCode = '';
        
        // Ищем предопределенный код
        for (const [key, code] of Object.entries(borderTypeCodes)) {
          if (borderTypeName.includes(key)) {
            borderTypeCode = code;
            break;
          }
        }
        
        // Если нет предопределенного, берем первые 3-4 буквы для понятности
        if (!borderTypeCode) {
          const firstWord = borderTypeValue
            .replace(/[^а-яёa-z\s]/gi, '')
            .split(' ')[0];
          borderTypeCode = firstWord.length <= 4 ? firstWord.toUpperCase() : firstWord.slice(0, 4).toUpperCase();
        }
        
        if (borderTypeCode) {
          article += `-${borderTypeCode}`;
        }
      }

      // 14. Цена
      const price = form.getFieldValue('price');
      if (price) {
        article += `-${price}₽`;
      }

      // 15. Норма остатка
      const normStock = form.getFieldValue('normStock');
      if (normStock) {
        article += `-${normStock} шт`;
      }

      // 16. Начальный остаток
      const initialStock = form.getFieldValue('initialStock');
      if (initialStock) {
        article += `-${initialStock} шт`;
      }

      // 17. Примечания
      const notes = form.getFieldValue('notes');
      if (notes) {
        article += `-${notes}`;
      }
    }
  };

  return (
    <Modal
      title="Создание товара"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Отмена
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
          Создать
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {/* ... (остальные поля формы остаются без изменений) */}
      </Form>
    </Modal>
  );
};

export default CreateProductModal;