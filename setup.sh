#!/bin/bash

# Setup script for Breath! TCG local development

set -e

echo "🎴 Breath! TCG - Setup Script"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your OAuth credentials."
    echo ""
else
    echo "ℹ️  .env file already exists, skipping..."
    echo ""
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected. Starting Postgres container..."
    npm run docker:db
    echo "✅ Postgres container started"
    echo ""
    
    # Wait for Postgres to be ready
    echo "⏳ Waiting for Postgres to be ready..."
    sleep 5
    echo ""
else
    echo "⚠️  Docker not found. Please install Docker or set up Postgres manually."
    echo "   Update DATABASE_URL in .env with your Postgres connection string."
    echo ""
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate
echo "✅ Prisma client generated"
echo ""

# Run migrations (if database is available)
echo "🗄️  Running database migrations..."
if npm run db:migrate -- --name init; then
    echo "✅ Database migrations completed"
else
    echo "⚠️  Database migrations failed. Make sure Postgres is running."
    echo "   You can run 'npm run db:migrate' later when the database is ready."
fi
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your OAuth credentials (Google/Discord)"
echo "2. Run 'npm run server' in one terminal"
echo "3. Run 'npm run dev' in another terminal"
echo "4. Open http://localhost:5173 in your browser"
echo ""
echo "For more information, see README.md"
