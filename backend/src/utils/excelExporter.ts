import ExcelJS from 'exceljs';
import { Response } from 'express';

// Типы для поддержки разных форматов экспорта (Задача 3: Дополнительные форматы)
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  style?: any;
}

export interface ExportOptions {
  filename: string;
  sheetName: string;
  title: string;
  columns: ExcelColumn[];
  data: any[];
  format?: ExportFormat; // по умолчанию 'xlsx'
}

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  data: any[];
  title?: string;
}

/**
 * Утилита для экспорта данных в Excel формат
 * Задача 9.1 - Модуль экспорта в Excel
 */
export class ExcelExporter {
  /**
   * Универсальная функция экспорта данных в разных форматах (Задача 3: Дополнительные форматы)
   */
  static async exportData(res: Response, options: ExportOptions): Promise<void> {
    const format = options.format || 'xlsx';
    
    switch (format) {
      case 'xlsx':
        return this.exportToExcel(res, options);
      case 'csv':
        return this.exportToCSV(res, options);
      case 'pdf':
        throw new Error('PDF export not implemented yet');
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Создает и отправляет Excel файл клиенту
   */
  static async exportToExcel(res: Response, options: ExportOptions): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(options.sheetName);

      // Устанавливаем метаданные файла
      workbook.creator = 'ERP Shvedoff';
      workbook.lastModifiedBy = 'ERP Shvedoff';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Настраиваем колонки (заголовки будут первой строкой)
      worksheet.columns = options.columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
        style: col.style || {}
      }));

      // Стилизуем заголовки (первая строка)
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
      };

      // Добавляем данные (без дополнительных границ)
      options.data.forEach(item => {
        worksheet.addRow(item);
      });

      // Автоподбор ширины колонок
      worksheet.columns.forEach(column => {
        if (!column.width) {
          let maxLength = 0;
          column.eachCell!(cell => {
            const cellLength = cell.value ? cell.value.toString().length : 0;
            if (cellLength > maxLength) {
              maxLength = cellLength;
            }
          });
          column.width = Math.min(Math.max(maxLength + 2, 10), 50);
        }
      });

      // Устанавливаем заголовки HTTP для скачивания файла
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${options.filename}"`
      );

      // Записываем файл в response
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Excel export error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Ошибка при создании Excel файла'
        });
      }
    }
  }

  /**
   * Форматирует данные для экспорта каталога товаров
   */
  static formatCatalogData(products: any[]): any[] {
    return products.map(product => ({
      id: product.id,
      name: product.name,
      article: product.article || 'Не указан',
      category: product.categoryName || 'Без категории',
      surface: product.surfaceName || 'Не указана',
      material: product.materialName || 'Не указан',
      logo: product.logoName || 'Без логотипа',
      dimensions: product.dimensions 
        ? `${product.dimensions.length}×${product.dimensions.width}×${product.dimensions.thickness}`
        : 'Не указаны',
      matArea: product.matArea ? `${product.matArea} м²` : 'Не указана',
      weight: product.weight ? `${product.weight} кг` : 'Не указан',
      grade: product.grade === 'grade_2' ? '2 сорт' : 'Обычный',
      borderType: product.borderType === 'with_border' ? 'С бортом' : 
                  product.borderType === 'without_border' ? 'Без борта' : 'Не указан',
      price: product.price ? `${product.price} ₽` : 'Не указана',
      currentStock: product.currentStock || 0,
      reservedStock: product.reservedStock || 0,
      availableStock: (product.currentStock || 0) - (product.reservedStock || 0),
      notes: product.notes || ''
    }));
  }

  /**
   * Получает колонки для экспорта каталога
   */
  static getCatalogColumns(): ExcelColumn[] {
    return [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Название', key: 'name', width: 30 },
      { header: 'Артикул', key: 'article', width: 20 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Поверхность', key: 'surface', width: 15 },
      { header: 'Материал', key: 'material', width: 15 },
      { header: 'Логотип', key: 'logo', width: 15 },
      { header: 'Размеры (мм)', key: 'dimensions', width: 20 },
      { header: 'Площадь', key: 'matArea', width: 12 },
      { header: 'Вес', key: 'weight', width: 12 },
      { header: 'Сорт', key: 'grade', width: 12 },
      { header: 'Борт', key: 'borderType', width: 12 },
      { header: 'Цена', key: 'price', width: 15 },
      { header: 'Остаток', key: 'currentStock', width: 12 },
      { header: 'Резерв', key: 'reservedStock', width: 12 },
      { header: 'Доступно', key: 'availableStock', width: 12 },
      { header: 'Примечания', key: 'notes', width: 30 }
    ];
  }

  /**
   * Форматирует данные для экспорта заказов
   */
  static formatOrdersData(orders: any[]): any[] {
    return orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber || 'Не указан',
      createdAt: order.createdAt ? new Date(order.createdAt).toLocaleDateString('ru-RU') : 'Не указана',
      status: this.getOrderStatusText(order.status),
      priority: this.getPriorityText(order.priority),
      customerName: order.customerName || 'Не указан',
      customerContact: order.customerContact || 'Не указан',
      totalAmount: order.totalAmount ? `${order.totalAmount} ₽` : 'Не указана',
      totalItems: order.items?.length || 0,
      itemsDetails: order.items?.map((item: any) => 
        `${item.product?.name || 'Товар'} (${item.quantity} шт.)`
      ).join('; ') || 'Нет товаров',
      notes: order.notes || '',
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('ru-RU') : 'Не указана',
      manager: order.manager?.fullName || order.manager?.username || 'Не назначен'
    }));
  }

  /**
   * Получает колонки для экспорта заказов
   */
  static getOrdersColumns(): ExcelColumn[] {
    return [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Номер заказа', key: 'orderNumber', width: 15 },
      { header: 'Дата создания', key: 'createdAt', width: 15 },
      { header: 'Статус', key: 'status', width: 20 },
      { header: 'Приоритет', key: 'priority', width: 15 },
      { header: 'Клиент', key: 'customerName', width: 25 },
      { header: 'Контакт', key: 'customerContact', width: 20 },
      { header: 'Сумма заказа', key: 'totalAmount', width: 15 },
      { header: 'Кол-во позиций', key: 'totalItems', width: 15 },
      { header: 'Товары', key: 'itemsDetails', width: 50 },
      { header: 'Дата доставки', key: 'deliveryDate', width: 15 },
      { header: 'Менеджер', key: 'manager', width: 20 },
      { header: 'Примечания', key: 'notes', width: 30 }
    ];
  }

  /**
   * Получает текстовое представление статуса заказа
   */
  private static getOrderStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'new': 'Новый',
      'confirmed': 'Подтвержден',
      'in_production': 'В производстве',
      'ready': 'Готов',
      'completed': 'Завершен',
      'cancelled': 'Отменен'
    };
    return statusMap[status] || status;
  }

  /**
   * Получает текстовое представление приоритета
   */
  private static getPriorityText(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'low': 'Низкий',
      'normal': 'Обычный',
      'high': 'Высокий',
      'urgent': 'Срочный'
    };
    return priorityMap[priority] || priority;
  }

  /**
   * Получает текстовое представление источника заказа
   */
  private static getSourceText(source: string): string {
    const sourceMap: { [key: string]: string } = {
      'database': 'База данных',
      'website': 'Сайт',
      'avito': 'Авито',
      'referral': 'Рекомендация',
      'cold_call': 'Холодный звонок',
      'other': 'Другое'
    };
    return sourceMap[source] || source;
  }

  /**
   * Форматирует данные для экспорта производственных заданий
   */
  static formatProductionTasksData(tasks: any[]): any[] {
    return tasks.map(task => ({
      id: task.id,
      orderNumber: task.order?.orderNumber || 'Без заказа',
      productName: task.product?.name || 'Не указан',
      productArticle: task.product?.article || 'Не указан',
      requestedQuantity: task.requestedQuantity || 0,
      status: this.getProductionTaskStatusText(task.status),
      priority: task.priority || 1,
      sortOrder: task.sortOrder || 0,
      plannedDate: task.plannedDate ? new Date(task.plannedDate).toLocaleDateString('ru-RU') : 'Не указана',
      plannedStartTime: task.plannedStartTime || 'Не указано',
      createdAt: task.createdAt ? new Date(task.createdAt).toLocaleDateString('ru-RU') : 'Не указана',
      startedAt: task.startedAt ? new Date(task.startedAt).toLocaleDateString('ru-RU') + ' ' + new Date(task.startedAt).toLocaleTimeString('ru-RU') : 'Не указана',
      completedAt: task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') + ' ' + new Date(task.completedAt).toLocaleTimeString('ru-RU') : 'Не указана',
      producedQuantity: task.producedQuantity || 0,
      qualityQuantity: task.qualityQuantity || 0,
      defectQuantity: task.defectQuantity || 0,
      createdBy: task.createdByUser?.fullName || task.createdByUser?.username || 'Не указан',
      assignedTo: task.assignedToUser?.fullName || task.assignedToUser?.username || 'Не назначен',
      startedBy: task.startedByUser?.fullName || task.startedByUser?.username || 'Не указан',
      completedBy: task.completedByUser?.fullName || task.completedByUser?.username || 'Не указан',
      notes: task.notes || ''
    }));
  }

  /**
   * Получает колонки для экспорта производственных заданий
   */
  static getProductionTasksColumns(): ExcelColumn[] {
    return [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Номер заказа', key: 'orderNumber', width: 15 },
      { header: 'Товар', key: 'productName', width: 30 },
      { header: 'Артикул', key: 'productArticle', width: 20 },
      { header: 'Количество', key: 'requestedQuantity', width: 12 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Приоритет', key: 'priority', width: 10 },
      { header: 'Порядок', key: 'sortOrder', width: 10 },
      { header: 'План. дата', key: 'plannedDate', width: 15 },
      { header: 'План. время', key: 'plannedStartTime', width: 12 },
      { header: 'Создано', key: 'createdAt', width: 15 },
      { header: 'Начато', key: 'startedAt', width: 18 },
      { header: 'Завершено', key: 'completedAt', width: 18 },
      { header: 'Произведено', key: 'producedQuantity', width: 12 },
      { header: 'Годных', key: 'qualityQuantity', width: 10 },
      { header: 'Брак', key: 'defectQuantity', width: 8 },
      { header: 'Создал', key: 'createdBy', width: 20 },
      { header: 'Назначено', key: 'assignedTo', width: 20 },
      { header: 'Запустил', key: 'startedBy', width: 20 },
      { header: 'Завершил', key: 'completedBy', width: 20 },
      { header: 'Примечания', key: 'notes', width: 30 }
    ];
  }

  /**
   * Получает текстовое представление статуса производственного задания
   */
  private static getProductionTaskStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ожидает',
      'in_progress': 'В работе',
      'paused': 'На паузе',
      'completed': 'Завершено',
      'cancelled': 'Отменено'
    };
    return statusMap[status] || status;
  }

  /**
   * Форматирует данные для экспорта операций резки
   */
  static formatCuttingOperationsData(operations: any[]): any[] {
    return operations.map(operation => ({
      id: operation.id,
      sourceProduct: operation.sourceProduct?.name || 'Не указан',
      sourceArticle: operation.sourceProduct?.article || 'Не указан',
      targetProduct: operation.targetProduct?.name || 'Не указан',
      targetArticle: operation.targetProduct?.article || 'Не указан',
      sourceQuantity: operation.sourceQuantity || 0,
      targetQuantity: operation.targetQuantity || 0,
      wasteQuantity: operation.wasteQuantity || 0,
      actualSecondGradeQuantity: operation.actualSecondGradeQuantity || 0,
      efficiency: operation.sourceQuantity > 0 ? 
        Math.round((operation.targetQuantity / operation.sourceQuantity) * 100) + '%' : '0%',
      status: this.getCuttingOperationStatusText(operation.status),
      operator: operation.operator?.fullName || operation.operator?.username || 'Не указан',
      assignedTo: operation.assignedToUser?.fullName || operation.assignedToUser?.username || 'Не назначен',
      plannedDate: operation.plannedDate ? new Date(operation.plannedDate).toLocaleDateString('ru-RU') : 'Не указана',
      createdAt: operation.createdAt ? new Date(operation.createdAt).toLocaleDateString('ru-RU') : 'Не указана',
      completedAt: operation.completedAt ? new Date(operation.completedAt).toLocaleDateString('ru-RU') + ' ' + new Date(operation.completedAt).toLocaleTimeString('ru-RU') : 'Не завершена'
    }));
  }

  /**
   * Получает колонки для экспорта операций резки
   */
  static getCuttingOperationsColumns(): ExcelColumn[] {
    return [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Исходный товар', key: 'sourceProduct', width: 30 },
      { header: 'Исх. артикул', key: 'sourceArticle', width: 20 },
      { header: 'Целевой товар', key: 'targetProduct', width: 30 },
      { header: 'Цел. артикул', key: 'targetArticle', width: 20 },
      { header: 'Исх. кол-во', key: 'sourceQuantity', width: 12 },
      { header: 'Цел. кол-во', key: 'targetQuantity', width: 12 },
      { header: 'Брак', key: 'wasteQuantity', width: 10 },
      { header: 'Товар 2-го сорта', key: 'actualSecondGradeQuantity', width: 18 },
      { header: 'Эффективность', key: 'efficiency', width: 15 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Оператор', key: 'operator', width: 20 },
      { header: 'Назначено', key: 'assignedTo', width: 20 },
      { header: 'План. дата', key: 'plannedDate', width: 15 },
      { header: 'Создано', key: 'createdAt', width: 15 },
      { header: 'Завершено', key: 'completedAt', width: 18 }
    ];
  }

  /**
   * Получает текстовое представление статуса операции резки
   */
  private static getCuttingOperationStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'planned': 'Запланирована',
      'approved': 'Утверждена',
      'in_progress': 'В работе',
      'paused': 'На паузе',
      'completed': 'Завершена',
      'cancelled': 'Отменена'
    };
    return statusMap[status] || status;
  }

  /**
   * Форматирует данные для экспорта отгрузок
   */
  static formatShipmentsData(shipments: any[]): any[] {
    return shipments.map(shipment => ({
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber || 'Не указан',
      orderNumber: shipment.order?.orderNumber || 'Без заказа',
      customerName: shipment.order?.customerName || 'Не указан',
      status: this.getShipmentStatusText(shipment.status),
      plannedDate: shipment.plannedDate ? new Date(shipment.plannedDate).toLocaleDateString('ru-RU') : 'Не указана',
      actualDate: shipment.actualDate ? new Date(shipment.actualDate).toLocaleDateString('ru-RU') + ' ' + new Date(shipment.actualDate).toLocaleTimeString('ru-RU') : 'Не отгружена',
      transportInfo: shipment.transportInfo || 'Не указано',
      totalItems: shipment.items?.length || 0,
      itemsDetails: shipment.items?.map((item: any) => 
        `${item.product?.name || 'Товар'} (план: ${item.plannedQuantity} шт.${item.actualQuantity ? `, факт: ${item.actualQuantity} шт.` : ''})`
      ).join('; ') || 'Нет товаров',
      createdBy: shipment.createdByUser?.fullName || shipment.createdByUser?.username || 'Не указан',
      createdAt: shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString('ru-RU') : 'Не указана',
      hasDocuments: shipment.documentsPhotos?.length > 0 ? 'Да' : 'Нет'
    }));
  }

  /**
   * Получает колонки для экспорта отгрузок
   */
  static getShipmentsColumns(): ExcelColumn[] {
    return [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Номер отгрузки', key: 'shipmentNumber', width: 15 },
      { header: 'Номер заказа', key: 'orderNumber', width: 15 },
      { header: 'Клиент', key: 'customerName', width: 25 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'План. дата', key: 'plannedDate', width: 15 },
      { header: 'Факт. дата', key: 'actualDate', width: 18 },
      { header: 'Транспорт', key: 'transportInfo', width: 30 },
      { header: 'Кол-во позиций', key: 'totalItems', width: 15 },
      { header: 'Товары', key: 'itemsDetails', width: 50 },
      { header: 'Создал', key: 'createdBy', width: 20 },
      { header: 'Создано', key: 'createdAt', width: 15 },
      { header: 'Документы', key: 'hasDocuments', width: 12 }
    ];
  }

  /**
   * Получает текстовое представление статуса отгрузки
   */
  private static getShipmentStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ожидает',
      'completed': 'Завершена',
      'cancelled': 'Отменена',
      'paused': 'На паузе'
    };
    return statusMap[status] || status;
  }

  /**
   * Экспортирует данные в CSV файл (Задача 3: Дополнительные форматы)
   */
  static async exportToCSV(res: Response, options: ExportOptions): Promise<void> {
    try {
      // Создаем CSV заголовки
      const headers = options.columns.map(col => col.header);
      
      // Создаем CSV данные
      const csvData = options.data.map(item => {
        return options.columns.map(col => {
          const value = item[col.key];
          // Экранируем кавычки и переносы строк
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          // Если содержит запятую, кавычки или перенос строки - оборачиваем в кавычки
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',');
      });

      // Собираем полный CSV
      const csvContent = [
        headers.join(','),
        ...csvData
      ].join('\n');

      // Генерируем имя файла
      let filename = options.filename;
      if (!filename.endsWith('.csv')) {
        filename = filename.replace(/\.[^.]+$/, '.csv');
      }

      // Устанавливаем заголовки ответа
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

      // Отправляем CSV данные
      res.send(csvContent);

    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }
}