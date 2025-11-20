#!/bin/bash

# SCP Platform Launch Script
echo "🚀 Starting Supplier Consumer Platform..."

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to start backend
start_backend() {
    echo "🔧 Starting Backend (FastAPI + PostgreSQL)..."
    cd backend
    
    # Build and start backend services
    docker-compose up --build -d
    
    if [ $? -eq 0 ]; then
        echo "✅ Backend started successfully!"
        echo "📍 API is available at: http://localhost:8000"
        echo "📍 API Docs (Swagger) at: http://localhost:8000/docs"
        echo "🗄️  PostgreSQL is running on port 5432"
    else
        echo "❌ Failed to start backend"
        exit 1
    fi
    
    cd ..
}

# Function to start frontend
start_frontend() {
    echo "🎨 Starting Frontend (React + Vite)..."
    cd frontend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    # Start development server
    echo "🔄 Starting development server..."
    npm run dev &
    FRONTEND_PID=$!
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend started successfully!"
        echo "📍 Frontend is available at: http://localhost:3000"
    else
        echo "❌ Failed to start frontend"
        exit 1
    fi
    
    cd ..
}

# Function to wait for backend to be ready
wait_for_backend() {
    echo "⏳ Waiting for backend to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:8000/docs &>/dev/null; then
            echo "✅ Backend is ready!"
            break
        fi
        
        echo "🔄 Attempt $attempt/$max_attempts - Backend not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo "❌ Backend failed to start within expected time"
        exit 1
    fi
}

# Function to run database migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    cd backend
    
    # Wait a bit more for PostgreSQL to be fully ready
    sleep 5
    
    # Run migrations using docker exec
    docker-compose exec api alembic upgrade head
    
    if [ $? -eq 0 ]; then
        echo "✅ Database migrations completed successfully!"
    else
        echo "⚠️  Migrations failed - this might be normal on first run"
    fi
    
    cd ..
}

# Main execution
echo "🌟 Starting SCP Platform Setup..."
echo "================================="

# Start backend first
start_backend

# Wait for backend to be ready
wait_for_backend

# Run database migrations
run_migrations

# Start frontend
start_frontend

echo ""
echo "🎉 SCP Platform is now running!"
echo "================================="
echo "🌐 Frontend: http://localhost:3000"
echo "🚀 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "💡 To stop the application:"
echo "   - Press Ctrl+C to stop the frontend"
echo "   - Run 'cd backend && docker-compose down' to stop backend"
echo ""
echo "📝 Check the logs if you encounter any issues:"
echo "   - Frontend logs: visible in this terminal"
echo "   - Backend logs: cd backend && docker-compose logs -f"

# Keep the script running to show frontend logs
wait $FRONTEND_PID