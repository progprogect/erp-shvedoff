import express from 'express';
import { db, schema } from '../db';
import { eq, like, isNull, and, sql } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// GET /api/catalog/categories - Get categories tree
router.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const categories = await db.query.categories.findMany({
      with: {
        children: true,
        products: {
          with: {
            stock: true
          }
        }
      },
      orderBy: [schema.categories.sortOrder, schema.categories.name]
    });

    // Build tree structure
    const rootCategories = categories.filter(cat => !cat.parentId);
    
    res.json({
      success: true,
      data: rootCategories
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/catalog/categories - Create category
router.post('/categories', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const { name, parentId, description } = req.body;

    if (!name) {
      return next(createError('Category name is required', 400));
    }

    const newCategory = await db.insert(schema.categories).values({
      name,
      parentId: parentId || null,
      description,
      path: parentId ? `${parentId}.` : null
    }).returning();

    res.status(201).json({
      success: true,
      data: newCategory[0]
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/catalog/products - Get products with search and filters
router.get('/products', authenticateToken, async (req, res, next) => {
  try {
    const { 
      search, 
      categoryId, 
      limit = 50, 
      offset = 0,
      stockStatus // 'in_stock', 'low_stock', 'out_of_stock'
    } = req.query;

    let whereConditions = [];

    if (search) {
      whereConditions.push(
        like(schema.products.name, `%${search}%`)
      );
    }

    if (categoryId) {
      whereConditions.push(
        eq(schema.products.categoryId, Number(categoryId))
      );
    }

    whereConditions.push(eq(schema.products.isActive, true));

    const products = await db.query.products.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        category: true,
        stock: true
      },
      limit: Number(limit),
      offset: Number(offset),
      orderBy: schema.products.name
    });

    // Filter by stock status if requested
    let filteredProducts = products;
    if (stockStatus) {
      filteredProducts = products.filter(product => {
        if (!product.stock) return stockStatus === 'out_of_stock';
        
        const available = product.stock.currentStock - product.stock.reservedStock;
        const norm = product.normStock || 0;
        
        switch (stockStatus) {
          case 'out_of_stock':
            return available <= 0;
          case 'low_stock':
            return available > 0 && available < norm * 0.5;
          case 'in_stock':
            return available >= norm * 0.5;
          default:
            return true;
        }
      });
    }

    res.json({
      success: true,
      data: filteredProducts,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: filteredProducts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/catalog/products/:id - Get product details
router.get('/products/:id', authenticateToken, async (req, res, next) => {
  try {
    const productId = Number(req.params.id);

    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      with: {
        category: true,
        manager: {
          columns: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        },
        stock: true,
        stockMovements: {
          with: {
            user: {
              columns: {
                passwordHash: false
              }
            }
          },
          orderBy: sql`${schema.stockMovements.createdAt} DESC`,
          limit: 10
        }
      }
    });

    if (!product) {
      return next(createError('Product not found', 404));
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/catalog/products - Create product
router.post('/products', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      name, 
      article, 
      categoryId, 
      dimensions, 
      characteristics, 
      tags, 
      price, 
      costPrice, 
      normStock, 
      notes 
    } = req.body;

    if (!name || !categoryId) {
      return next(createError('Product name and category are required', 400));
    }

    const newProduct = await db.insert(schema.products).values({
      name,
      article,
      categoryId,
      dimensions,
      characteristics,
      tags,
      price,
      costPrice,
      normStock,
      notes
    }).returning();

    // Create initial stock record
    await db.insert(schema.stock).values({
      productId: newProduct[0].id,
      currentStock: 0,
      reservedStock: 0
    });

    res.status(201).json({
      success: true,
      data: newProduct[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/catalog/products/:id - Update product
router.put('/products/:id', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.id);
    const updateData = req.body;

    const updatedProduct = await db.update(schema.products)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(schema.products.id, productId))
      .returning();

    if (!updatedProduct.length) {
      return next(createError('Product not found', 404));
    }

    res.json({
      success: true,
      data: updatedProduct[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router; 