#!/bin/bash

###############################################################################
# JobProof Test Data Generation - Shell Scripts
#
# Practical scripts for running test data generation from the command line.
# These scripts encapsulate common patterns and best practices.
#
# Usage:
#   source ./lib/testing/scripts.sh
#   generate_small
#   generate_medium
#   generate_large
#   cleanup_workspace "my-workspace"
#
# Or run directly:
#   bash ./lib/testing/scripts.sh --help
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

# Check if environment variables are set
check_env() {
  if [ -z "$VITE_SUPABASE_URL" ]; then
    echo -e "${RED}❌ Error: VITE_SUPABASE_URL not set${NC}"
    return 1
  fi

  if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Error: VITE_SUPABASE_ANON_KEY not set${NC}"
    return 1
  fi

  return 0
}

# Print separator
print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ============================================================================
# DATASET GENERATION FUNCTIONS
# ============================================================================

# Generate small dataset (100 jobs)
generate_small() {
  local workspace="${1:-staging-workspace}"

  print_header "Generating Small Dataset (100 jobs) - Workspace: $workspace"

  check_env || return 1

  npx tsx lib/testing/generateTestData.ts \
    --size=small \
    --workspace="$workspace" \
    --cleanup

  echo -e "${GREEN}✅ Small dataset generation complete!${NC}"
}

# Generate medium dataset (500 jobs)
generate_medium() {
  local workspace="${1:-staging-workspace}"

  print_header "Generating Medium Dataset (500 jobs) - Workspace: $workspace"

  check_env || return 1

  npx tsx lib/testing/generateTestData.ts \
    --size=medium \
    --workspace="$workspace" \
    --cleanup

  echo -e "${GREEN}✅ Medium dataset generation complete!${NC}"
}

# Generate large dataset (10,000 jobs)
generate_large() {
  local workspace="${1:-staging-workspace}"

  print_header "Generating Large Dataset (10,000 jobs) - Workspace: $workspace"
  echo -e "${YELLOW}⚠️  Warning: This may take 5-15 minutes and use significant resources${NC}"
  echo ""

  check_env || return 1

  # Increase Node memory for large dataset
  NODE_OPTIONS=--max-old-space-size=4096 \
  npx tsx lib/testing/generateTestData.ts \
    --size=large \
    --workspace="$workspace" \
    --cleanup

  echo -e "${GREEN}✅ Large dataset generation complete!${NC}"
}

# Generate custom dataset
generate_custom() {
  local workspace="${1:-staging-workspace}"
  local sealed_recent="${2:-25}"
  local sealed_archive="${3:-25}"
  local active="${4:-25}"
  local load="${5:-25}"

  print_header "Generating Custom Dataset"
  echo "Configuration:"
  echo "  Sealed recent: $sealed_recent"
  echo "  Sealed archive: $sealed_archive"
  echo "  Active: $active"
  echo "  Load test: $load"
  echo "  Workspace: $workspace"
  echo ""

  check_env || return 1

  npx tsx lib/testing/generateTestData.ts \
    --size=custom \
    --workspace="$workspace" \
    --sealed-recent="$sealed_recent" \
    --sealed-archive="$sealed_archive" \
    --active="$active" \
    --load="$load"

  echo -e "${GREEN}✅ Custom dataset generation complete!${NC}"
}

# Clean up test data for a workspace
cleanup_workspace() {
  local workspace="${1:-staging-workspace}"

  print_header "Cleaning up Workspace: $workspace"

  check_env || return 1

  npx tsx lib/testing/generateTestData.ts \
    --workspace="$workspace" \
    --action=cleanup

  echo -e "${GREEN}✅ Workspace cleanup complete!${NC}"
}

# ============================================================================
# BATCH OPERATIONS
# ============================================================================

# Generate datasets for multiple workspaces in parallel
generate_multi_workspace() {
  local num_workspaces="${1:-3}"
  local size="${2:-small}"

  print_header "Generating $size Dataset for $num_workspaces Workspaces (Parallel)"

  check_env || return 1

  local pids=()

  for ((i = 1; i <= num_workspaces; i++)); do
    local workspace="parallel-test-$i-$(date +%s)"
    echo "🚀 Starting generation for workspace: $workspace"

    npx tsx lib/testing/generateTestData.ts \
      --size="$size" \
      --workspace="$workspace" \
      --cleanup &

    pids+=($!)
    sleep 1  # Slight delay between starts to avoid API rate limits
  done

  echo ""
  echo "Waiting for all generations to complete..."

  # Wait for all background processes
  local failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      ((failed++))
    fi
  done

  echo ""
  if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All generations completed successfully!${NC}"
  else
    echo -e "${RED}❌ $failed generation(s) failed${NC}"
    return 1
  fi
}

# Generate datasets sequentially with delays
generate_staggered() {
  local num_batches="${1:-5}"
  local size="${2:-small}"
  local delay_seconds="${3:-60}"

  print_header "Generating $num_batches Batches of $size Dataset (Staggered)"

  check_env || return 1

  for ((i = 1; i <= num_batches; i++)); do
    local workspace="staggered-batch-$i-$(date +%s)"

    echo -e "${BLUE}[Batch $i/$num_batches]${NC} Starting generation..."
    echo "  Workspace: $workspace"
    echo "  Dataset: $size"
    echo ""

    npx tsx lib/testing/generateTestData.ts \
      --size="$size" \
      --workspace="$workspace" \
      --cleanup

    if [ $i -lt $num_batches ]; then
      echo -e "${YELLOW}⏳ Waiting ${delay_seconds}s before next batch...${NC}"
      sleep "$delay_seconds"
    fi
  done

  echo -e "${GREEN}✅ All batches generated successfully!${NC}"
}

# Generate full staging environment
setup_staging() {
  print_header "Setting up Full Staging Environment"

  echo "This will generate:"
  echo "  - Small dataset in 'staging-workspace' (fresh)"
  echo "  - Medium dataset in 'staging-data-qa'"
  echo "  - Load test setup"
  echo ""

  check_env || return 1

  local start_time=$(date +%s)

  # Create main staging workspace
  echo -e "${BLUE}[1/3]${NC} Generating main staging data..."
  generate_small "staging-workspace" || return 1

  echo ""

  # Create QA workspace
  echo -e "${BLUE}[2/3]${NC} Generating QA data..."
  generate_medium "staging-data-qa" || return 1

  echo ""

  # Create load test workspace
  echo -e "${BLUE}[3/3]${NC} Generating load test data..."
  generate_large "staging-load-test" &
  local load_test_pid=$!

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  wait $load_test_pid

  echo ""
  echo -e "${GREEN}✅ Staging environment setup complete!${NC}"
  echo "Duration: $((duration / 60))m $((duration % 60))s"
  echo ""
  echo "Workspaces created:"
  echo "  ✓ staging-workspace (100 jobs)"
  echo "  ✓ staging-data-qa (500 jobs)"
  echo "  ✓ staging-load-test (10,000 jobs)"
}

# ============================================================================
# VERIFICATION & CLEANUP
# ============================================================================

# List all test workspaces
list_test_workspaces() {
  print_header "Test Workspaces with 'test-' or 'staging-' Prefix"

  echo "To list workspaces in your Supabase instance:"
  echo ""
  echo "  1. Open Supabase Dashboard"
  echo "  2. Go to SQL Editor"
  echo "  3. Run query:"
  echo ""
  echo "    SELECT DISTINCT workspace_id FROM jobs"
  echo "    WHERE workspace_id LIKE 'test-%'"
  echo "    OR workspace_id LIKE 'staging-%'"
  echo "    ORDER BY workspace_id;"
  echo ""
}

# Cleanup all test workspaces (DANGEROUS!)
cleanup_all_test_data() {
  print_header "⚠️  DANGEROUS: Cleanup All Test Data"

  echo "This will delete ALL jobs in test workspaces!"
  echo ""
  read -p "Type 'yes' to confirm: " confirm

  if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    return 1
  fi

  check_env || return 1

  # Clean common test workspaces
  local test_workspaces=(
    "staging-workspace"
    "staging-data-qa"
    "staging-load-test"
    "test-workspace"
  )

  for workspace in "${test_workspaces[@]}"; do
    echo -e "${YELLOW}Cleaning: $workspace${NC}"
    cleanup_workspace "$workspace" || true
  done

  echo -e "${GREEN}✅ Cleanup complete!${NC}"
}

# ============================================================================
# MONITORING & LOGGING
# ============================================================================

# Generate test data with logging
generate_with_log() {
  local size="${1:-small}"
  local workspace="${2:-staging-workspace}"
  local log_file="test-data-gen-$(date +%Y%m%d-%H%M%S).log"

  print_header "Generating $size Dataset with Logging"
  echo "Log file: $log_file"
  echo ""

  check_env || return 1

  npx tsx lib/testing/generateTestData.ts \
    --size="$size" \
    --workspace="$workspace" \
    --cleanup \
    2>&1 | tee "$log_file"

  echo ""
  echo -e "${GREEN}✅ Generation complete. Log saved to: $log_file${NC}"
}

# Run continuous monitoring (generates data and monitors)
monitor_generation() {
  local size="${1:-small}"
  local interval="${2:-3600}"  # 1 hour default

  print_header "Continuous Generation Monitor"
  echo "Size: $size"
  echo "Interval: ${interval}s ($((interval / 60))m)"
  echo ""
  echo "Press Ctrl+C to stop"
  echo ""

  while true; do
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp]${NC} Generating test data..."

    local workspace="monitor-$(date +%s)"
    npx tsx lib/testing/generateTestData.ts \
      --size="$size" \
      --workspace="$workspace" \
      --cleanup || echo -e "${RED}Generation failed${NC}"

    echo -e "${BLUE}[$timestamp]${NC} Waiting ${interval}s before next generation..."
    sleep "$interval"
  done
}

# ============================================================================
# HELP & DOCUMENTATION
# ============================================================================

print_help() {
  cat << 'EOF'
JobProof Test Data Generation - Shell Scripts

USAGE:
  source ./lib/testing/scripts.sh
  function_name [arguments]

BASIC FUNCTIONS:
  generate_small [workspace]
  generate_medium [workspace]
  generate_large [workspace]
  cleanup_workspace [workspace]

BATCH OPERATIONS:
  generate_multi_workspace [count] [size]
  generate_staggered [batches] [size] [delay_seconds]
  setup_staging

MONITORING & LOGGING:
  generate_with_log [size] [workspace]
  monitor_generation [size] [interval_seconds]
  list_test_workspaces

CLEANUP:
  cleanup_all_test_data

EXAMPLES:
  # Generate small dataset
  generate_small

  # Generate with custom workspace
  generate_medium my-workspace

  # Parallel generation for 5 workspaces
  generate_multi_workspace 5 small

  # Staggered generation (batch every 2 minutes)
  generate_staggered 10 medium 120

  # Full staging setup
  setup_staging

  # Generate with logging
  generate_with_log large

  # Continuous monitoring (every 30 minutes)
  monitor_generation small 1800

ENVIRONMENT VARIABLES:
  VITE_SUPABASE_URL         - Supabase project URL (required)
  VITE_SUPABASE_ANON_KEY    - Supabase anonymous key (required)

EOF
}

# ============================================================================
# MAIN - Run if executed directly
# ============================================================================

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  print_help
  exit 0
fi

# If sourced, functions will be available
# If executed directly and argument provided, run that function
if [ $# -gt 0 ] && [ "$0" == "${BASH_SOURCE[0]}" ]; then
  # Called directly with function name
  "$@"
fi
