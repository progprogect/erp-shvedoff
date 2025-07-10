import { pgTable, serial, varchar, text, integer, decimal, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['manager', 'director', 'production', 'warehouse']);
export const orderStatusEnum = pgEnum('order_status', ['new', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled']);
export const priorityLevelEnum = pgEnum('priority_level', ['low', 'normal', 'high', 'urgent']);
export const movementTypeEnum = pgEnum('movement_type', ['incoming', 'outgoing', 'cutting_out', 'cutting_in', 'reservation', 'release_reservation', 'adjustment']);
export const productionStatusEnum = pgEnum('production_status', ['queued', 'in_progress', 'completed', 'cancelled']);
export const cuttingStatusEnum = pgEnum('cutting_status', ['planned', 'in_progress', 'completed', 'cancelled']);
export const shipmentStatusEnum = pgEnum('shipment_status', ['planned', 'loading', 'shipped', 'delivered']);
export const defectStatusEnum = pgEnum('defect_status', ['identified', 'under_review', 'for_repair', 'for_rework', 'written_off']);
export const auditOperationEnum = pgEnum('audit_operation', ['INSERT', 'UPDATE', 'DELETE']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);

// Users table - FR-001
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  telegramId: varchar('telegram_id', { length: 50 }).unique(),
  fullName: varchar('full_name', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Categories table - FR-002
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: integer('parent_id'),
  path: text('path'), // для быстрого поиска по иерархии
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Products table - FR-002
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 500 }).notNull(),
  article: varchar('article', { length: 100 }).unique(),
  categoryId: integer('category_id').references(() => categories.id),
  dimensions: jsonb('dimensions'), // {length: 1800, width: 1200, height: 30}
  characteristics: jsonb('characteristics'), // {surface: "чертёная", material: "резина"}
  tags: text('tags').array(),
  price: decimal('price', { precision: 10, scale: 2 }),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
  normStock: integer('norm_stock').default(0),
  notes: text('notes'),
  photos: text('photos').array(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Product relations - FR-002
export const productRelations = pgTable('product_relations', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  relatedProductId: integer('related_product_id').notNull().references(() => products.id),
  relationType: varchar('relation_type', { length: 50 }).notNull(), // 'analog', 'substitute', 'component'
  createdAt: timestamp('created_at').defaultNow()
});

// Stock table - FR-003
export const stock = pgTable('stock', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id).unique(),
  currentStock: integer('current_stock').notNull().default(0),
  reservedStock: integer('reserved_stock').notNull().default(0),
  // availableStock computed as (currentStock - reservedStock)
  updatedAt: timestamp('updated_at').defaultNow()
});

// Stock movements - FR-003
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  movementType: movementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  referenceId: integer('reference_id'), // ссылка на заказ, операцию резки и т.д.
  referenceType: varchar('reference_type', { length: 50 }), // 'order', 'cutting', 'adjustment'
  comment: text('comment'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow()
});

// Orders table - FR-004
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerContact: varchar('customer_contact', { length: 255 }),
  status: orderStatusEnum('status').default('new'),
  priority: priorityLevelEnum('priority').default('normal'),
  deliveryDate: timestamp('delivery_date'),
  managerId: integer('manager_id').references(() => users.id),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Order items - FR-004
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  reservedQuantity: integer('reserved_quantity').default(0),
  price: decimal('price', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow()
});

// Order messages/chat - FR-004
export const orderMessages = pgTable('order_messages', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Production queue - FR-005
export const productionQueue = pgTable('production_queue', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  priority: integer('priority').default(1),
  estimatedStartDate: timestamp('estimated_start_date'),
  estimatedCompletionDate: timestamp('estimated_completion_date'),
  actualStartDate: timestamp('actual_start_date'),
  actualCompletionDate: timestamp('actual_completion_date'),
  status: productionStatusEnum('status').default('queued'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow()
});

// Cutting operations - FR-005
export const cuttingOperations = pgTable('cutting_operations', {
  id: serial('id').primaryKey(),
  sourceProductId: integer('source_product_id').notNull().references(() => products.id),
  targetProductId: integer('target_product_id').notNull().references(() => products.id),
  sourceQuantity: integer('source_quantity').notNull(),
  targetQuantity: integer('target_quantity').notNull(),
  wasteQuantity: integer('waste_quantity').default(0),
  status: cuttingStatusEnum('status').default('planned'),
  operatorId: integer('operator_id').references(() => users.id),
  plannedDate: timestamp('planned_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// Shipments - FR-006
export const shipments = pgTable('shipments', {
  id: serial('id').primaryKey(),
  shipmentNumber: varchar('shipment_number', { length: 50 }).notNull().unique(),
  orderId: integer('order_id').references(() => orders.id),
  plannedDate: timestamp('planned_date'),
  actualDate: timestamp('actual_date'),
  transportInfo: text('transport_info'),
  status: shipmentStatusEnum('status').default('planned'),
  documentsPhotos: text('documents_photos').array(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow()
});

// Shipment items - FR-006
export const shipmentItems = pgTable('shipment_items', {
  id: serial('id').primaryKey(),
  shipmentId: integer('shipment_id').notNull().references(() => shipments.id),
  productId: integer('product_id').notNull().references(() => products.id),
  plannedQuantity: integer('planned_quantity').notNull(),
  actualQuantity: integer('actual_quantity'),
  createdAt: timestamp('created_at').defaultNow()
});

// Defect products - FR-007
export const defectProducts = pgTable('defect_products', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  defectType: varchar('defect_type', { length: 100 }),
  defectReason: text('defect_reason'),
  status: defectStatusEnum('status').default('identified'),
  decision: text('decision'), // списать, переработать, ремонт
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// Audit log - FR-008
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: integer('record_id').notNull(),
  operation: auditOperationEnum('operation').notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow()
});

// Operation reversals - FR-008
export const operationReversals = pgTable('operation_reversals', {
  id: serial('id').primaryKey(),
  auditLogId: integer('audit_log_id').notNull().references(() => auditLog.id),
  reversalReason: text('reversal_reason'),
  reversedBy: integer('reversed_by').references(() => users.id),
  reversedAt: timestamp('reversed_at').defaultNow()
});

// Telegram notifications - FR-009
export const telegramNotifications = pgTable('telegram_notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  messageType: varchar('message_type', { length: 50 }),
  messageText: text('message_text'),
  sentAt: timestamp('sent_at'),
  status: notificationStatusEnum('status').default('pending')
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  messages: many(orderMessages),
  productions: many(productionQueue),
  notifications: many(telegramNotifications),
  stockMovements: many(stockMovements)
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
  products: many(products)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  stock: one(stock, { fields: [products.id], references: [stock.productId] }),
  orderItems: many(orderItems),
  stockMovements: many(stockMovements),
  productionQueue: many(productionQueue)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  manager: one(users, { fields: [orders.managerId], references: [users.id] }),
  items: many(orderItems, { relationName: 'orderItems' }),
  messages: many(orderMessages, { relationName: 'orderMessages' }),
  shipments: many(shipments),
  productionQueue: many(productionQueue)
}));

export const stockRelations = relations(stock, ({ one }) => ({
  product: one(products, { fields: [stock.productId], references: [products.id] })
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  user: one(users, { fields: [stockMovements.userId], references: [users.id] })
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id], relationName: 'orderItems' }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] })
}));

export const orderMessagesRelations = relations(orderMessages, ({ one }) => ({
  order: one(orders, { fields: [orderMessages.orderId], references: [orders.id], relationName: 'orderMessages' }),
  user: one(users, { fields: [orderMessages.userId], references: [users.id] })
}));

export const productionQueueRelations = relations(productionQueue, ({ one }) => ({
  order: one(orders, { fields: [productionQueue.orderId], references: [orders.id] }),
  product: one(products, { fields: [productionQueue.productId], references: [products.id] })
})); 