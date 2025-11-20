#!/bin/bash

echo "🚀 Quick Start - SCP Platform"
echo "=============================="
echo ""

# Check if backend container is running
if sudo docker ps --format '{{.Names}}' | grep -q "sweasssignment-backend"; then
    echo "✅ Backend is already running on http://localhost:8000"
else
    echo "⚠️  Backend container not running. Starting it now..."
    cd backend && sudo docker compose up -d && cd ..
    echo "⏳ Waiting for backend to start..."
    sleep 5
fi

# Check if backend is responding
if curl -s http://localhost:8000/docs > /dev/null; then
    echo "✅ Backend API is ready"
else
    echo "❌ Backend is not responding. Check: sudo docker logs sweasssignment-backend-1"
    exit 1
fi

echo ""
echo "🎨 Starting Frontend..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend
npm run dev
