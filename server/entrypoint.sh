#!/bin/sh
set -e

echo "Running database migration..."
npx prisma migrate deploy

echo "Starting server..."
exec node dist/src/main
