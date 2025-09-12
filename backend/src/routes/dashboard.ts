import { Router } from 'express';
import { db } from '../db';
import { orders, orderItems, stock, products, shipments, users, shipmentOrders } from '../db/schema';
import { eq, desc, gte, sql, and } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/dashboard
 * Получение всех метрик для дашборда
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Параллельно выполняем все запросы для оптимизации производительности
    const [
      orderStats,
      criticalStock,
      urgentOrders,
      todayShipments,
      totalMetrics
    ] = await Promise.all([
      // 1. Статистика заказов по статусам
      db.select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`sum(total_amount)::numeric`
      })
      .from(orders)
      .where(sql`status != 'cancelled'`)
      .groupBy(orders.status),

      // 2. Критичные остатки (топ-10)
      db.select({
        productId: products.id,
        productName: products.name,
        article: products.article,
        currentStock: stock.currentStock,
        reservedStock: stock.reservedStock,
        normStock: products.normStock,
        availableStock: sql<number>`(${stock.currentStock} - ${stock.reservedStock})`
      })
      .from(stock)
      .innerJoin(products, eq(stock.productId, products.id))
      .where(
        and(
          sql`(${stock.currentStock} - ${stock.reservedStock}) <= COALESCE(${products.normStock}, 0)`,
          eq(products.isActive, true)
        )
      )
      .orderBy(sql`(${stock.currentStock} - ${stock.reservedStock})`)
      .limit(10),

      // 3. Срочные заказы (приоритет high/urgent)
      db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        priority: orders.priority,
        status: orders.status,
        deliveryDate: orders.deliveryDate,
        totalAmount: orders.totalAmount,
        managerName: users.fullName,
        itemsCount: sql<number>`count(${orderItems.id})::int`
      })
      .from(orders)
      .leftJoin(users, eq(orders.managerId, users.id))
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        and(
          sql`${orders.priority} IN ('high', 'urgent')`,
          sql`${orders.status} IN ('new', 'confirmed', 'in_production')`
        )
      )
      .groupBy(orders.id, users.fullName)
      .orderBy(desc(orders.priority), orders.deliveryDate),

      // 4. Отгрузки за сегодня
      db.select({
        id: shipments.id,
        shipmentNumber: shipments.shipmentNumber,
        status: shipments.status,
        actualDate: shipments.actualDate,
        plannedDate: shipments.plannedDate,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName
      })
      .from(shipments)
      .leftJoin(shipmentOrders, eq(shipments.id, shipmentOrders.shipmentId))
      .leftJoin(orders, eq(shipmentOrders.orderId, orders.id))
      .where(
        gte(shipments.createdAt, today)
      )
      .orderBy(desc(shipments.createdAt)),

      // 5. Общие метрики
      db.select({
        totalOrders: sql<number>`count(*)::int`,
        totalAmount: sql<number>`sum(total_amount)::numeric`,
        avgOrderAmount: sql<number>`avg(total_amount)::numeric`
      })
      .from(orders)
      .where(sql`status != 'cancelled'`)
    ]);

    // Подсчет дополнительных метрик
    const [stockSummary] = await db.select({
      totalProducts: sql<number>`count(*)::int`,
      lowStockCount: sql<number>`count(*) filter (where (current_stock - reserved_stock) <= COALESCE(norm_stock, 0) and (current_stock - reserved_stock) > 0)::int`,
      outOfStockCount: sql<number>`count(*) filter (where (current_stock - reserved_stock) <= 0)::int`,
      normalStockCount: sql<number>`count(*) filter (where (current_stock - reserved_stock) > COALESCE(norm_stock, 0))::int`
    })
    .from(stock)
    .innerJoin(products, eq(stock.productId, products.id))
    .where(eq(products.isActive, true));

    // Форматируем статистику заказов по статусам
    const orderStatsByStatus = {
      new: 0,
      confirmed: 0,
      in_production: 0,
      ready: 0,
      completed: 0,
      total: 0,
      totalAmount: 0
    };

    orderStats.forEach((stat: any) => {
      if (stat.status && stat.status !== 'cancelled') {
        orderStatsByStatus[stat.status as keyof typeof orderStatsByStatus] = Number(stat.count);
        orderStatsByStatus.total += Number(stat.count);
        orderStatsByStatus.totalAmount += Number(stat.totalAmount || 0);
      }
    });

    const response = {
      // Статистика заказов
      orderStats: orderStatsByStatus,

      // Статистика остатков
      stockStats: {
        total: stockSummary?.totalProducts || 0,
        normal: stockSummary?.normalStockCount || 0,
        low: stockSummary?.lowStockCount || 0,
        critical: stockSummary?.outOfStockCount || 0
      },

      // Критичные остатки (топ-10)
      criticalStock: criticalStock.map((item: any) => ({
        ...item,
        availableStock: Number(item.availableStock),
        currentStock: Number(item.currentStock),
        reservedStock: Number(item.reservedStock),
        normStock: Number(item.normStock || 0)
      })),

      // Срочные заказы
      urgentOrders: urgentOrders.map((order: any) => ({
        ...order,
        totalAmount: Number(order.totalAmount || 0),
        itemsCount: Number(order.itemsCount)
      })),

      // Отгрузки за сегодня
      todayShipments: todayShipments,

      // Общие метрики
      totalMetrics: {
        totalOrders: Number(totalMetrics[0]?.totalOrders || 0),
        totalAmount: Number(totalMetrics[0]?.totalAmount || 0),
        avgOrderAmount: Number(totalMetrics[0]?.avgOrderAmount || 0)
      },

      // Время последнего обновления
      lastUpdated: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Dashboard error:', error);
    next(createError('Ошибка при получении данных дашборда', 500));
  }
});

/**
 * GET /api/dashboard/quick-stats
 * Быстрая статистика для мини-виджетов
 */
router.get('/quick-stats', authenticateToken, async (req, res, next) => {
  try {
    const [quickStats] = await db.select({
      activeOrders: sql<number>`count(*) filter (where status in ('new', 'confirmed', 'in_production', 'ready'))::int`,
      urgentOrders: sql<number>`count(*) filter (where priority in ('high', 'urgent') and status not in ('completed', 'cancelled'))::int`,
      criticalStock: sql<number>`(select count(*) from stock s join products p on s.product_id = p.id where p.is_active = true and (s.current_stock - s.reserved_stock) <= 0)::int`,
      lowStock: sql<number>`(select count(*) from stock s join products p on s.product_id = p.id where p.is_active = true and (s.current_stock - s.reserved_stock) <= COALESCE(p.norm_stock, 0) and (s.current_stock - s.reserved_stock) > 0)::int`
    })
    .from(orders);

    res.json({
      activeOrders: Number(quickStats?.activeOrders || 0),
      urgentOrders: Number(quickStats?.urgentOrders || 0),
      criticalStock: Number(quickStats?.criticalStock || 0),
      lowStock: Number(quickStats?.lowStock || 0),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Quick stats error:', error);
    next(createError('Ошибка при получении быстрой статистики', 500));
  }
});

export default router; 