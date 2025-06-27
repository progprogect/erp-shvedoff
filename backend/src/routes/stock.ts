import express from 'express';
import { db, schema } from '../db';
import { eq, sql, and } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// GET /api/stock - Get current stock levels
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, categoryId, search } = req.query;

    const stockData = await db
      .select({
        id: schema.stock.id,
        productId: schema.stock.productId,
        currentStock: schema.stock.currentStock,
        reservedStock: schema.stock.reservedStock,
        availableStock: sql<number>`${schema.stock.currentStock} - ${schema.stock.reservedStock}`,
        updatedAt: schema.stock.updatedAt,
        productName: schema.products.name,
        productArticle: schema.products.article,
        categoryName: schema.categories.name,
        normStock: schema.products.normStock,
        price: schema.products.price
      })
      .from(schema.stock)
      .innerJoin(schema.products, eq(schema.stock.productId, schema.products.id))
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(eq(schema.products.isActive, true))
      .orderBy(schema.products.name);

    // Apply filters
    let filteredData = stockData;
    
    if (status) {
      filteredData = stockData.filter(item => {
        const available = item.currentStock - item.reservedStock;
        const norm = item.normStock || 0;
        
        switch (status) {
          case 'critical':
            return available <= 0;
          case 'low':
            return available > 0 && available < norm * 0.5;
          case 'normal':
            return available >= norm * 0.5;
          default:
            return true;
        }
      });
    }

    res.json({
      success: true,
      data: filteredData
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/adjust - Manual stock adjustment
router.post('/adjust', authenticateToken, authorizeRoles('director', 'warehouse'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, comment } = req.body;
    const userId = req.user!.id;

    if (!productId || quantity === undefined) {
      return next(createError('Product ID and quantity are required', 400));
    }

    // Get current stock
    const currentStock = await db.query.stock.findFirst({
      where: eq(schema.stock.productId, productId)
    });

    if (!currentStock) {
      return next(createError('Stock record not found', 404));
    }

    const newStock = currentStock.currentStock + quantity;
    if (newStock < 0) {
      return next(createError('Insufficient stock for adjustment', 400));
    }

    // Update stock
    await db.update(schema.stock)
      .set({
        currentStock: newStock,
        updatedAt: new Date()
      })
      .where(eq(schema.stock.productId, productId));

    // Log movement
    await db.insert(schema.stockMovements).values({
      productId,
      movementType: 'adjustment',
      quantity,
      comment,
      userId
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      newStock
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/movements/:productId - Get stock movement history
router.get('/movements/:productId', authenticateToken, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const { limit = 50, offset = 0 } = req.query;

    const movements = await db.query.stockMovements.findMany({
      where: eq(schema.stockMovements.productId, productId),
      with: {
        user: {
          columns: {
            passwordHash: false
          }
        }
      },
      orderBy: sql`${schema.stockMovements.createdAt} DESC`,
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/reserve - Reserve stock for order
router.post('/reserve', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, orderId } = req.body;
    const userId = req.user!.id;

    if (!productId || !quantity || !orderId) {
      return next(createError('Product ID, quantity, and order ID are required', 400));
    }

    // Get current stock
    const currentStock = await db.query.stock.findFirst({
      where: eq(schema.stock.productId, productId)
    });

    if (!currentStock) {
      return next(createError('Stock record not found', 404));
    }

    const availableStock = currentStock.currentStock - currentStock.reservedStock;
    if (availableStock < quantity) {
      return next(createError(`Insufficient stock. Available: ${availableStock}`, 400));
    }

    // Reserve stock
    await db.update(schema.stock)
      .set({
        reservedStock: currentStock.reservedStock + quantity,
        updatedAt: new Date()
      })
      .where(eq(schema.stock.productId, productId));

    // Log movement
    await db.insert(schema.stockMovements).values({
      productId,
      movementType: 'reservation',
      quantity,
      referenceId: orderId,
      referenceType: 'order',
      userId
    });

    res.json({
      success: true,
      message: 'Stock reserved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/release - Release reserved stock
router.post('/release', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, orderId } = req.body;
    const userId = req.user!.id;

    // Get current stock
    const currentStock = await db.query.stock.findFirst({
      where: eq(schema.stock.productId, productId)
    });

    if (!currentStock) {
      return next(createError('Stock record not found', 404));
    }

    if (currentStock.reservedStock < quantity) {
      return next(createError('Cannot release more than reserved', 400));
    }

    // Release stock
    await db.update(schema.stock)
      .set({
        reservedStock: currentStock.reservedStock - quantity,
        updatedAt: new Date()
      })
      .where(eq(schema.stock.productId, productId));

    // Log movement
    await db.insert(schema.stockMovements).values({
      productId,
      movementType: 'release_reservation',
      quantity: -quantity,
      referenceId: orderId,
      referenceType: 'order',
      userId
    });

    res.json({
      success: true,
      message: 'Stock reservation released successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 