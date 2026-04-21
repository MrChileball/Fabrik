#!/bin/bash

# ============================================
# PrintRobot Development Script
# Runs FastAPI backend + Pnpm frontend in parallel
# Usage: ./scripts/dev.sh
# ============================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Print functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Configuration
PYTHON_VERSION="3.10"
VENV_DIR="backend/venv"
PYTHON_EXECUTABLE="python3"

print_header "PrintRobot Development Server"

# Check prerequisites
print_info "Checking prerequisites..."

# Check Python
if ! command -v $PYTHON_EXECUTABLE &> /dev/null; then
    print_error "Python 3.10+ not found. Install Python and try again."
    exit 1
fi
print_info "✓ Python found: $($PYTHON_EXECUTABLE --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Install Node.js and try again."
    exit 1
fi
print_info "✓ Node.js found: $(node --version)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    print_warn "pnpm not found. Installing globally..."
    npm install -g pnpm
fi
print_info "✓ pnpm found: $(pnpm --version)"

# Create virtual environment if not exists
if [ ! -d "$VENV_DIR" ]; then
    print_info "Creating Python virtual environment..."
    $PYTHON_EXECUTABLE -m venv "$VENV_DIR"
    if [ $? -ne 0 ]; then
        print_error "Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
print_info "Activating Python virtual environment..."
source "$VENV_DIR/bin/activate" || source "$VENV_DIR/Scripts/activate"

# Load environment variables
if [ -f ".env.local" ]; then
    print_info "Loading .env.local..."
    set -a
    source .env.local
    set +a
else
    print_warn ".env.local not found. Copy .env.example and adjust values."
    print_info "Creating .env.local from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_warn "Please edit .env.local with your settings before running again."
        exit 1
    fi
fi

# Install Python dependencies
if [ -f "requirements.txt" ]; then
    print_info "Installing/updating Python dependencies..."
    pip install --upgrade pip setuptools wheel > /dev/null 2>&1
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        print_error "Failed to install Python dependencies"
        exit 1
    fi
else
    print_error "requirements.txt not found in root directory"
    exit 1
fi

# Install Node dependencies
print_info "Installing Node dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile > /dev/null 2>&1
else
    pnpm install > /dev/null 2>&1
fi

# Run Alembic migrations (if backend structure exists)
if [ -d "backend/alembic" ]; then
    print_info "Running database migrations..."
    cd backend
    alembic upgrade head 2>/dev/null || print_warn "Alembic migration skipped or failed"
    cd ..
else
    print_warn "backend/alembic not found. Skipping migrations."
    print_info "Create your first migration with: cd backend && alembic revision --autogenerate -m 'initial'"
fi

# Function to cleanup on exit
cleanup() {
    print_info "Shutting down development servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    deactivate 2>/dev/null || true
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Start backend
print_header "Starting Backend (FastAPI + Uvicorn)"
print_info "Backend URL: http://localhost:8000"
print_info "Swagger Docs: http://localhost:8000/docs"

cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
print_header "Starting Frontend (SvelteKit + Vite)"
print_info "Frontend URL: http://localhost:5173"

pnpm dev &
FRONTEND_PID=$!

# Show status
print_header "Development Servers Running"
echo ""
echo -e "${GREEN}✓ Backend:${NC}  http://localhost:8000"
echo -e "${GREEN}✓ Frontend:${NC} http://localhost:5173"
echo -e "${GREEN}✓ API Docs:${NC}  http://localhost:8000/docs"
echo ""
print_warn "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
