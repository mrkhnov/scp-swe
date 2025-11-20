# Supplier Consumer Platform (SCP) - Backend

## 🎯 Overview

The **Supplier Consumer Platform (SCP)** is a B2B platform designed to facilitate direct collaboration between **Suppliers** (food distributors) and **Consumers** (restaurants/hotels). This is **NOT a public marketplace** - Consumers can only view catalogs and place orders with suppliers they have an **approved Link** with.

Built with FastAPI, PostgreSQL, and async Python, this platform implements robust role-based access control, real-time chat, and comprehensive order management workflows.

---

## 🏗️ Architecture

### Tech Stack

- **Framework**: FastAPI (Async)
- **Database**: PostgreSQL 15
- **ORM**: SQLAlchemy 2.0 (Async)
- **Migrations**: Alembic
- **Authentication**: OAuth2 with JWT (Access & Refresh tokens)
- **Validation**: Pydantic V2
- **Real-time Chat**: WebSockets
- **Containerization**: Docker & Docker Compose

### Project Structure

```
srs/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── core/
│   │   ├── config.py           # Application settings
│   │   └── security.py         # JWT & password utilities
│   ├── db/
│   │   └── session.py          # Database session management
│   ├── models/                 # SQLAlchemy models
│   │   ├── user.py
│   │   ├── company.py
│   │   ├── link.py
│   │   ├── product.py
│   │   ├── order.py
│   │   ├── complaint.py
│   │   └── chat_message.py
│   ├── schemas/                # Pydantic schemas
│   │   ├── user.py
│   │   ├── company.py
│   │   ├── link.py
│   │   ├── product.py
│   │   ├── order.py
│   │   ├── complaint.py
│   │   └── chat_message.py
│   ├── routers/                # API endpoints
│   │   ├── auth.py
│   │   ├── link.py
│   │   ├── order.py
│   │   ├── product.py
│   │   ├── complaint.py
│   │   └── chat.py
│   └── services/               # Business logic
│       ├── auth_service.py
│       ├── link_service.py
│       ├── order_service.py
│       ├── product_service.py
│       ├── complaint_service.py
│       └── chat_service.py
├── migrations/                 # Database migrations (Alembic)
│   ├── versions/
│   └── env.py
├── requirements.txt
├── alembic.ini                 # Alembic configuration
├── Dockerfile
├── docker-compose.yml
├── .env.example                # Environment variables template
├── .gitignore
└── README.md
```

---

## 🔑 Key Features

### 1. Role-Based Access Control (RBAC)

Four distinct user roles with specific permissions:

| Role | Permissions |
|------|-------------|
| **Consumer** | Request links to suppliers, view linked catalogs, place orders, create complaints |
| **Supplier Owner** | Full control: manage users (create/delete Managers & Sales Reps), manage catalog, handle orders, delete company |
| **Supplier Manager** | Manage catalog/inventory, handle escalated complaints, manage orders |
| **Supplier Sales Rep** | Front-line staff: chat with consumers, handle initial complaints (read-only on catalog) |

### 2. The "Handshake" (Linking System) 🤝

**Critical Business Logic**: Consumers can ONLY interact with suppliers they have an APPROVED link with.

**Workflow**:
```
1. Consumer → POST /links/request (with supplier_id)
2. Link created with status=PENDING
3. Supplier (Owner/Manager/Sales) → PUT /links/{id}/status (APPROVED/REJECTED/BLOCKED)
4. If APPROVED → Consumer can now:
   - View supplier's catalog
   - Place orders
   - Chat with supplier staff
```

**Link Statuses**:
- `PENDING`: Awaiting supplier approval
- `APPROVED`: Active relationship - consumer has full access
- `REJECTED`: Request denied
- `BLOCKED`: Relationship terminated

### 3. Catalog Management with Link-Based Filtering

**Read Access**:
- **Consumers**: Can ONLY fetch products from suppliers with APPROVED links
- **Suppliers**: Full access to their own products

**Write Access** (Suppliers only):
- **Owner/Manager**: Create, update, delete products
- **Sales Rep**: Read-only access

**Key Endpoints**:
```
GET  /products/catalog              # Filtered by approved links (Consumer)
                                     # Own products (Supplier)
GET  /products/catalog?supplier_id=X # Filter by specific linked supplier
POST /products/                      # Owner/Manager only
PUT  /products/{id}                  # Owner/Manager only
DELETE /products/{id}                # Owner/Manager only
```

### 4. Order Workflow with Atomic Inventory Management

**Order Lifecycle**:
```
PENDING → ACCEPTED → IN_DELIVERY → COMPLETED
        ↓
     REJECTED
     
ACCEPTED/PENDING → CANCELLED (by Consumer or Supplier)
```

**Critical Features**:
- **Link Verification**: Orders can only be placed with APPROVED suppliers
- **Atomic Inventory Decrement**: When order status changes to ACCEPTED, stock is decremented in a transaction
- **Inventory Restoration**: If order is CANCELLED/REJECTED after ACCEPTED, stock is restored
- **Price Snapshot**: `unit_price_at_time` preserves pricing at order creation

**Permissions**:
- **Consumer**: Create orders, cancel own orders
- **Supplier (Owner/Manager/Sales)**: Accept/reject orders, update delivery status

### 5. Complaint Escalation System

**Status Flow**:
```
OPEN → ESCALATED → RESOLVED
     ↓
  RESOLVED (if Sales Rep can handle)
```

**Workflow**:
1. Consumer or Supplier creates complaint for an order
2. Sales Rep assigns themselves: `PUT /complaints/{id}/assign`
3. If Sales Rep can't resolve: `PUT /complaints/{id}/escalate` (status → ESCALATED)
4. Manager receives escalated complaint and resolves
5. Either role: `PUT /complaints/{id}/resolve` (status → RESOLVED)

### 6. Real-Time Chat (WebSocket)

**Connection**:
```javascript
const ws = new WebSocket('ws://localhost:8000/chat/ws?token=YOUR_JWT_TOKEN');
```

**Send Message**:
```json
{
  "recipient_id": 123,
  "content": "Hello!",
  "attachment_url": "https://example.com/file.pdf"
}
```

**Receive Message**:
```json
{
  "type": "message",
  "id": 456,
  "sender_id": 789,
  "recipient_id": 123,
  "content": "Hello!",
  "attachment_url": null,
  "timestamp": "2025-11-19T12:00:00"
}
```

**REST Endpoint**:
```
GET /chat/history/{user_id}?limit=50  # Get chat history
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15 (if running locally without Docker)

### Option 1: Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd srs
   ```

2. **Configure environment** (optional):
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:secret@db:5432/scp
   JWT_SECRET_KEY=your-secret-key-here
   JWT_REFRESH_SECRET_KEY=your-refresh-secret-here
   ```

3. **Build and run**:
   ```bash
   docker compose up --build
   ```

4. **Run migrations**:
   ```bash
   docker compose exec api alembic upgrade head
   ```

5. **Access the API**:
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - PostgreSQL: localhost:5432

### Option 2: Local Development

1. **Create virtual environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up PostgreSQL**:
   ```bash
   # Create database
   createdb -U postgres scp
   
   # Or using psql
   psql -U postgres -c "CREATE DATABASE scp;"
   ```

4. **Configure environment**:
   Create a `.env` file in the project root:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/scp
   JWT_SECRET_KEY=your-secret-key-here-min-32-chars
   JWT_REFRESH_SECRET_KEY=your-refresh-secret-here-min-32-chars
   ```

5. **Run migrations**:
   ```bash
   alembic upgrade head
   ```

6. **Start the server**:
   ```bash
   uvicorn app.main:app --reload
   ```

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/token` | Login (get JWT tokens) | No |

### Links (Handshake System)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/links/request` | Consumer requests link to supplier | Consumer |
| PUT | `/links/{id}/status` | Supplier approves/rejects/blocks link | Supplier (All) |
| GET | `/links/my-links` | Get all links for current user's company | Yes |

### Products (Catalog)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/products/catalog` | Get filtered catalog (link-based) | Yes |
| GET | `/products/{id}` | Get product details | Yes |
| POST | `/products/` | Create product | Owner/Manager |
| PUT | `/products/{id}` | Update product | Owner/Manager |
| DELETE | `/products/{id}` | Delete product | Owner/Manager |

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/orders/` | Create order (with linked supplier) | Consumer |
| GET | `/orders/my-orders` | Get all orders for company | Yes |
| GET | `/orders/{id}` | Get order details | Yes |
| PUT | `/orders/{id}/status` | Update order status | Consumer/Supplier |

### Complaints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/complaints/` | Create complaint | Yes |
| GET | `/complaints/` | Get company complaints | Yes |
| PUT | `/complaints/{id}/assign` | Sales Rep assigns to self | Sales Rep |
| PUT | `/complaints/{id}/escalate` | Escalate to Manager | Sales/Manager |
| PUT | `/complaints/{id}/resolve` | Mark as resolved | Sales/Manager |

### Chat

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| WS | `/chat/ws?token=JWT` | WebSocket connection for real-time chat | Yes |
| GET | `/chat/history/{user_id}` | Get chat history with user | Yes |

---

## 🔐 Authentication

### Register User

```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "consumer@example.com",
    "password": "securepassword123",
    "role": "CONSUMER",
    "company_id": 1
  }'
```

### Login

```bash
curl -X POST "http://localhost:8000/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "consumer@example.com",
    "password": "securepassword123"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### Using JWT in Requests

```bash
curl -X GET "http://localhost:8000/products/catalog" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📊 Database Schema

### Core Entities

**Users**
- Stores user credentials, role, and company association
- Supports 4 roles: CONSUMER, SUPPLIER_OWNER, SUPPLIER_MANAGER, SUPPLIER_SALES

**Companies**
- Type: SUPPLIER or CONSUMER
- KYB (Know Your Business) status for verification

**Links**
- Junction between Suppliers and Consumers
- Status: PENDING, APPROVED, REJECTED, BLOCKED
- **Indexed** on `supplier_id`, `consumer_id`, and `status` for fast filtering

**Products**
- Catalog items with SKU, price, stock, min order quantity
- Belongs to a Supplier (company)

**Orders & OrderItems**
- Order header with status and total amount
- OrderItems capture quantity and price at time of order

**Complaints**
- Linked to orders with escalation workflow
- Handler assignment for Sales Rep/Manager

**ChatMessages**
- Stores all messages with sender, recipient, timestamp
- Supports attachments

---

## 🧪 Testing Workflow Example

### 1. Set Up Companies and Users

```bash
# Create Supplier Company (manual DB insert or extend API)
# Create Consumer Company

# Register Supplier Owner
curl -X POST "http://localhost:8000/auth/register" \
  -d '{"email": "owner@supplier.com", "password": "pass123", "role": "SUPPLIER_OWNER", "company_id": 1}'

# Register Consumer
curl -X POST "http://localhost:8000/auth/register" \
  -d '{"email": "buyer@restaurant.com", "password": "pass123", "role": "CONSUMER", "company_id": 2}'
```

### 2. Consumer Requests Link

```bash
# Login as Consumer
TOKEN=$(curl -X POST "http://localhost:8000/auth/token" \
  -d '{"email": "buyer@restaurant.com", "password": "pass123"}' | jq -r .access_token)

# Request link to Supplier (company_id=1)
curl -X POST "http://localhost:8000/links/request" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"supplier_id": 1}'
```

### 3. Supplier Approves Link

```bash
# Login as Supplier Owner
SUPPLIER_TOKEN=$(curl -X POST "http://localhost:8000/auth/token" \
  -d '{"email": "owner@supplier.com", "password": "pass123"}' | jq -r .access_token)

# Approve link (link_id=1)
curl -X PUT "http://localhost:8000/links/1/status" \
  -H "Authorization: Bearer $SUPPLIER_TOKEN" \
  -d '{"status": "APPROVED"}'
```

### 4. Supplier Creates Products

```bash
curl -X POST "http://localhost:8000/products/" \
  -H "Authorization: Bearer $SUPPLIER_TOKEN" \
  -d '{
    "name": "Organic Tomatoes",
    "sku": "TOM-001",
    "price": 5.99,
    "stock_quantity": 100,
    "min_order_qty": 10
  }'
```

### 5. Consumer Views Catalog & Places Order

```bash
# View catalog (only approved suppliers)
curl -X GET "http://localhost:8000/products/catalog" \
  -H "Authorization: Bearer $TOKEN"

# Place order
curl -X POST "http://localhost:8000/orders/" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "supplier_id": 1,
    "items": [
      {"product_id": 1, "quantity": 20}
    ]
  }'
```

### 6. Supplier Accepts Order (Inventory Decrements)

```bash
curl -X PUT "http://localhost:8000/orders/1/status" \
  -H "Authorization: Bearer $SUPPLIER_TOKEN" \
  -d '{"status": "ACCEPTED"}'
# Stock for product_id=1 reduced from 100 to 80
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file or set these in your environment:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:secret@localhost:5432/scp

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET_KEY=your-super-secret-key-change-me
JWT_REFRESH_SECRET_KEY=your-refresh-secret-change-me
JWT_ALGORITHM=HS256

# Token Expiry
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# App
DEBUG=true
```

### Database Migrations

**Note**: The migrations are stored in the `migrations/` folder (configured in `alembic.ini`).

```bash
# Generate a new migration from model changes
alembic revision --autogenerate -m "description"

# Apply migrations to database
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Check current migration version
alembic current

# View migration history
alembic history
```

---

## 🛡️ Security Considerations

1. **Change JWT Secrets**: Update `JWT_SECRET_KEY` and `JWT_REFRESH_SECRET_KEY` in production
2. **CORS Configuration**: Restrict `allow_origins` in production (currently set to `["*"]`)
3. **KYB Verification**: Implement supplier verification workflow before allowing link approvals
4. **Rate Limiting**: Add rate limiting middleware for API endpoints
5. **Input Sanitization**: Pydantic handles validation; consider additional sanitization for chat content
6. **HTTPS Only**: Use HTTPS in production with proper SSL certificates
7. **Database Credentials**: Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps

# View logs
docker compose logs db

# Restart database
docker compose restart db
```

### Migration Errors

```bash
# Reset database (WARNING: Destructive)
docker compose down -v
docker compose up -d db
alembic upgrade head
```

### WebSocket Connection Issues

- Ensure you're using `ws://` (or `wss://` for HTTPS)
- Verify JWT token is valid and not expired
- Check browser console for WebSocket errors

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 👥 Support

For questions or issues:
- Review the API documentation at `/docs`
- Check the issue tracker
- Contact the development team

---

## 🎯 Roadmap

- [ ] Implement refresh token rotation
- [ ] Add email notifications for order status changes
- [ ] Implement file upload for chat attachments
- [ ] Add product search and filtering
- [ ] Implement pagination for large result sets
- [ ] Add analytics dashboard for suppliers
- [ ] Implement multi-warehouse support
- [ ] Add bulk order import/export

---

**Built with ❤️ using FastAPI and PostgreSQL**
