import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { db } from '../db';
import { carpetEdgeTypes } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Получить все типы края ковра
router.get('/', authenticateToken, async (req, res) => {
  try {
    const types = await db.select().from(carpetEdgeTypes).orderBy(carpetEdgeTypes.id);
    
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error('Ошибка получения типов края ковра:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения типов края ковра'
    });
  }
});

// Получить тип края ковра по ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const type = await db.select().from(carpetEdgeTypes).where(eq(carpetEdgeTypes.id, parseInt(id))).limit(1);
    
    if (type.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Тип края ковра не найден'
      });
    }
    
    return res.json({
      success: true,
      data: type[0]
    });
  } catch (error) {
    console.error('Ошибка получения типа края ковра:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка получения типа края ковра'
    });
  }
});

export default router;
