import { pgTable, serial, varchar, text, integer, decimal, timestamp, boolean, jsonb, pgEnum, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['manager', 'director', 'production', 'warehouse']);
export const orderStatusEnum = pgEnum('order_status', ['new', 'confirmed', 'in_production', 'ready', 'completed', 'cancelled']);
export const orderSourceEnum = pgEnum('order_source', ['database', 'website', 'avito', 'referral', 'cold_call', 'other']);
export const priorityLevelEnum = pgEnum('priority_level', ['low', 'normal', 'high', 'urgent']);
export const movementTypeEnum = pgEnum('movement_type', ['incoming', 'outgoing', 'cutting_out', 'cutting_in', 'reservation', 'release_reservation', 'adjustment']);
export const productionStatusEnum = pgEnum('production_status', ['queued', 'in_progress', 'completed', 'cancelled']);
export const cuttingStatusEnum = pgEnum('cutting_status', ['planned', 'approved', 'in_progress', 'paused', 'completed', 'cancelled']);
export const shipmentStatusEnum = pgEnum('shipment_status', ['pending', 'completed', 'cancelled', 'paused']);
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

// Permissions system
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  resource: varchar('resource', { length: 50 }).notNull(), // catalog, orders, stock, etc.
  action: varchar('action', { length: 50 }).notNull(), // view, create, edit, delete, etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow()
});

export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  role: userRoleEnum('role').notNull(),
  permissionId: integer('permission_id').notNull().references(() => permissions.id),
  createdAt: timestamp('created_at').defaultNow()
});

export const userPermissions = pgTable('user_permissions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  permissionId: integer('permission_id').notNull().references(() => permissions.id),
  granted: boolean('granted').notNull().default(true), // true = grant, false = deny
  createdAt: timestamp('created_at').defaultNow()
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

// Product surfaces table - FR-002-EXT
export const productSurfaces = pgTable('product_surfaces', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').default(false), // предустановленные нельзя удалить
  createdAt: timestamp('created_at').defaultNow()
});

// Product logos table - FR-002-EXT
export const productLogos = pgTable('product_logos', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').default(false), // предустановленные логотипы
  createdAt: timestamp('created_at').defaultNow()
});

// Product materials table - FR-002-EXT
export const productMaterials = pgTable('product_materials', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').default(false), // предустановленные материалы
  createdAt: timestamp('created_at').defaultNow()
});

// Puzzle types table - для динамического управления типами паззлов
export const puzzleTypes = pgTable('puzzle_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 50 }).notNull().unique(), // old, new, narrow, wide и т.д.
  description: text('description'),
  isSystem: boolean('is_system').default(false), // предустановленные типы
  createdAt: timestamp('created_at').defaultNow()
});

// Enum для сортов товаров
export const productGradeEnum = pgEnum('product_grade', ['usual', 'grade_2', 'telyatnik', 'liber']);

// Enum для типа пресса
export const pressTypeEnum = pgEnum('press_type', ['not_selected', 'ukrainian', 'chinese']);

// Enum для наличия борта (Задача 7.1)
export const borderTypeEnum = pgEnum('border_type', ['with_border', 'without_border']);

// Enum для типа товара (Задача: Товары типа "Другое")
export const productTypeEnum = pgEnum('product_type', ['carpet', 'other', 'pur', 'roll_covering']);

// Products table - FR-002
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 500 }).notNull(),
  article: varchar('article', { length: 100 }).unique(),
  productType: productTypeEnum('product_type').default('carpet').notNull(), // тип товара: ковер, другое или ПУР
  purNumber: integer('pur_number'), // номер ПУР (только для товаров типа pur)
  categoryId: integer('category_id').references(() => categories.id),
  managerId: integer('manager_id').references(() => users.id), // ответственный за товар
  surfaceId: integer('surface_id').references(() => productSurfaces.id), // DEPRECATED: используется для обратной совместимости
  surfaceIds: integer('surface_ids').array(), // множественный выбор поверхностей
  logoId: integer('logo_id').references(() => productLogos.id),
  materialId: integer('material_id').references(() => productMaterials.id),
  pressType: pressTypeEnum('press_type').default('not_selected'), // тип пресса
  dimensions: jsonb('dimensions'), // {length: 1800, width: 1200, thickness: 10}
  characteristics: jsonb('characteristics'), // {surface: "чертёная", material: "резина"}
  puzzleOptions: jsonb('puzzle_options'), // {sides: "1_side", type: "old", enabled: false} - опции для поверхности "Паззл"
  matArea: decimal('mat_area', { precision: 10, scale: 4 }), // Площадь мата в м² (автоматический расчет + коррекция)
  weight: decimal('weight', { precision: 8, scale: 3 }), // Вес товара в кг (опционально)
  grade: productGradeEnum('grade').default('usual'), // Сорт товара: обычный по умолчанию
  borderType: borderTypeEnum('border_type'), // Наличие борта: с бортом / без борта (Задача 7.1)
  tags: text('tags').array(),
  price: decimal('price', { precision: 10, scale: 2 }),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
  normStock: integer('norm_stock').default(0),
  notes: text('notes'),
  photos: text('photos').array(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  // Новые поля для края ковра
  carpetEdgeType: varchar('carpet_edge_type', { length: 50 }).default('straight_cut'),
  carpetEdgeSides: integer('carpet_edge_sides').default(1),
  carpetEdgeStrength: varchar('carpet_edge_strength', { length: 50 }).default('normal'),
  // Поле для низа ковра
  bottomTypeId: integer('bottom_type_id').references(() => bottomTypes.id),
  // Поля паззла (для обратной совместимости)
  puzzleTypeId: integer('puzzle_type_id').references(() => puzzleTypes.id),
  puzzleSides: integer('puzzle_sides').default(1)
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
  source: orderSourceEnum('source').default('database'),
  customSource: varchar('custom_source', { length: 255 }), // для "другое"
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

// Production Tasks - новая система управления производственными заданиями
export const productionTaskStatusEnum = pgEnum('production_task_status', [
  'pending',       // ожидает выполнения (заменяет suggested + approved)  
  'in_progress',   // в работе
  'paused',        // на паузе
  'completed',     // завершено
  'cancelled'      // отменено
]);

export const productionTasks = pgTable('production_tasks', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id), // Убираем notNull - задания могут быть без заказа
  productId: integer('product_id').notNull().references(() => products.id),
  requestedQuantity: integer('requested_quantity').notNull(), // запрошенное количество
  status: productionTaskStatusEnum('status').default('pending'),
  priority: integer('priority').default(1), // 1-5, где 5 - срочный
  sortOrder: integer('sort_order').default(0), // для drag-and-drop сортировки
  
  // Планирование и даты
  plannedDate: timestamp('planned_date'), // планируемая дата выполнения задания
  plannedStartTime: varchar('planned_start_time', { length: 8 }), // планируемое время начала (HH:MM)
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // Результаты выполнения
  producedQuantity: integer('produced_quantity').default(0), // фактически произведено
  qualityQuantity: integer('quality_quantity').default(0),   // годных изделий
  defectQuantity: integer('defect_quantity').default(0),     // брак
  
  // Метаданные
  createdBy: integer('created_by').references(() => users.id), // кто создал
  assignedTo: integer('assigned_to').references(() => users.id),   // на кого назначено
  startedBy: integer('started_by').references(() => users.id),     // кто запустил
  completedBy: integer('completed_by').references(() => users.id), // кто завершил
  
  notes: text('notes'),
  
  updatedAt: timestamp('updated_at').defaultNow()
});

// Дополнительные товары, произведенные сверх задания
export const productionTaskExtras = pgTable('production_task_extras', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => productionTasks.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
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
  actualSecondGradeQuantity: integer('actual_second_grade_quantity').default(0), // Фактическое количество товара 2-го сорта
  status: cuttingStatusEnum('status').default('in_progress'),
  operatorId: integer('operator_id').references(() => users.id),
  assignedTo: integer('assigned_to').references(() => users.id), // на кого назначена операция
  plannedDate: timestamp('planned_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// Shipments - FR-006
export const shipments = pgTable('shipments', {
  id: serial('id').primaryKey(),
  shipmentNumber: varchar('shipment_number', { length: 50 }).notNull().unique(),
  plannedDate: timestamp('planned_date'),
  actualDate: timestamp('actual_date'),
  transportInfo: text('transport_info'),
  status: shipmentStatusEnum('status').default('pending'),
  documentsPhotos: text('documents_photos').array(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
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

// Shipment orders - many-to-many связь между отгрузками и заказами
export const shipmentOrders = pgTable('shipment_orders', {
  id: serial('id').primaryKey(),
  shipmentId: integer('shipment_id').notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  // Уникальная комбинация shipment_id + order_id
  uniqueShipmentOrder: unique('unique_shipment_order').on(table.shipmentId, table.orderId),
  // Индексы для производительности
  shipmentIdIdx: index('idx_shipment_orders_shipment_id').on(table.shipmentId),
  orderIdIdx: index('idx_shipment_orders_order_id').on(table.orderId),
  compositeIdx: index('idx_shipment_orders_composite').on(table.shipmentId, table.orderId)
}));

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

// Carpet Edge Types table - новый справочник для типов края ковра
export const carpetEdgeTypes = pgTable('carpet_edge_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

export const bottomTypes = pgTable('bottom_types', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Таблица состава рулонных покрытий
export const rollCoveringComposition = pgTable('roll_covering_composition', {
  id: serial('id').primaryKey(),
  rollCoveringId: integer('roll_covering_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  carpetId: integer('carpet_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(), // 🔥 ОБНОВЛЕНО: поддержка дробных значений
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  products: many(products), // товары под ответственностью пользователя
  messages: many(orderMessages),
  productions: many(productionQueue),
  notifications: many(telegramNotifications),
  stockMovements: many(stockMovements),
  userPermissions: many(userPermissions),
  tasksCreated: many(productionTasks, { relationName: 'tasksCreated' }),
  tasksAssigned: many(productionTasks, { relationName: 'tasksAssigned' }),
  tasksStarted: many(productionTasks, { relationName: 'tasksStarted' }),
  tasksCompleted: many(productionTasks, { relationName: 'tasksCompleted' }),
  cuttingOperator: many(cuttingOperations, { relationName: 'cuttingOperator' }),
  cuttingAssigned: many(cuttingOperations, { relationName: 'cuttingAssigned' })
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy"
  }),
  children: many(categories, {
    relationName: "categoryHierarchy"
  }),
  products: many(products)
}));

export const productSurfacesRelations = relations(productSurfaces, ({ many }) => ({
  products: many(products)
}));

export const productLogosRelations = relations(productLogos, ({ many }) => ({
  products: many(products)
}));

export const productMaterialsRelations = relations(productMaterials, ({ many }) => ({
  products: many(products)
}));

export const carpetEdgeTypesRelations = relations(carpetEdgeTypes, ({ many }) => ({
  products: many(products)
}));

export const bottomTypesRelations = relations(bottomTypes, ({ many }) => ({
  products: many(products)
}));

export const rollCoveringCompositionRelations = relations(rollCoveringComposition, ({ one }) => ({
  rollCovering: one(products, { fields: [rollCoveringComposition.rollCoveringId], references: [products.id], relationName: 'rollComposition' }),
  carpet: one(products, { fields: [rollCoveringComposition.carpetId], references: [products.id] })
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  manager: one(users, { fields: [products.managerId], references: [users.id] }),
  surface: one(productSurfaces, { fields: [products.surfaceId], references: [productSurfaces.id] }), // DEPRECATED: для обратной совместимости
  // surfaceIds обрабатывается отдельно в API, так как это array связь
  logo: one(productLogos, { fields: [products.logoId], references: [productLogos.id] }),
  material: one(productMaterials, { fields: [products.materialId], references: [productMaterials.id] }),
  bottomType: one(bottomTypes, { fields: [products.bottomTypeId], references: [bottomTypes.id] }),
  puzzleType: one(puzzleTypes, { fields: [products.puzzleTypeId], references: [puzzleTypes.id] }),
  stock: one(stock, { fields: [products.id], references: [stock.productId] }),
  orderItems: many(orderItems),
  stockMovements: many(stockMovements),
  productionQueue: many(productionQueue),
  productionTasks: many(productionTasks),
  productionTaskExtras: many(productionTaskExtras),
  sourceCuttingOperations: many(cuttingOperations, { relationName: 'sourceCuttingOperations' }),
  targetCuttingOperations: many(cuttingOperations, { relationName: 'targetCuttingOperations' }),
  rollComposition: many(rollCoveringComposition, { relationName: 'rollComposition' })
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  manager: one(users, { fields: [orders.managerId], references: [users.id] }),
  items: many(orderItems, { relationName: 'orderItems' }),
  messages: many(orderMessages, { relationName: 'orderMessages' }),
  shipments: many(shipmentOrders),
  productionQueue: many(productionQueue),
  productionTasks: many(productionTasks)
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

// Relations для новых таблиц производственных заданий
export const productionTasksRelations = relations(productionTasks, ({ one, many }) => ({
  order: one(orders, { fields: [productionTasks.orderId], references: [orders.id] }),
  product: one(products, { fields: [productionTasks.productId], references: [products.id] }),
  createdByUser: one(users, { fields: [productionTasks.createdBy], references: [users.id], relationName: 'tasksCreated' }),
  assignedToUser: one(users, { fields: [productionTasks.assignedTo], references: [users.id], relationName: 'tasksAssigned' }),
  startedByUser: one(users, { fields: [productionTasks.startedBy], references: [users.id], relationName: 'tasksStarted' }),
  completedByUser: one(users, { fields: [productionTasks.completedBy], references: [users.id], relationName: 'tasksCompleted' }),
  extras: many(productionTaskExtras)
}));

export const productionTaskExtrasRelations = relations(productionTaskExtras, ({ one }) => ({
  task: one(productionTasks, { fields: [productionTaskExtras.taskId], references: [productionTasks.id] }),
  product: one(products, { fields: [productionTaskExtras.productId], references: [products.id] })
}));

// Relations для операций резки
export const cuttingOperationsRelations = relations(cuttingOperations, ({ one }) => ({
  sourceProduct: one(products, { fields: [cuttingOperations.sourceProductId], references: [products.id], relationName: 'sourceCuttingOperations' }),
  targetProduct: one(products, { fields: [cuttingOperations.targetProductId], references: [products.id], relationName: 'targetCuttingOperations' }),
  operator: one(users, { fields: [cuttingOperations.operatorId], references: [users.id], relationName: 'cuttingOperator' }),
  assignedToUser: one(users, { fields: [cuttingOperations.assignedTo], references: [users.id], relationName: 'cuttingAssigned' })
}));

// Relations для отгрузок
export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  createdByUser: one(users, { fields: [shipments.createdBy], references: [users.id] }),
  items: many(shipmentItems),
  orders: many(shipmentOrders)
}));

export const shipmentItemsRelations = relations(shipmentItems, ({ one }) => ({
  shipment: one(shipments, { fields: [shipmentItems.shipmentId], references: [shipments.id] }),
  product: one(products, { fields: [shipmentItems.productId], references: [products.id] })
}));

// Relations для связи отгрузок и заказов
export const shipmentOrdersRelations = relations(shipmentOrders, ({ one }) => ({
  shipment: one(shipments, { fields: [shipmentOrders.shipmentId], references: [shipments.id] }),
  order: one(orders, { fields: [shipmentOrders.orderId], references: [orders.id] })
}));

// Relations для системы разрешений
export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userPermissions: many(userPermissions)
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] })
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, { fields: [userPermissions.userId], references: [users.id] }),
  permission: one(permissions, { fields: [userPermissions.permissionId], references: [permissions.id] })
}));