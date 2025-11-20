#!/bin/bash

# SCP Platform Development Launch Script (without Docker)
echo "🚀 Starting SCP Platform in Development Mode..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+"
    exit 1
fi

# Function to setup and start backend
start_backend_dev() {
    echo "🔧 Setting up Backend (Development Mode)..."
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "📦 Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
    
    # Set environment variables for development
    export DATABASE_URL="sqlite:///./scp.db"
    export JWT_SECRET_KEY="dev-secret-key-change-in-production"
    export JWT_REFRESH_SECRET_KEY="dev-refresh-secret-key-change-in-production"
    
    echo "🗄️  Initializing database..."
    # Initialize Alembic if not already done
    if [ ! -d "migrations/versions" ] || [ -z "$(ls -A migrations/versions 2>/dev/null)" ]; then
        echo "Setting up Alembic..."
        alembic init alembic
    fi
    
    # Run migrations
    alembic upgrade head
    
    # Start backend server
    echo "🚀 Starting FastAPI server..."
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    
    echo "✅ Backend started on http://localhost:8000"
    cd ..
}

# Function to start frontend
start_frontend_dev() {
    echo "🎨 Setting up Frontend..."
    cd frontend
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    # Start development server
    echo "🚀 Starting React development server..."
    npm run dev &
    FRONTEND_PID=$!
    
    echo "✅ Frontend started on http://localhost:3000"
    cd ..
}

# Function to wait for backend
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

# Cleanup function
cleanup() {
    echo "🔄 Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
echo "🌟 Starting SCP Platform Development Setup..."
echo "============================================="

# Start backend
start_backend_dev

# Wait for backend to be ready
wait_for_backend

# Start frontend
start_frontend_dev

echo ""
echo "🎉 SCP Platform Development Environment is now running!"
echo "========================================================"
echo "🌐 Frontend: http://localhost:3000"
echo "🚀 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "💡 Press Ctrl+C to stop all services"
echo ""

# Keep the script running
wait $FRONTEND_PID $BACKEND_PID