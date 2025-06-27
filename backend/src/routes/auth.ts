import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return next(createError('Username and password are required', 400));
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username)
    });

    if (!user || !user.isActive) {
      return next(createError('Invalid credentials', 401));
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return next(createError('Invalid credentials', 401));
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    
    // Generate new token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        passwordHash: false // Exclude password
      }
    });

    if (!user) {
      return next(createError('User not found', 404));
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  // With JWT, logout is handled on client side by removing token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router; 