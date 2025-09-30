import { db, schema } from '../db';
import { eq, and, or, gte, lte, ne, isNotNull } from 'drizzle-orm';

// Интерфейсы для планирования
export interface ProductionPlanningData {
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  estimatedDurationDays?: number | null;
}

export interface PlanningValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface OverlapInfo {
  taskId: number;
  productName: string;
  overlapDays: number;
  startDate: string;
  endDate: string;
}

export interface AlternativeDateSuggestion {
  startDate: string;
  endDate: string;
  reason: string;
  confidence: number; // 0-1
}

// Валидация планирования производства
export function validateProductionPlanning(data: ProductionPlanningData): PlanningValidationResult {
  const { plannedStartDate, plannedEndDate } = data;
  
  // Правило 1: Обязательны обе даты
  if (!plannedStartDate || !plannedEndDate) {
    return {
      valid: false,
      error: 'Необходимо указать дату начала и дату завершения производства'
    };
  }
  
  // Правило 2: Дата завершения должна быть не раньше даты начала (может быть одинаковой)
  const start = new Date(plannedStartDate);
  const end = new Date(plannedEndDate);
  
  if (end < start) {
    return {
      valid: false,
      error: 'Дата завершения не может быть раньше даты начала'
    };
  }
  
  // Правило 3: Проверка на разумность периода (максимум 30 дней)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  if (diffDays > 30) {
    return {
      valid: true,
      warnings: ['Период планирования превышает 30 дней. Рекомендуется разбить на более мелкие задания.']
    };
  }
  
  return { valid: true };
}

// Проверка перекрытий с существующими заданиями
export async function checkProductionOverlaps(
  excludeTaskId: number | null,
  plannedStartDate: string,
  plannedEndDate: string
): Promise<OverlapInfo[]> {
  try {
    const startDate = new Date(plannedStartDate);
    const endDate = new Date(plannedEndDate);
    
    // Получаем задания, которые могут перекрываться
    const overlappingTasks = await db
      .select({
        id: schema.productionTasks.id,
        productName: schema.products.name,
        plannedStartDate: schema.productionTasks.plannedStartDate,
        plannedEndDate: schema.productionTasks.plannedEndDate
      })
      .from(schema.productionTasks)
      .innerJoin(schema.products, eq(schema.productionTasks.productId, schema.products.id))
      .where(
        and(
          excludeTaskId ? ne(schema.productionTasks.id, excludeTaskId) : undefined,
          // Задание активно (не завершено и не отменено)
          or(
            eq(schema.productionTasks.status, 'pending'),
            eq(schema.productionTasks.status, 'in_progress'),
            eq(schema.productionTasks.status, 'paused')
          ),
          // Есть планирование
          isNotNull(schema.productionTasks.plannedStartDate),
          isNotNull(schema.productionTasks.plannedEndDate),
          // Перекрытие дат
          or(
            // Новое задание начинается внутри существующего
            and(
              gte(schema.productionTasks.plannedStartDate, startDate),
              lte(schema.productionTasks.plannedStartDate, endDate)
            ),
            // Новое задание заканчивается внутри существующего
            and(
              gte(schema.productionTasks.plannedEndDate, startDate),
              lte(schema.productionTasks.plannedEndDate, endDate)
            ),
            // Новое задание полностью охватывает существующее
            and(
              lte(schema.productionTasks.plannedStartDate, startDate),
              gte(schema.productionTasks.plannedEndDate, endDate)
            )
          )
        )
      );
    
    // Вычисляем дни перекрытия для каждого задания
    const overlaps: OverlapInfo[] = overlappingTasks.map(task => {
      const taskStart = new Date(task.plannedStartDate!);
      const taskEnd = new Date(task.plannedEndDate!);
      
      // Вычисляем пересечение периодов
      const overlapStart = new Date(Math.max(startDate.getTime(), taskStart.getTime()));
      const overlapEnd = new Date(Math.min(endDate.getTime(), taskEnd.getTime()));
      
      const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      return {
        taskId: task.id,
        productName: task.productName,
        overlapDays,
        startDate: taskStart.toISOString().split('T')[0],
        endDate: taskEnd.toISOString().split('T')[0]
      };
    });
    
    return overlaps;
  } catch (error) {
    console.error('Ошибка проверки перекрытий:', error);
    return [];
  }
}

// Предложения альтернативных дат
export async function suggestAlternativeDates(
  plannedStartDate: string,
  plannedEndDate: string,
  maxSuggestions: number = 3
): Promise<AlternativeDateSuggestion[]> {
  try {
    const startDate = new Date(plannedStartDate);
    const endDate = new Date(plannedEndDate);
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const suggestions: AlternativeDateSuggestion[] = [];
    
    // Вариант 1: Сдвиг на 1 день вперед
    const nextDayStart = new Date(startDate);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    const nextDayEnd = new Date(nextDayStart);
    nextDayEnd.setDate(nextDayEnd.getDate() + duration - 1);
    
    const nextDayOverlaps = await checkProductionOverlaps(null, nextDayStart.toISOString().split('T')[0], nextDayEnd.toISOString().split('T')[0]);
    if (nextDayOverlaps.length === 0) {
      suggestions.push({
        startDate: nextDayStart.toISOString().split('T')[0],
        endDate: nextDayEnd.toISOString().split('T')[0],
        reason: 'Сдвиг на 1 день вперед',
        confidence: 0.9
      });
    }
    
    // Вариант 2: Сдвиг на 1 день назад
    const prevDayStart = new Date(startDate);
    prevDayStart.setDate(prevDayStart.getDate() - 1);
    const prevDayEnd = new Date(prevDayStart);
    prevDayEnd.setDate(prevDayEnd.getDate() + duration - 1);
    
    const prevDayOverlaps = await checkProductionOverlaps(null, prevDayStart.toISOString().split('T')[0], prevDayEnd.toISOString().split('T')[0]);
    if (prevDayOverlaps.length === 0) {
      suggestions.push({
        startDate: prevDayStart.toISOString().split('T')[0],
        endDate: prevDayEnd.toISOString().split('T')[0],
        reason: 'Сдвиг на 1 день назад',
        confidence: 0.8
      });
    }
    
    // Вариант 3: Поиск ближайшего свободного периода
    const freeSlots = await findFreeTimeSlots(duration, 7); // ищем в ближайшие 7 дней
    freeSlots.forEach(slot => {
      if (suggestions.length < maxSuggestions) {
        suggestions.push({
          startDate: slot.startDate,
          endDate: slot.endDate,
          reason: `Свободный период (${slot.daysAhead} дней вперед)`,
          confidence: 0.7
        });
      }
    });
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, maxSuggestions);
  } catch (error) {
    console.error('Ошибка генерации предложений:', error);
    return [];
  }
}

// Поиск свободных временных слотов
export async function findFreeTimeSlots(
  duration: number,
  searchDays: number = 14
): Promise<Array<{ startDate: string; endDate: string; daysAhead: number }>> {
  try {
    const today = new Date();
    const slots: Array<{ startDate: string; endDate: string; daysAhead: number }> = [];
    
    for (let daysAhead = 1; daysAhead <= searchDays; daysAhead++) {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + daysAhead);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration - 1);
      
      // Проверяем, нет ли перекрытий
      const overlaps = await checkProductionOverlaps(
        null,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      if (overlaps.length === 0) {
        slots.push({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          daysAhead
        });
      }
    }
    
    return slots;
  } catch (error) {
    console.error('Ошибка поиска свободных слотов:', error);
    return [];
  }
}

// Автоматическое планирование на основе похожих заданий
export async function suggestOptimalPlanning(
  productId: number,
  quantity: number
): Promise<{
  suggestedStartDate?: string;
  suggestedDuration: number;
  confidence: number;
  reasoning: string;
}> {
  try {
    // Получаем похожие задания (по тому же товару)
    const similarTasks = await db
      .select({
        estimatedDurationDays: schema.productionTasks.estimatedDurationDays,
        plannedStartDate: schema.productionTasks.plannedStartDate,
        plannedEndDate: schema.productionTasks.plannedEndDate,
        requestedQuantity: schema.productionTasks.requestedQuantity
      })
      .from(schema.productionTasks)
      .where(
        and(
          eq(schema.productionTasks.productId, productId),
          eq(schema.productionTasks.status, 'completed'),
          isNotNull(schema.productionTasks.estimatedDurationDays)
        )
      )
      .orderBy(schema.productionTasks.completedAt)
      .limit(10);
    
    if (similarTasks.length === 0) {
      return {
        suggestedDuration: 1,
        confidence: 0.3,
        reasoning: 'Нет данных о похожих заданиях, предполагаем 1 день'
      };
    }
    
    // Вычисляем среднюю длительность
    const avgDuration = similarTasks.reduce((sum, task) => sum + (task.estimatedDurationDays || 1), 0) / similarTasks.length;
    
    // Корректируем длительность в зависимости от количества
    const avgQuantity = similarTasks.reduce((sum, task) => sum + task.requestedQuantity, 0) / similarTasks.length;
    const quantityRatio = quantity / avgQuantity;
    const adjustedDuration = Math.ceil(avgDuration * Math.sqrt(quantityRatio)); // квадратный корень для более мягкой корректировки
    
    // Ищем ближайший свободный период
    const freeSlots = await findFreeTimeSlots(adjustedDuration, 14);
    
    return {
      suggestedStartDate: freeSlots[0]?.startDate,
      suggestedDuration: adjustedDuration,
      confidence: Math.min(0.9, 0.5 + (similarTasks.length / 10) * 0.4),
      reasoning: `На основе ${similarTasks.length} похожих заданий (средняя длительность: ${avgDuration.toFixed(1)} дней)`
    };
  } catch (error) {
    console.error('Ошибка автоматического планирования:', error);
    return {
      suggestedDuration: 1,
      confidence: 0.1,
      reasoning: 'Ошибка при анализе похожих заданий'
    };
  }
}
