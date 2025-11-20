#!/bin/bash

# Launch script using existing PostgreSQL container
echo "🚀 Starting SCP Platform with existing PostgreSQL..."

# Check if srs-db container exists and is running
if docker ps --format '{{.Names}}' | grep -q "^srs-db$"; then
    echo "✅ PostgreSQL container 'srs-db' is running"
else
    echo "⚠️  PostgreSQL container 'srs-db' is not running"
    echo "Starting it now..."
    docker start srs-db 2>/dev/null || docker run --name srs-db \
        -e POSTGRES_PASSWORD=secret \
        -e POSTGRES_USER=postgres \
        -p 5432:5432 \
        -d postgres
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to start PostgreSQL. Please check your Docker setup."
        exit 1
    fi
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
fi

# Function to start backend
start_backend() {
    echo "🔧 Starting Backend..."
    cd backend
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo "📦 Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    if [ ! -f "venv/.installed" ]; then
        echo "📦 Installing Python dependencies..."
        pip install -r requirements.txt
        touch venv/.installed
    fi
    
    # Set environment variable
    export DATABASE_URL="postgresql+asyncpg://postgres:secret@localhost:5432/postgres"
    export JWT_SECRET_KEY="dev-secret-key-change-in-production"
    export JWT_REFRESH_SECRET_KEY="dev-refresh-secret-key-change-in-production"
    
    # Run migrations
    echo "🗄️  Running database migrations..."
    alembic upgrade head
    
    # Start backend server
    echo "🚀 Starting FastAPI server..."
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    
    cd ..
    
    # Wait for backend to be ready
    echo "⏳ Waiting for backend to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:8000/docs &>/dev/null; then
            echo "✅ Backend is ready!"
            break
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
}

# Function to start frontend
start_frontend() {
    echo "🎨 Starting Frontend..."
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    # Start development server
    echo "🚀 Starting React development server..."
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
}

# Cleanup function
cleanup() {
    echo ""
    echo "🔄 Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo "✅ Services stopped"
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
start_backend
start_frontend

echo ""
echo "🎉 SCP Platform is now running!"
echo "================================"
echo "🌐 Frontend: http://localhost:3000"
echo "🚀 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo "🗄️  PostgreSQL: localhost:5432 (container: srs-db)"
echo ""
echo "💡 Press Ctrl+C to stop the application"
echo ""

# Keep the script running
wait $FRONTEND_PID $BACKEND_PID
