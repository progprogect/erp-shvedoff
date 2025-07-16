import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { testConnection } from './db';
import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import stockRoutes from './routes/stock';
import orderRoutes from './routes/orders';
import categoriesRoutes from './routes/categories';
import productsRoutes from './routes/products';
import auditRoutes from './routes/audit';
import dashboardRoutes from './routes/dashboard';
import productionRoutes from './routes/production';
import cuttingRoutes from './routes/cutting';
import shipmentsRoutes from './routes/shipments';
import usersRoutes from './routes/users';
import permissionsRoutes from './routes/permissions';
import surfacesRoutes from './routes/surfaces';
import logosRoutes from './routes/logos';
import materialsRoutes from './routes/materials';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Health check endpoint - Required by Acceptance Criteria
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV 
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/cutting', cuttingRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/surfaces', surfacesRoutes);
app.use('/api/logos', logosRoutes);
app.use('/api/materials', materialsRoutes);

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'ERP Shvedoff API',
    version: '1.0.0',
    description: 'Система управления складскими остатками и заказами резинотехнических изделий',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      catalog: '/api/catalog',
      stock: '/api/stock',
      orders: '/api/orders',
      dashboard: '/api/dashboard',
      production: '/api/production',
      cutting: '/api/cutting',
      shipments: '/api/shipments',
      users: '/api/users',
      permissions: '/api/permissions',
      surfaces: '/api/surfaces',
      logos: '/api/logos',
      materials: '/api/materials',
      audit: '/api/audit'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Initialize default permissions
    try {
      const { initializeDefaultPermissions } = await import('./middleware/permissions');
      await initializeDefaultPermissions();
    } catch (error) {
      console.warn('⚠️ Warning: Could not initialize permissions:', error);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 API docs: http://localhost:${PORT}/api`);
      console.log(`🌟 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 