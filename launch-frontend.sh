#!/bin/bash

# Launch frontend only (backend already running in Docker)
echo "🎨 Starting Frontend..."
echo "📋 Checking backend status..."

# Check if backend is accessible
if curl -f http://localhost:8000/docs &>/dev/null; then
    echo "✅ Backend is already running on http://localhost:8000"
else
    echo "⚠️  Backend is not responding on port 8000"
    echo "Please make sure your backend containers are running:"
    echo "  sudo docker ps"
    exit 1
fi

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start development server
echo "🚀 Starting React development server..."
npm run dev

echo ""
echo "🎉 Frontend is now running!"
echo "=========================="
echo "🌐 Frontend: http://localhost:3000"
echo "🚀 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "💡 Press Ctrl+C to stop the frontend"
