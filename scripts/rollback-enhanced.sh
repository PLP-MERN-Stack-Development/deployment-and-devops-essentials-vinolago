#!/bin/bash

# Enhanced Rollback Script for MERN Blog Application
# This script provides comprehensive rollback capabilities with validation and monitoring
# Usage: ./scripts/rollback.sh [environment] [target-version] [rollback-type]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-production}
TARGET_VERSION=${2:-"previous"}
ROLLBACK_TYPE=${3:-"full"} # full, application, database, configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Load environment variables
load_environment() {
    local env_file="$PROJECT_ROOT/server/.env.$ENVIRONMENT"
    if [[ -f "$env_file" ]]; then
        export $(cat "$env_file" | grep -v '#' | awk '/=/ {print $1}')
    fi
    
    # Set default values
    export ROLLBACK_TIMEOUT=${ROLLBACK_TIMEOUT:-300}
    export HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-60}
    export BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
}

# Enhanced logging function
log() {
    local level="$1"
    local message="$2"
    local color="$NC"
    
    case "$level" in
        "INFO") color="$BLUE" ;;
        "SUCCESS") color="$GREEN" ;;
        "WARNING") color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
        "ROLLBACK") color="$PURPLE" ;;
    esac
    
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $message" | tee -a "$PROJECT_ROOT/logs/rollback.log"
    
    # Send to monitoring if enabled
    if [[ "${MONITORING_ENABLED:-true}" == "true" ]]; then
        send_rollback_notification "$level" "$message"
    fi
}

# Send rollback notifications
send_rollback_notification() {
    local level="$1"
    local message="$2"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local emoji="🔄"
        
        case "$level" in
            "SUCCESS") color="good"; emoji="✅" ;;
            "WARNING") color="warning"; emoji="⚠️" ;;
            "ERROR") color="danger"; emoji="❌" ;;
            "ROLLBACK") color="warning"; emoji="🔄" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$emoji Rollback $level\",\"fields\":[{\"title\":\"Environment\",\"value\":\"$ENVIRONMENT\",\"short\":true},{\"title\":\"Target Version\",\"value\":\"$TARGET_VERSION\",\"short\":true},{\"title\":\"Rollback Type\",\"value\":\"$ROLLBACK_TYPE\",\"short\":true},{\"title\":\"Message\",\"value\":\"$message\",\"short\":false},{\"title\":\"Timestamp\",\"value\":\"$(date)\",\"short\":true}]}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Email notification for critical rollbacks
    if [[ "$ENVIRONMENT" == "production" && -n "${ROLLBACK_NOTIFICATION_EMAIL:-}" ]]; then
        echo "Rollback $level: $message" | mail -s "Production Rollback $level - $ENVIRONMENT - $TARGET_VERSION" \
            -S smtp="$SMTP_HOST" \
            -S from="rollback@company.com" \
            "$ROLLBACK_NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

# Get available rollback versions
get_available_versions() {
    log "INFO" "Getting available rollback versions..."
    
    # Get git tags and commits
    local versions=()
    
    # Add current version
    versions+=("current")
    
    # Add recent commits
    while IFS= read -r line; do
        versions+=("$line")
    done < <(git log --oneline --skip=1 -n 10 | cut -d' ' -f1)
    
    # Add recent tags
    while IFS= read -r line; do
        versions+=("$line")
    done < <(git tag -l --sort=-version:refname | head -5)
    
    printf '%s\n' "${versions[@]}"
}

# Validate rollback target
validate_rollback_target() {
    local target="$1"
    
    log "INFO" "Validating rollback target: $target"
    
    if [[ "$target" == "current" ]]; then
        return 0
    fi
    
    # Check if it's a commit hash
    if [[ "$target" =~ ^[0-9a-f]{7,40}$ ]]; then
        if git cat-file -e "$target" 2>/dev/null; then
            log "SUCCESS" "Valid commit hash: $target"
            return 0
        else
            log "ERROR" "Invalid commit hash: $target"
            return 1
        fi
    fi
    
    # Check if it's a tag
    if git tag -l "$target" > /dev/null; then
        log "SUCCESS" "Valid tag: $target"
        return 0
    fi
    
    # Check if it's a branch
    if git show-ref --verify --quiet "refs/heads/$target"; then
        log "SUCCESS" "Valid branch: $target"
        return 0
    fi
    
    log "ERROR" "Invalid rollback target: $target"
    log "INFO" "Available options:"
    get_available_versions | while read -r version; do
        echo "  - $version"
    done
    
    return 1
}

# Create pre-rollback backup
create_pre_rollback_backup() {
    log "ROLLBACK" "Creating pre-rollback backup..."
    
    local backup_script="$SCRIPT_DIR/backup-database.sh"
    if [[ -f "$backup_script" && -x "$backup_script" ]]; then
        if "$backup_script" "$ENVIRONMENT"; then
            log "SUCCESS" "Pre-rollback backup created successfully"
            return 0
        else
            log "WARNING" "Pre-rollback backup failed, continuing anyway"
            return 0
        fi
    else
        log "WARNING" "Backup script not found. Skipping backup."
        return 0
    fi
}

# Rollback application code
rollback_application() {
    log "ROLLBACK" "Rolling back application code to $TARGET_VERSION..."
    
    local current_commit=$(git rev-parse HEAD)
    
    if [[ "$TARGET_VERSION" == "current" ]]; then
        log "INFO" "No application rollback needed (current version)"
        return 0
    fi
    
    # Checkout target version
    if git checkout "$TARGET_VERSION" 2>/dev/null; then
        local target_commit=$(git rev-parse HEAD)
        log "SUCCESS" "Rolled back application from $current_commit to $target_commit"
        
        # If deploying to Render or similar, trigger deployment
        if [[ -n "${RENDER_DEPLOY_HOOK:-}" ]]; then
            log "INFO" "Triggering deployment to $TARGET_VERSION..."
            curl -s -X POST "$RENDER_DEPLOY_HOOK" > /dev/null
        fi
    else
        log "ERROR" "Failed to checkout target version: $TARGET_VERSION"
        return 1
    fi
}

# Rollback database
rollback_database() {
    log "ROLLBACK" "Rolling back database to pre-deployment state..."
    
    local backup_file
    backup_file=$(find "$PROJECT_ROOT/backups" -name "mern_blog_${ENVIRONMENT}_*.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$backup_file" ]]; then
        log "WARNING" "No backup file found for rollback"
        return 0
    fi
    
    log "INFO" "Using backup file: $backup_file"
    
    # Test restoration first
    log "INFO" "Testing database restoration..."
    if command -v mongorestore &> /dev/null; then
        local test_dir=$(mktemp -d)
        cd "$test_dir"
        
        if mongorestore --uri="$MONGO_URI" --dryRun --gzip --archive="$backup_file" --nsInclude="*"; then
            log "SUCCESS" "Database rollback test passed"
        else
            log "ERROR" "Database rollback test failed"
            cd - > /dev/null
            rm -rf "$test_dir"
            return 1
        fi
        
        cd - > /dev/null
        rm -rf "$test_dir"
        
        # Confirm with user for production
        if [[ "$ENVIRONMENT" == "production" ]]; then
            read -p "⚠️  This will overwrite the production database. Are you sure? (yes/NO): " -r
            if [[ "$REPLY" != "yes" ]]; then
                log "INFO" "Database rollback cancelled by user"
                return 0
            fi
        fi
        
        # Perform actual rollback
        log "INFO" "Performing database restoration..."
        if mongorestore --uri="$MONGO_URI" --drop --gzip --archive="$backup_file" --nsInclude="*"; then
            log "SUCCESS" "Database rollback completed successfully"
        else
            log "ERROR" "Database rollback failed"
            return 1
        fi
    else
        log "ERROR" "mongorestore not found. Cannot perform database rollback."
        return 1
    fi
}

# Rollback configuration
rollback_configuration() {
    log "ROLLBACK" "Rolling back configuration..."
    
    # This would typically involve reverting environment variables or config files
    # For now, we'll just log the action
    log "INFO" "Configuration rollback not implemented yet"
    
    # Example implementation for future:
    # if [[ -f "$PROJECT_ROOT/configs/.env.$ENVIRONMENT.backup" ]]; then
    #     cp "$PROJECT_ROOT/configs/.env.$ENVIRONMENT.backup" "$PROJECT_ROOT/configs/.env.$ENVIRONMENT"
    #     log "SUCCESS" "Configuration rolled back"
    # else
    #     log "WARNING" "No configuration backup found"
    # fi
    
    return 0
}

# Check service health
check_service_health() {
    local service_url="$1"
    local service_name="$2"
    local timeout="${3:-60}"
    
    log "INFO" "Checking health of $service_name..."
    
    local start_time=$(date +%s)
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        if curl -sf "$service_url/health" > /dev/null 2>&1; then
            log "SUCCESS" "$service_name is healthy"
            return 0
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
        log "INFO" "Waiting for $service_name to be healthy... (${elapsed}s/${timeout}s)"
    done
    
    log "ERROR" "$service_name health check timeout"
    return 1
}

# Comprehensive health check
comprehensive_health_check() {
    log "INFO" "Running comprehensive health check..."
    
    local base_url="${API_BASE_URL:-}"
    local all_healthy=true
    
    if [[ -n "$base_url" ]]; then
        # Basic health check
        if ! check_service_health "$base_url" "API" "$HEALTH_CHECK_TIMEOUT"; then
            all_healthy=false
        fi
        
        # Detailed endpoint checks
        local endpoints=("/api/posts" "/health/db" "/metrics")
        
        for endpoint in "${endpoints[@]}"; do
            if ! curl -sf "$base_url$endpoint" > /dev/null; then
                log "WARNING" "Endpoint check failed: $endpoint"
                all_healthy=false
            fi
        done
    fi
    
    # Database connection check
    if ! mongosh "$MONGO_URI" --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        log "ERROR" "Database connection failed"
        all_healthy=false
    fi
    
    if [[ "$all_healthy" == "true" ]]; then
        log "SUCCESS" "All services are healthy"
        return 0
    else
        log "ERROR" "Some services are unhealthy"
        return 1
    fi
}

# Send post-rollback summary
send_rollback_summary() {
    local status="$1"
    local duration="$2"
    
    log "INFO" "Sending rollback summary..."
    
    cat > "$PROJECT_ROOT/logs/rollback-summary-$TIMESTAMP.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "target_version": "$TARGET_VERSION",
    "rollback_type": "$ROLLBACK_TYPE",
    "status": "$status",
    "duration_seconds": $duration,
    "triggered_by": "$(whoami)",
    "previous_version": "$(git rev-parse HEAD^)",
    "current_version": "$(git rev-parse HEAD)"
}
EOF
    
    # Upload summary to monitoring system if configured
    if [[ -n "${MONITORING_API_URL:-}" ]]; then
        curl -X POST -H 'Content-Type: application/json' \
            -d @"$PROJECT_ROOT/logs/rollback-summary-$TIMESTAMP.json" \
            "$MONITORING_API_URL/rollback-events" 2>/dev/null || true
    fi
}

# Main rollback function
main() {
    # Create log directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    log "ROLLBACK" "=== Rollback Started ==="
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Target Version: $TARGET_VERSION"
    log "INFO" "Rollback Type: $ROLLBACK_TYPE"
    log "INFO" "Timestamp: $TIMESTAMP"
    
    # Load environment configuration
    load_environment
    
    # Validate rollback target
    if ! validate_rollback_target "$TARGET_VERSION"; then
        log "ERROR" "Invalid rollback target"
        exit 1
    fi
    
    # Get rollback start time
    local rollback_start=$(date +%s)
    
    # Trap errors and provide cleanup
    trap 'log "ERROR" "Rollback failed. Cleanup in progress..."; cleanup_rollback; exit 1' ERR
    
    # Execute rollback steps based on type
    case "$ROLLBACK_TYPE" in
        "application")
            if ! rollback_application; then
                exit 1
            fi
            ;;
        "database")
            if ! create_pre_rollback_backup; then
                log "WARNING" "Pre-rollback backup failed, continuing..."
            fi
            if ! rollback_database; then
                exit 1
            fi
            ;;
        "configuration")
            if ! rollback_configuration; then
                exit 1
            fi
            ;;
        "full")
            if ! create_pre_rollback_backup; then
                log "WARNING" "Pre-rollback backup failed, continuing..."
            fi
            if ! rollback_application; then
                exit 1
            fi
            if ! rollback_database; then
                log "WARNING" "Database rollback failed, application rollback completed"
            fi
            if ! rollback_configuration; then
                log "WARNING" "Configuration rollback failed"
            fi
            ;;
        *)
            log "ERROR" "Unknown rollback type: $ROLLBACK_TYPE"
            exit 1
            ;;
    esac
    
    # Wait for services to stabilize
    log "INFO" "Waiting for services to stabilize..."
    sleep 30
    
    # Run comprehensive health check
    if ! comprehensive_health_check; then
        log "ERROR" "Post-rollback health check failed"
        exit 1
    fi
    
    # Calculate rollback duration
    local rollback_end=$(date +%s)
    local rollback_duration=$((rollback_end - rollback_start))
    
    log "SUCCESS" "=== Rollback Completed Successfully ==="
    log "INFO" "Rollback duration: ${rollback_duration}s"
    
    send_rollback_notification "SUCCESS" "Rollback completed successfully for $ENVIRONMENT to $TARGET_VERSION"
    send_rollback_summary "success" "$rollback_duration"
}

# Cleanup function
cleanup_rollback() {
    log "INFO" "Cleaning up rollback artifacts..."
    
    # Reset git to previous state if needed
    if [[ -f "$PROJECT_ROOT/.git/rollback_backup" ]]; then
        local backup_commit=$(cat "$PROJECT_ROOT/.git/rollback_backup")
        git checkout "$backup_commit" 2>/dev/null || true
        rm -f "$PROJECT_ROOT/.git/rollback_backup"
    fi
    
    # Remove temporary files
    find "$PROJECT_ROOT" -name "rollback-*.tmp" -delete 2>/dev/null || true
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment] [target-version] [rollback-type]"
        echo ""
        echo "Environments: production, staging, development"
        echo "Target Version: commit hash, tag, 'previous', or 'current'"
        echo "Rollback Types: full, application, database, configuration"
        echo ""
        echo "Examples:"
        echo "  $0 production v1.2.3 full"
        echo "  $0 staging previous application"
        echo "  $0 development current database"
        echo ""
        echo "Available versions:"
        get_available_versions
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac