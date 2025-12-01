# DOCUMENTACIÓN DE TABLAS DEL SISTEMA POS

## Estructura de Base de Datos

### Tabla: users
**Registros actuales:** 4

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| username | VARCHAR(50) | NO |  |  |
| email | VARCHAR(100) | NO |  |  |
| password | VARCHAR(255) | NO |  |  |
| role | TEXT | NO |  | 'cashier' |
| isActive | TINYINT(1) | NO |  | 1 |
| lastLogin | DATETIME | SÍ |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- users_is_active (NORMAL)
- users_role (NORMAL)
- users_email (ÚNICO)
- users_username (ÚNICO)
- sqlite_autoindex_users_3 (ÚNICO)
- sqlite_autoindex_users_2 (ÚNICO)
- sqlite_autoindex_users_1 (ÚNICO)

---

### Tabla: products
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| code | VARCHAR(50) | NO |  |  |
| name | VARCHAR(200) | NO |  |  |
| description | TEXT | SÍ |  |  |
| category | TEXT | NO |  |  |
| material | TEXT | NO |  |  |
| weight | DECIMAL(8,3) | SÍ |  |  |
| purity | VARCHAR(20) | SÍ |  |  |
| size | VARCHAR(20) | SÍ |  |  |
| color | VARCHAR(50) | SÍ |  |  |
| purchasePrice | DECIMAL(12,2) | NO |  |  |
| salePrice | DECIMAL(12,2) | NO |  |  |
| stock | INTEGER | NO |  | '0' |
| minStock | INTEGER | NO |  | '1' |
| isActive | TINYINT(1) | NO |  | 1 |
| imageUrl | VARCHAR(500) | SÍ |  |  |
| barcode | VARCHAR(50) | SÍ |  |  |
| supplier | VARCHAR(200) | SÍ |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |
| metal | VARCHAR(50) | SÍ |  |  |
| metalPurity | VARCHAR(20) | SÍ |  |  |
| grams | DECIMAL(8,3) | SÍ |  |  |
| ringSize | VARCHAR(10) | SÍ |  |  |
| chainLengthCm | DECIMAL(6,2) | SÍ |  |  |
| stoneType | VARCHAR(50) | SÍ |  |  |
| stoneColor | VARCHAR(30) | SÍ |  |  |
| stoneCut | VARCHAR(30) | SÍ |  |  |
| stoneCarat | DECIMAL(6,3) | SÍ |  |  |
| finish | VARCHAR(50) | SÍ |  |  |
| plating | VARCHAR(50) | SÍ |  |  |
| hallmark | VARCHAR(50) | SÍ |  |  |
| collection | VARCHAR(100) | SÍ |  |  |
| gender | TEXT | SÍ |  |  |
| isUniquePiece | TINYINT(1) | NO |  | 0 |
| warrantyMonths | INTEGER | NO |  | '0' |
| metadata | JSON | SÍ |  |  |
| version | INTEGER | NO |  | 1 |
| maxStock | INTEGER | SÍ |  |  |
| reorderPoint | INTEGER | SÍ |  |  |
| lastStockUpdate | DATETIME | SÍ |  |  |
| qrPayload | TEXT | SÍ |  |  |

**Índices:**
- idx_products_active (NORMAL)
- idx_products_category (NORMAL)
- idx_products_barcode (NORMAL)
- products_last_stock_update (NORMAL)
- products_reorder_point (NORMAL)
- products_stock_levels (NORMAL)
- sqlite_autoindex_products_3 (ÚNICO)
- sqlite_autoindex_products_2 (ÚNICO)
- sqlite_autoindex_products_1 (ÚNICO)

---

### Tabla: clients
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| code | VARCHAR(50) | NO |  |  |
| firstName | VARCHAR(100) | NO |  |  |
| lastName | VARCHAR(100) | NO |  |  |
| email | VARCHAR(150) | SÍ |  |  |
| phone | VARCHAR(20) | SÍ |  |  |
| address | VARCHAR(300) | SÍ |  |  |
| city | VARCHAR(100) | SÍ |  |  |
| country | VARCHAR(100) | SÍ |  |  |
| birthDate | DATE | SÍ |  |  |
| documentType | TEXT | SÍ |  |  |
| documentNumber | VARCHAR(50) | SÍ |  |  |
| isActive | TINYINT(1) | NO |  | 1 |
| notes | TEXT | SÍ |  |  |
| totalPurchases | DECIMAL(12,2) | NO |  | 0 |
| lastPurchaseDate | DATETIME | SÍ |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |
| loyaltyPoints | DECIMAL(10,2) | NO |  | 0.00 |

**Índices:**
- idx_clients_email (NORMAL)
- clients_last_purchase_date (NORMAL)
- clients_total_purchases (NORMAL)
- clients_is_active (NORMAL)
- clients_document_number (ÚNICO)
- clients_phone (NORMAL)
- clients_email (ÚNICO)
- clients_first_name_last_name (NORMAL)
- clients_code (ÚNICO)
- sqlite_autoindex_clients_4 (ÚNICO)
- sqlite_autoindex_clients_3 (ÚNICO)
- sqlite_autoindex_clients_2 (ÚNICO)
- sqlite_autoindex_clients_1 (ÚNICO)

---

### Tabla: sales
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| saleNumber | VARCHAR(50) | NO |  |  |
| clientId | UUID | SÍ |  |  |
| userId | UUID | NO |  |  |
| subtotal | DECIMAL(12,2) | NO |  |  |
| taxAmount | DECIMAL(12,2) | NO |  | 0 |
| discountAmount | DECIMAL(12,2) | NO |  | 0 |
| total | DECIMAL(12,2) | NO |  |  |
| paymentMethod | TEXT | NO |  |  |
| status | TEXT | NO |  | 'pending' |
| notes | TEXT | SÍ |  |  |
| saleDate | DATETIME | NO |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- idx_sales_date (NORMAL)
- sales_total (NORMAL)
- sales_sale_date (NORMAL)
- sales_payment_method (NORMAL)
- sales_status (NORMAL)
- sales_user_id (NORMAL)
- sales_client_id (NORMAL)
- sales_sale_number (ÚNICO)
- sqlite_autoindex_sales_2 (ÚNICO)
- sqlite_autoindex_sales_1 (ÚNICO)

---

### Tabla: sale_items
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| saleId | UUID | NO |  |  |
| productId | UUID | NO |  |  |
| quantity | INTEGER | NO |  |  |
| unitPrice | DECIMAL(12,2) | NO |  |  |
| subtotal | DECIMAL(12,2) | NO |  |  |
| discountAmount | DECIMAL(12,2) | NO |  | 0 |
| total | DECIMAL(12,2) | NO |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- sale_items_sale_id_product_id (NORMAL)
- sale_items_product_id (NORMAL)
- sale_items_sale_id (NORMAL)
- sqlite_autoindex_sale_items_1 (ÚNICO)

---

### Tabla: inventory_movements
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| productId | UUID | NO |  |  |
| type | TEXT | NO |  |  |
| qtyDelta | INTEGER | NO |  |  |
| gramsDelta | DECIMAL(10,3) | SÍ |  |  |
| reason | VARCHAR(500) | SÍ |  |  |
| refTable | VARCHAR(50) | SÍ |  |  |
| refId | UUID | SÍ |  |  |
| userId | UUID | NO |  |  |
| previousStock | INTEGER | SÍ |  |  |
| newStock | INTEGER | SÍ |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- inventory_movements_created_at (NORMAL)
- inventory_movements_user_id (NORMAL)
- inventory_movements_reference (NORMAL)
- inventory_movements_type_date (NORMAL)
- inventory_movements_product_date (NORMAL)
- sqlite_autoindex_inventory_movements_1 (ÚNICO)

---

### Tabla: tickets
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| saleId | UUID | NO |  |  |
| pdfPath | VARCHAR(500) | SÍ |  |  |
| qrData | TEXT | SÍ |  |  |
| barcodeValue | VARCHAR(100) | SÍ |  |  |
| printerName | VARCHAR(100) | SÍ |  |  |
| status | TEXT | NO |  | 'queued' |
| errorMsg | TEXT | SÍ |  |  |
| printedAt | DATETIME | SÍ |  |  |
| retryCount | INTEGER | NO |  | 0 |
| templateVersion | VARCHAR(20) | SÍ |  | 'A6' |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- tickets_created_at (NORMAL)
- tickets_printed_at (NORMAL)
- tickets_status_date (NORMAL)
- tickets_sale_unique (ÚNICO)
- sqlite_autoindex_tickets_1 (ÚNICO)

---

### Tabla: idempotency_keys
**Registros actuales:** 0

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| keyValue | VARCHAR(255) | NO |  |  |
| endpoint | VARCHAR(100) | NO |  |  |
| httpMethod | VARCHAR(10) | NO |  |  |
| requestHash | VARCHAR(64) | SÍ |  |  |
| responseStatus | INTEGER | SÍ |  |  |
| responseData | JSON | SÍ |  |  |
| userId | UUID | SÍ |  |  |
| expiresAt | DATETIME | NO |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- idempotency_keys_created_at (NORMAL)
- idempotency_keys_user_id (NORMAL)
- idempotency_keys_expires (NORMAL)
- idempotency_keys_endpoint_method (NORMAL)
- idempotency_keys_value_unique (ÚNICO)
- sqlite_autoindex_idempotency_keys_2 (ÚNICO)
- sqlite_autoindex_idempotency_keys_1 (ÚNICO)

---

### Tabla: settings
**Registros actuales:** 16

| Columna | Tipo | Nulo | Clave | Defecto |
|---------|------|------|-------|----------|
| id | UUID | SÍ | PK |  |
| keyName | VARCHAR(100) | NO |  |  |
| value | TEXT | SÍ |  |  |
| dataType | TEXT | NO |  | 'string' |
| category | VARCHAR(50) | NO |  | 'general' |
| description | VARCHAR(500) | SÍ |  |  |
| isEditable | TINYINT(1) | NO |  | 1 |
| isVisible | TINYINT(1) | NO |  | 1 |
| validationRules | JSON | SÍ |  |  |
| createdAt | DATETIME | NO |  |  |
| updatedAt | DATETIME | NO |  |  |

**Índices:**
- settings_visibility (NORMAL)
- settings_category (NORMAL)
- settings_key_unique (ÚNICO)
- sqlite_autoindex_settings_2 (ÚNICO)
- sqlite_autoindex_settings_1 (ÚNICO)

---

