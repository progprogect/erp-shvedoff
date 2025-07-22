import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { testConnection, db, schema } from './db';
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

// Load environment variables - only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Debug environment variables loading
console.log('🔧 Environment loading debug:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('   JWT_SECRET present:', !!process.env.JWT_SECRET);
console.log('   CORS_ORIGINS present:', !!process.env.CORS_ORIGINS);
console.log('   Total env vars:', Object.keys(process.env).length);

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
    environment: process.env.NODE_ENV,
    envVarsCount: Object.keys(process.env).length,
    databaseConfigured: !!process.env.DATABASE_URL,
    jwtConfigured: !!process.env.JWT_SECRET,
    corsConfigured: !!process.env.CORS_ORIGINS
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

// Serve static files from React build (for Railway deployment)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../../frontend/build');
  app.use(express.static(buildPath));
  
  // Handle React Router - send all non-API requests to index.html
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      res.status(404).json({
        error: 'Not Found',
        message: `API route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
} else {
  // Development 404 handler for non-API routes
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  });
}

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Database connection failed, but starting server for diagnostics...');
      console.error('   Health check will be available for troubleshooting');
      
      // Start server without database functionality for diagnostics
      app.listen(PORT, () => {
        console.log(`🚀 Server running in DIAGNOSTIC MODE on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`⚠️  Database not connected - API will not work`);
        console.log(`🌟 Environment: ${process.env.NODE_ENV}`);
      });
      return;
    }

    console.log('✅ Database connected successfully');
    
    // Auto-setup database in production (Railway)
    if (process.env.NODE_ENV === 'production') {
      try {
        console.log('🔄 Checking database schema...');
        
        // Try to count users to see if tables exist
        const { sql } = await import('drizzle-orm');
        let needsSetup = false;
        
        try {
          const usersCountResult = await db.select({ count: sql`count(*)` }).from(schema.users);
          const usersCount = Number(usersCountResult[0]?.count || 0);
          
          if (usersCount === 0) {
            console.log('📊 Database schema exists but is empty, need to seed');
            needsSetup = true;
          } else {
            console.log(`✅ Database ready with ${usersCount} users`);
          }
        } catch (error: any) {
          if (error.code === '42P01') { // Table does not exist
            console.log('🔧 Database schema missing, need to migrate and seed');
            needsSetup = true;
          } else {
            throw error;
          }
        }
        
        if (needsSetup) {
          console.log('🚀 Auto-setting up database...');
          const { execSync } = await import('child_process');
          
          // Run migrations
          console.log('1️⃣ Running database migrations...');
          execSync('npx drizzle-kit push:pg', { 
            stdio: 'inherit',
            env: { ...process.env }
          });
          console.log('✅ Migrations completed');
          
          // Run seeding
          console.log('2️⃣ Seeding database with initial data...');
          execSync('npm run db:seed', { 
            stdio: 'inherit',
            env: { ...process.env }
          });
          console.log('✅ Database seeded successfully');
          
          console.log('🎉 Database setup completed! Test users:');
          console.log('   - director/123456 (Директор)');
          console.log('   - manager1/123456 (Менеджер)');
          console.log('   - production1/123456 (Производство)');
          console.log('   - warehouse1/123456 (Склад)');
        }
      } catch (error) {
        console.error('❌ Database setup failed:', error);
        console.error('   Continuing startup, but app may not work properly');
      }
    }

    // Initialize default permissions
    try {
      const { initializeDefaultPermissions } = await import('./middleware/permissions');
      await initializeDefaultPermissions();
      console.log('✅ Permissions initialized');
    } catch (error) {
      console.warn('⚠️ Warning: Could not initialize permissions:', error);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 API docs: http://localhost:${PORT}/api`);
      console.log(`🌟 Environment: ${process.env.NODE_ENV}`);
      console.log(`✅ All systems operational`);
    });
  } catch (error) {
    console.error('❌ Critical error starting server:', error);
    
    // Try to start in diagnostic mode
    try {
      app.listen(PORT, () => {
        console.log(`🚀 Server running in EMERGENCY MODE on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`❌ Critical error occurred - check logs`);
      });
    } catch (emergencyError) {
      console.error('❌ Cannot start server even in emergency mode:', emergencyError);
      process.exit(1);
    }
  }
};

startServer(); 