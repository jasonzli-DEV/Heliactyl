#!/bin/bash
# Rename Enderactyl to Enderactyl across the entire codebase

echo "Renaming Enderactyl to Enderactyl..."

# Rename in all source files
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o -name "*.prisma" -o -name "*.txt" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -exec sed -i '' 's/Enderactyl/Enderactyl/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o -name "*.prisma" -o -name "*.txt" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -exec sed -i '' 's/enderactyl/enderactyl/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o -name "*.prisma" -o -name "*.txt" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -exec sed -i '' 's/ENDERACTYL/ENDERACTYL/g' {} \;

echo "Done! Enderactyl renamed to Enderactyl"
echo "Remember to:"
echo "1. Rename database file: mv prisma/enderactyl.db prisma/enderactyl.db"
echo "2. Update .env DATABASE_URL"
echo "3. Rebuild: npm run build"
