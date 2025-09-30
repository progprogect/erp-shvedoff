import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Row,
  Col,
  DatePicker,
  InputNumber,
  Radio,
  Switch,
  Input,
  Alert,
  Space,
  Button,
  Typography,
  Tooltip,
  Spin
} from 'antd';
import {
  InfoCircleOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  WarningOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  getOptimalPlanningSuggestions,
  checkPlanningOverlaps,
  OptimalPlanningSuggestion,
  PlanningOverlapsResponse,
  OverlapInfo,
  AlternativeDateSuggestion
} from '../services/productionApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

export type PlanningMode = 'flexible' | 'strict' | 'duration';

interface ProductionPlanningFormProps {
  productId?: number;
  quantity?: number;
  initialValues?: {
    plannedStartDate?: string;
    plannedEndDate?: string;
    estimatedDurationDays?: number;
    planningStatus?: 'draft' | 'confirmed' | 'started' | 'completed';
    isFlexible?: boolean;
    autoAdjustEndDate?: boolean;
    planningNotes?: string;
  };
  onValuesChange?: (values: any) => void;
  disabled?: boolean;
}

const ProductionPlanningForm: React.FC<ProductionPlanningFormProps> = ({
  productId,
  quantity,
  initialValues,
  onValuesChange,
  disabled = false
}) => {
  const [form] = Form.useForm();
  const [planningMode, setPlanningMode] = useState<PlanningMode>('flexible');
  const [suggestions, setSuggestions] = useState<OptimalPlanningSuggestion | null>(null);
  const [overlaps, setOverlaps] = useState<OverlapInfo[]>([]);
  const [alternativeSuggestions, setAlternativeSuggestions] = useState<AlternativeDateSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingOverlaps, setLoadingOverlaps] = useState(false);

  // Инициализация формы
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        plannedStartDate: initialValues.plannedStartDate ? dayjs(initialValues.plannedStartDate) : undefined,
        plannedEndDate: initialValues.plannedEndDate ? dayjs(initialValues.plannedEndDate) : undefined,
      });

      // Определяем режим планирования на основе начальных значений
      if (initialValues.plannedStartDate && initialValues.plannedEndDate) {
        setPlanningMode('strict');
      } else if (initialValues.estimatedDurationDays) {
        setPlanningMode('duration');
      } else {
        setPlanningMode('flexible');
      }
    }
  }, [initialValues, form]);

  // Загрузка предложений при изменении товара или количества
  useEffect(() => {
    if (productId && quantity && quantity > 0) {
      loadSuggestions();
    }
  }, [productId, quantity]);

  // Загрузка предложений оптимального планирования
  const loadSuggestions = async () => {
    if (!productId || !quantity) return;

    try {
      setLoadingSuggestions(true);
      const suggestion = await getOptimalPlanningSuggestions(productId, quantity);
      setSuggestions(suggestion);
    } catch (error) {
      console.error('Ошибка загрузки предложений:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Проверка перекрытий при изменении дат
  const checkOverlaps = async (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) {
      setOverlaps([]);
      setAlternativeSuggestions([]);
      return;
    }

    try {
      setLoadingOverlaps(true);
      const result: PlanningOverlapsResponse = await checkPlanningOverlaps(startDate, endDate);
      setOverlaps(result.overlaps);
      setAlternativeSuggestions(result.suggestions);
    } catch (error) {
      console.error('Ошибка проверки перекрытий:', error);
      setOverlaps([]);
      setAlternativeSuggestions([]);
    } finally {
      setLoadingOverlaps(false);
    }
  };

  // Обработка изменения значений формы
  const handleValuesChange = (changedValues: any, allValues: any) => {
    // Проверяем перекрытия при изменении дат
    if (changedValues.plannedStartDate || changedValues.plannedEndDate) {
      const startDate = allValues.plannedStartDate?.format('YYYY-MM-DD');
      const endDate = allValues.plannedEndDate?.format('YYYY-MM-DD');
      if (startDate && endDate) {
        checkOverlaps(startDate, endDate);
      } else {
        setOverlaps([]);
        setAlternativeSuggestions([]);
      }
    }

    // Автоматический расчет длительности
    if (changedValues.plannedStartDate && changedValues.plannedEndDate) {
      const start = dayjs(allValues.plannedStartDate);
      const end = dayjs(allValues.plannedEndDate);
      const duration = end.diff(start, 'day') + 1;
      form.setFieldsValue({ estimatedDurationDays: duration });
    }

    // Автоматическая коррекция даты завершения
    if (changedValues.plannedStartDate && allValues.autoAdjustEndDate && allValues.estimatedDurationDays) {
      const start = dayjs(allValues.plannedStartDate);
      const end = start.add(allValues.estimatedDurationDays - 1, 'day');
      form.setFieldsValue({ plannedEndDate: end });
    }

    if (onValuesChange) {
      onValuesChange(allValues);
    }
  };

  // Применение предложения
  const applySuggestion = () => {
    if (!suggestions) return;

    form.setFieldsValue({
      estimatedDurationDays: suggestions.suggestedDuration,
      plannedStartDate: suggestions.suggestedStartDate ? dayjs(suggestions.suggestedStartDate) : undefined,
      planningStatus: 'draft',
      isFlexible: true
    });

    if (suggestions.suggestedStartDate) {
      setPlanningMode('flexible');
    } else {
      setPlanningMode('duration');
    }
  };

  // Применение альтернативного предложения
  const applyAlternativeSuggestion = (suggestion: AlternativeDateSuggestion) => {
    form.setFieldsValue({
      plannedStartDate: dayjs(suggestion.startDate),
      plannedEndDate: dayjs(suggestion.endDate)
    });
    setPlanningMode('strict');
  };

  return (
    <Card 
      title={
        <Space>
          <CalendarOutlined />
          Планирование производства
        </Space>
      }
      size="small"
    >
      {/* Режимы планирования */}
      <Form.Item label="Режим планирования">
        <Radio.Group 
          value={planningMode} 
          onChange={(e) => setPlanningMode(e.target.value)}
          disabled={disabled}
        >
          <Radio value="flexible">
            <Space>
              Гибкое планирование
              <Tooltip title="Указывается только дата начала, дата завершения определится автоматически">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          </Radio>
          <Radio value="strict">
            <Space>
              Строгое планирование
              <Tooltip title="Указывается четкий период от начала до завершения">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          </Radio>
          <Radio value="duration">
            <Space>
              По длительности
              <Tooltip title="Указывается только длительность, даты определятся позже">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          </Radio>
        </Radio.Group>
      </Form.Item>

      {/* Умные предложения */}
      {suggestions && (
        <Alert
          message={
            <Space>
              <BulbOutlined />
              <Text strong>Умное предложение</Text>
            </Space>
          }
          description={
            <div>
              <Text>{suggestions.reasoning}</Text>
              <br />
              <Text type="secondary">
                Предлагаемая длительность: {suggestions.suggestedDuration} дней
                {suggestions.suggestedStartDate && `, дата начала: ${dayjs(suggestions.suggestedStartDate).format('DD.MM.YYYY')}`}
              </Text>
              <br />
              <Text type="secondary">
                Уверенность: {Math.round(suggestions.confidence * 100)}%
              </Text>
            </div>
          }
          type="info"
          showIcon
          action={
            <Button 
              size="small" 
              onClick={applySuggestion}
              disabled={disabled}
            >
              Применить
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Поля планирования */}
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        disabled={disabled}
      >
        <Row gutter={16}>
          {(planningMode === 'flexible' || planningMode === 'strict') && (
            <Col span={12}>
              <Form.Item
                name="plannedStartDate"
                label="Дата начала производства"
                help="Когда планируется начать производство"
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="Выберите дату начала"
                  format="DD.MM.YYYY"
                  disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
                />
              </Form.Item>
            </Col>
          )}
          
          {planningMode === 'strict' && (
            <Col span={12}>
              <Form.Item
                name="plannedEndDate"
                label="Дата завершения производства"
                help="Когда планируется завершить производство"
                dependencies={['plannedStartDate']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('plannedStartDate');
                      if (startDate && value && value.isBefore(startDate)) {
                        return Promise.reject('Дата завершения должна быть позже даты начала');
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="Выберите дату завершения"
                  format="DD.MM.YYYY"
                  disabledDate={(current) => {
                    const startDate = form.getFieldValue('plannedStartDate');
                    return current && startDate && current.isBefore(startDate);
                  }}
                />
              </Form.Item>
            </Col>
          )}
          
          {(planningMode === 'duration' || planningMode === 'flexible') && (
            <Col span={12}>
              <Form.Item
                name="estimatedDurationDays"
                label="Планируемая длительность (дни)"
                help="Сколько дней займет производство"
              >
                <InputNumber
                  min={1}
                  max={30}
                  style={{ width: '100%' }}
                  placeholder="Количество дней"
                />
              </Form.Item>
            </Col>
          )}
        </Row>

        {/* Дополнительные настройки */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="planningStatus"
              label="Статус планирования"
              initialValue="draft"
            >
              <Radio.Group>
                <Radio value="draft">Черновик</Radio>
                <Radio value="confirmed">Подтверждено</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="isFlexible"
              label="Гибкое планирование"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch 
                checkedChildren="Включено" 
                unCheckedChildren="Отключено"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="autoAdjustEndDate"
          label="Автоматическая коррекция даты завершения"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch 
            checkedChildren="Включено" 
            unCheckedChildren="Отключено"
          />
        </Form.Item>

        <Form.Item
          name="planningNotes"
          label="Заметки по планированию"
        >
          <TextArea 
            rows={3} 
            placeholder="Дополнительная информация о планировании..."
          />
        </Form.Item>
      </Form>

      {/* Предупреждения о перекрытиях */}
      {overlaps.length > 0 && (
        <Alert
          message={
            <Space>
              <WarningOutlined />
              <Text strong>Обнаружены перекрытия</Text>
            </Space>
          }
          description={
            <div>
              <Text>Перекрытие с заданиями:</Text>
              <ul style={{ margin: '8px 0' }}>
                {overlaps.map((overlap, index) => (
                  <li key={index}>
                    {overlap.productName} ({overlap.overlapDays} дней)
                  </li>
                ))}
              </ul>
              
              {alternativeSuggestions.length > 0 && (
                <div>
                  <Text strong>Альтернативные варианты:</Text>
                  <Space wrap style={{ marginTop: 8 }}>
                    {alternativeSuggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        size="small"
                        onClick={() => applyAlternativeSuggestion(suggestion)}
                        disabled={disabled}
                      >
                        {dayjs(suggestion.startDate).format('DD.MM')} - {dayjs(suggestion.endDate).format('DD.MM')}
                      </Button>
                    ))}
                  </Space>
                </div>
              )}
            </div>
          }
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {/* Индикаторы загрузки */}
      {(loadingSuggestions || loadingOverlaps) && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {loadingSuggestions ? 'Загрузка предложений...' : 'Проверка перекрытий...'}
          </Text>
        </div>
      )}
    </Card>
  );
};

export default ProductionPlanningForm;
