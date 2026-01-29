#!/bin/bash
# Seed production DynamoDB tables
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

AWS_REGION=${AWS_REGION:-us-east-1}
TABLE_PREFIX=${DYNAMODB_TABLE_PREFIX:-LogoQuiz}

echo "==> Seeding production DynamoDB"
echo "    Region: $AWS_REGION"
echo "    Table Prefix: $TABLE_PREFIX"
echo ""

# Run the seed script without DYNAMODB_ENDPOINT (uses real AWS)
cd "$PROJECT_ROOT"
AWS_REGION=$AWS_REGION DYNAMODB_TABLE_PREFIX=$TABLE_PREFIX npx tsx scripts/seed-dynamodb.ts

echo ""
echo "==> Production database seeded successfully!"
echo ""
