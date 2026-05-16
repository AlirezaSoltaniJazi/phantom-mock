#!/usr/bin/env bash
# validate-chrome-extension.sh — Manifest + structure convention checker for phantom-mock
# Run from project root: bash .data/skills/chromeExtensionDeveloper/scripts/validate-chrome-extension.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

error() {
  echo -e "${RED}ERROR${NC}: $1"
  ((ERRORS++))
}

warn() {
  echo -e "${YELLOW}WARN${NC}: $1"
  ((WARNINGS++))
}

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
}

echo "=== Phantom Mock Extension Validator ==="
echo ""

# --- Manifest Check ---
echo "--- Manifest ---"

if [ ! -f "manifest.json" ]; then
  error "manifest.json not found in project root"
else
  # Check manifest version
  MV=$(node -e "console.log(require('./manifest.json').manifest_version)" 2>/dev/null || echo "")
  if [ "$MV" = "3" ]; then
    pass "Manifest V3 detected"
  elif [ "$MV" = "2" ]; then
    error "Manifest V2 detected — must use V3"
  else
    error "Could not determine manifest version"
  fi

  # Check for broad permissions
  if node -e "const m=require('./manifest.json'); process.exit(JSON.stringify(m.host_permissions||[]).includes('<all_urls>')?1:0)" 2>/dev/null; then
    pass "No broad <all_urls> in host_permissions"
  else
    warn "Broad <all_urls> in host_permissions — consider narrowing"
  fi

  # Check service worker is module type
  SW_TYPE=$(node -e "const m=require('./manifest.json'); console.log(m.background?.type||'')" 2>/dev/null || echo "")
  if [ "$SW_TYPE" = "module" ]; then
    pass "Service worker type is 'module'"
  elif [ -n "$SW_TYPE" ]; then
    warn "Service worker type should be 'module' for ES imports"
  fi
fi

echo ""

# --- Structure Check ---
echo "--- Project Structure ---"

# Required directories
for dir in src src/background src/shared; do
  if [ -d "$dir" ]; then
    pass "Directory exists: $dir"
  else
    warn "Expected directory missing: $dir"
  fi
done

# Check for TypeScript config
if [ -f "tsconfig.json" ]; then
  pass "tsconfig.json found"

  # Check strict mode
  STRICT=$(node -e "const t=require('./tsconfig.json'); console.log(t.compilerOptions?.strict||false)" 2>/dev/null || echo "")
  if [ "$STRICT" = "true" ]; then
    pass "TypeScript strict mode enabled"
  else
    warn "TypeScript strict mode should be enabled"
  fi
else
  warn "tsconfig.json not found"
fi

# Check for package.json
if [ -f "package.json" ]; then
  pass "package.json found"
else
  warn "package.json not found"
fi

echo ""

# --- Code Quality Check ---
echo "--- Code Quality ---"

# Check for any usage
if [ -d "src" ]; then
  ANY_COUNT=$(grep -r ": any" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  if [ "$ANY_COUNT" -gt "0" ]; then
    warn "Found $ANY_COUNT occurrences of ': any' in src/ — should use typed alternatives"
  else
    pass "No 'any' types found in src/"
  fi

  # Check for eval usage
  EVAL_COUNT=$(grep -r "eval(" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  if [ "$EVAL_COUNT" -gt "0" ]; then
    error "Found eval() usage in src/ — forbidden in MV3 extensions"
  else
    pass "No eval() usage found"
  fi

  # Check for new Function usage
  NEW_FUNC_COUNT=$(grep -r "new Function" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  if [ "$NEW_FUNC_COUNT" -gt "0" ]; then
    error "Found new Function() usage in src/ — forbidden in MV3 extensions"
  else
    pass "No new Function() usage found"
  fi

  # Check for default exports
  DEFAULT_EXPORT_COUNT=$(grep -r "export default" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  if [ "$DEFAULT_EXPORT_COUNT" -gt "0" ]; then
    warn "Found $DEFAULT_EXPORT_COUNT default exports in src/ — prefer named exports"
  else
    pass "No default exports found (using named exports)"
  fi

  # Check for innerHTML usage
  INNERHTML_COUNT=$(grep -r "innerHTML" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "test" | wc -l | tr -d ' ')
  if [ "$INNERHTML_COUNT" -gt "0" ]; then
    warn "Found $INNERHTML_COUNT innerHTML usages — verify no user input is injected unsanitized"
  else
    pass "No innerHTML usage found"
  fi
fi

echo ""

# --- Summary ---
echo "=== Summary ==="
echo -e "Errors: ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"

if [ "$ERRORS" -gt "0" ]; then
  echo -e "${RED}FAILED${NC} — fix errors before proceeding"
  exit 1
elif [ "$WARNINGS" -gt "0" ]; then
  echo -e "${YELLOW}PASSED WITH WARNINGS${NC}"
  exit 0
else
  echo -e "${GREEN}ALL CHECKS PASSED${NC}"
  exit 0
fi
