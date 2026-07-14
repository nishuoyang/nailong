#!/bin/sh
set -e

echo "Running database migration..."
npx prisma migrate deploy

echo "Seeding initial data..."
node seed.js

echo "Starting server..."
exec node dist/src/main
