#!/usr/bin/env bash
# mmp-server 단독 실행
# 사용법: ./dev.sh

set -e
SERVER="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[server]${NC} $*"; }

cd "$SERVER"

info "Prisma 클라이언트 생성..."
./node_modules/.bin/prisma generate

info "DB 마이그레이션 적용..."
./node_modules/.bin/prisma migrate deploy

info "서버 시작 → http://localhost:3000  (로그: server.log)"
npm run start:dev 2>&1 | tee server.log
