# Supplier Consumer Platform (SCP)

A B2B platform connecting Suppliers (food distributors) with Consumers (restaurants/hotels).

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

This will start both backend and database in containers:

```bash
# Start the entire application
./launch.sh
```

This script will:
- Start PostgreSQL database
- Start FastAPI backend
- Run database migrations
- Start React frontend

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Option 2: Manual Launch

#### 1. Start Backend with Docker Compose

```bash
cd backend
docker-compose up --build -d
```

Wait for the backend to be ready, then run migrations:

```bash
docker-compose exec api alembic upgrade head
```

#### 2. Start Frontend

```bash
cd frontend
npm install  # First time only
npm run dev
```

### Option 3: Development Mode (Using Existing PostgreSQL)

If you already have PostgreSQL running (like your `srs-db` container):

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variable to use your existing database
export DATABASE_URL="postgresql+asyncpg://postgres:secret@localhost:5432/postgres"

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

In another terminal:

```bash
cd frontend
npm install  # First time only
npm run dev
```

## 🛠️ Project Structure

```
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── routers/   # API endpoints
│   │   ├── models/    # Database models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   └── docker-compose.yml
├── frontend/          # React + TypeScript frontend
│   ├── pages/         # Page components
│   ├── services/      # API client
│   └── types.ts       # TypeScript types
└── launch.sh          # Main launch script
```

## 📋 Requirements

- **Docker & Docker Compose** (for Option 1 & 2)
- **Python 3.11+** (for Option 3)
- **Node.js 16+** (for frontend)
- **PostgreSQL 15** (if running manually)

## 🔧 Configuration

### Backend Environment Variables

Create `backend/.env` file:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/scp
JWT_SECRET_KEY=your-secret-key-here
JWT_REFRESH_SECRET_KEY=your-refresh-secret-key-here
DEBUG=True
```

### Frontend Configuration

The frontend is configured to connect to `http://localhost:8000` by default. This is set in `frontend/services/api.ts`.

## 🎯 Features

- **Role-based Access Control**: CONSUMER, SUPPLIER_OWNER, SUPPLIER_MANAGER, SUPPLIER_SALES
- **Link Management**: Consumers request links to suppliers (approval required)
- **Product Catalog**: Suppliers manage their product inventory
- **Order Management**: Full order workflow from creation to completion
- **Complaint System**: Handle order-related complaints
- **Real-time Chat**: WebSocket-based messaging between linked partners

## 📚 API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🧪 Testing the Application

1. **Register a Supplier**:
   - Go to http://localhost:3000
   - Register with role `SUPPLIER_OWNER`
   - Add company name

2. **Register a Consumer**:
   - Register another user with role `CONSUMER`
   - Add company name

3. **Create a Link**:
   - As Consumer, request a link to the Supplier
   - As Supplier, approve the link

4. **Add Products**:
   - As Supplier, add products to your catalog

5. **Place an Order**:
   - As Consumer, browse the supplier's products
   - Add to cart and place an order

## 🔄 Stopping the Application

### Docker Compose
```bash
cd backend
docker-compose down
```

### Development Mode
Press `Ctrl+C` in the terminal windows running the backend and frontend.

## 🐛 Troubleshooting

### Backend won't start
- Check if PostgreSQL is running: `docker ps`
- Check logs: `cd backend && docker-compose logs -f`
- Ensure port 8000 is not in use

### Frontend won't start
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Ensure port 3000 is not in use
- Check Node.js version: `node --version` (should be 16+)

### Database connection errors
- Verify DATABASE_URL in backend configuration
- Check if PostgreSQL is accepting connections
- Run migrations: `docker-compose exec api alembic upgrade head`

### CORS errors
- Backend is configured to allow all origins in development
- Check that backend is running on port 8000
- Verify API_BASE_URL in `frontend/services/api.ts`

## 📝 Notes

- The backend runs on port 8000
- The frontend runs on port 3000
- PostgreSQL runs on port 5432
- All passwords/secrets should be changed for production use
