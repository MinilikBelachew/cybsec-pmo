#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh "${DATABASE_HOST:-postgres}:${DATABASE_PORT:-5432}"
npx prisma migrate deploy
npm run prisma:seed
node dist/src/main

