#!/usr/bin/env bash
cd "$(dirname "$0")/../../app"
npm run dev:api &
sleep 2
npm run dev
