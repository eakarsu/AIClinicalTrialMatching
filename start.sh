#!/bin/bash

# AI Clinical Trial Matching - Start Script
# This script sets up and starts the entire application

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║       AI Clinical Trial Matching Platform           ║"
echo "║       Intelligent Patient-Trial Matching            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo -e "${GREEN}[OK]${NC} Environment variables loaded"
else
  echo -e "${RED}[ERROR]${NC} .env file not found! Please create one."
  exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-4000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# Function to kill processes on ports
cleanup_ports() {
  echo -e "${YELLOW}[CLEANUP]${NC} Checking for processes on ports $BACKEND_PORT and $FRONTEND_PORT..."

  for PORT in $BACKEND_PORT $FRONTEND_PORT; do
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
      echo -e "${YELLOW}[CLEANUP]${NC} Killing process on port $PORT (PID: $PID)"
      kill -9 $PID 2>/dev/null || true
      sleep 1
    fi
  done
  echo -e "${GREEN}[OK]${NC} Ports cleaned up"
}

# Function to check if PostgreSQL is running
check_postgres() {
  echo -e "${BLUE}[CHECK]${NC} Checking PostgreSQL..."
  if command -v pg_isready &>/dev/null; then
    if pg_isready -q -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432}; then
      echo -e "${GREEN}[OK]${NC} PostgreSQL is running"
    else
      echo -e "${YELLOW}[WARN]${NC} PostgreSQL not responding. Attempting to start..."
      if command -v brew &>/dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        sleep 2
      fi
      if ! pg_isready -q -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432}; then
        echo -e "${RED}[ERROR]${NC} Cannot connect to PostgreSQL. Please start it manually."
        exit 1
      fi
    fi
  else
    echo -e "${YELLOW}[WARN]${NC} pg_isready not found. Assuming PostgreSQL is running..."
  fi
}

# Function to create database if not exists
setup_database() {
  echo -e "${BLUE}[DB]${NC} Setting up database..."
  DB_EXISTS=$(psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "${DB_NAME:-clinical_trial_matching}" && echo "yes" || echo "no")

  if [ "$DB_EXISTS" = "no" ]; then
    echo -e "${YELLOW}[DB]${NC} Creating database '${DB_NAME:-clinical_trial_matching}'..."
    createdb -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} "${DB_NAME:-clinical_trial_matching}" 2>/dev/null || true
    echo -e "${GREEN}[OK]${NC} Database created"
  else
    echo -e "${GREEN}[OK]${NC} Database already exists"
  fi
}

# Function to install dependencies
install_deps() {
  echo -e "${BLUE}[DEPS]${NC} Installing backend dependencies..."
  cd "$SCRIPT_DIR/backend"
  if [ ! -d "node_modules" ]; then
    npm install --silent 2>&1 | tail -1
  else
    echo -e "${GREEN}[OK]${NC} Backend dependencies already installed"
  fi

  echo -e "${BLUE}[DEPS]${NC} Installing frontend dependencies..."
  cd "$SCRIPT_DIR/frontend"
  if [ ! -d "node_modules" ]; then
    npm install --silent 2>&1 | tail -1
  else
    echo -e "${GREEN}[OK]${NC} Frontend dependencies already installed"
  fi
  cd "$SCRIPT_DIR"
}

# Function to seed database
seed_database() {
  echo -e "${BLUE}[SEED]${NC} Seeding database with sample data..."
  cd "$SCRIPT_DIR/backend"
  node src/seeds/seed.js
  echo -e "${GREEN}[OK]${NC} Database seeded successfully"
  cd "$SCRIPT_DIR"
}

# Cleanup function for graceful shutdown
cleanup() {
  echo ""
  echo -e "${YELLOW}[SHUTDOWN]${NC} Shutting down services..."

  if [ -n "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}[OK]${NC} Backend stopped"
  fi

  if [ -n "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}[OK]${NC} Frontend stopped"
  fi

  # Clean up port processes
  for PORT in $BACKEND_PORT $FRONTEND_PORT; do
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
      kill -9 $PID 2>/dev/null || true
    fi
  done

  echo -e "${GREEN}[OK]${NC} All services stopped. Goodbye!"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Main execution
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 1: Cleanup Ports${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cleanup_ports

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 2: Check PostgreSQL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
check_postgres

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 3: Setup Database${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
setup_database

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 4: Install Dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
install_deps

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 5: Seed Database${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
seed_database

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 6: Start Services (with hot reload)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Start backend with nodemon (hot reload)
echo -e "${BLUE}[START]${NC} Starting backend on port $BACKEND_PORT with hot reload..."
cd "$SCRIPT_DIR/backend"
npx nodemon src/index.js &
BACKEND_PID=$!
cd "$SCRIPT_DIR"
sleep 3

# Start frontend with React hot reload
echo -e "${BLUE}[START]${NC} Starting frontend on port $FRONTEND_PORT with hot reload..."
cd "$SCRIPT_DIR/frontend"
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Application Started Successfully!                  ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  Frontend:  http://localhost:${FRONTEND_PORT}                    ║${NC}"
echo -e "${GREEN}║  Backend:   http://localhost:${BACKEND_PORT}/api                 ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  Login:     admin@clinicaltrial.com / password123    ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  Hot reload is enabled - changes auto-refresh        ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
