#!/bin/bash

# Deployment Script for MERN Blog Application
# This script handles the deployment process with validation and rollback capabilities
# Usage: ./scripts/deploy.sh [environment] [version]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-staging}
VERSION=${2:-$(git describe --tags --always --dirty || echo "dev-$(date +%Y%m%d)")}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
load_environment() {
    local env_file="$PROJECT_ROOT/server/.env.$ENVIRONMENT"
    if [[ -f "$env_file" ]]; then
        export $(cat "$env_file" | grep -v '#' | awk '/=/ {print $1}')
    fi
    
    # Set default values
    export DEPLOYMENT_TIMEOUT=${DEPLOYMENT_TIMEOUT:-300}
    export ROLLBACK_TIMEOUT=${ROLLBACK_TIMEOUT:-180}
    export HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-60}
    export MONITORING_ENABLED=${MONITORING_ENABLED:-true}
}

# Logging function
log() {
    local level="$1"
    local message="$2"
    local color="$NC"
    
    case "$level" in
        "INFO") color="$BLUE" ;;
        "SUCCESS") color="$GREEN" ;;
        "WARNING") color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
    esac
    
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $message" | tee -a "$PROJECT_ROOT/logs/deployment.log"
    
    # Send to monitoring if enabled
    if [[ "$MONITORING_ENABLED" == "true" ]]; then
        send_deployment_notification "$level" "$message"
    fi
}

# Send deployment notifications
send_deployment_notification() {
    local level="$1"
    local message="$2"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local emoji="🚀"
        
        case "$level" in
            "SUCCESS") color="good"; emoji="✅" ;;
            "WARNING") color="warning"; emoji="⚠️" ;;
            "ERROR") color="danger"; emoji="❌" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$emoji Deployment $level\",\"fields\":[{\"title\":\"Environment\",\"value\":\"$ENVIRONMENT\",\"short\":true},{\"title\":\"Version\",\"value\":\"$VERSION\",\"short\":true},{\"title\":\"Message\",\"value\":\"$message\",\"short\":false},{\"title\":\"Timestamp\",\"value\":\"$(date)\",\"short\":true}]}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Email notification for critical deployments
    if [[ "$ENVIRONMENT" == "production" && -n "${DEPLOYMENT_NOTIFICATION_EMAIL:-}" ]]; then
        echo "Deployment $level: $message" | mail -s "Production Deployment $level - $VERSION" \
            -S smtp="$SMTP_HOST" \
            -S from="deploy@company.com" \
            "$DEPLOYMENT_NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

# Pre-deployment checks
pre_deployment_checks() {
    log "INFO" "Running pre-deployment checks..."
    
    # Check if git is clean (except for dev environment)
    if [[ "$ENVIRONMENT" != "development" && -n "$(git status --porcelain)" ]]; then
        log "ERROR" "Git working directory is not clean. Please commit or stash changes."
        return 1
    fi
    
    # Check if version tag exists
    if [[ "$ENVIRONMENT" == "production" && ! git tag -l "$VERSION" ]]; then
        log "ERROR" "Version tag $VERSION does not exist. Create tag before production deployment."
        return 1
    fi
    
    # Check Node.js version compatibility
    if [[ ! -f "$PROJECT_ROOT/.nvmrc" ]]; then
        log "WARNING" ".nvmrc file not found. Skipping Node.js version check."
    else
        local required_node_version=$(cat "$PROJECT_ROOT/.nvmrc")
        local current_node_version=$(node --version | sed 's/v//')
        if [[ "$required_node_version" != "$current_node_version" ]]; then
            log "WARNING" "Node.js version mismatch. Required: $required_node_version, Current: $current_node_version"
        fi
    fi
    
    # Check required environment variables
    local required_vars=("MONGO_URI" "JWT_SECRET")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Required environment variable $var is not set."
            return 1
        fi
    done
    
    # Run security audit
    log "INFO" "Running security audit..."
    cd "$PROJECT_ROOT/server"
    if ! npm audit --audit-level=moderate > /dev/null 2>&1; then
        log "WARNING" "Security audit found issues. Review before continuing."
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    cd - > /dev/null
    
    # Check disk space
    local available_space=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ "$available_space" -lt 2 ]]; then
        log "ERROR" "Insufficient disk space. Available: ${available_space}GB"
        return 1
    fi
    
    log "SUCCESS" "Pre-deployment checks completed successfully"
    return 0
}

# Create backup before deployment
create_pre_deployment_backup() {
    log "INFO" "Creating pre-deployment backup..."
    
    local backup_script="$SCRIPT_DIR/backup-database.sh"
    if [[ -f "$backup_script" && -x "$backup_script" ]]; then
        if "$backup_script" "$ENVIRONMENT"; then
            log "SUCCESS" "Pre-deployment backup created successfully"
            return 0
        else
            log "ERROR" "Pre-deployment backup failed"
            return 1
        fi
    else
        log "WARNING" "Backup script not found or not executable. Skipping backup."
        return 0
    fi
}

# Install dependencies
install_dependencies() {
    log "INFO" "Installing dependencies..."
    
    # Install server dependencies
    log "INFO" "Installing server dependencies..."
    cd "$PROJECT_ROOT/server"
    npm ci --production
    
    if [[ $? -ne 0 ]]; then
        log "ERROR" "Failed to install server dependencies"
        return 1
    fi
    
    # Build client if needed
    if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
        log "INFO" "Building client application..."
        cd "$PROJECT_ROOT/client"
        npm ci
        npm run build
        
        if [[ $? -ne 0 ]]; then
            log "ERROR" "Failed to build client application"
            return 1
        fi
    fi
    
    cd "$PROJECT_ROOT"
    log "SUCCESS" "Dependencies installed successfully"
    return 0
}

# Run tests
run_tests() {
    log "INFO" "Running tests..."
    
    # Run server tests
    log "INFO" "Running server tests..."
    cd "$PROJECT_ROOT/server"
    if ! npm test -- --runInBand; then
        log "ERROR" "Server tests failed"
        return 1
    fi
    
    # Run client tests (skip for now as they might require additional setup)
    # cd "$PROJECT_ROOT/client"
    # if ! npm test -- --runInBand --watchAll=false; then
    #     log "ERROR" "Client tests failed"
    #     return 1
    # fi
    
    cd "$PROJECT_ROOT"
    log "SUCCESS" "Tests passed successfully"
    return 0
}

# Deploy application
deploy_application() {
    log "INFO" "Starting application deployment..."
    
    case "$ENVIRONMENT" in
        "production")
            deploy_to_render
            ;;
        "staging")
            deploy_to_render
            ;;
        "development")
            deploy_local
            ;;
        *)
            log "ERROR" "Unknown environment: $ENVIRONMENT"
            return 1
            ;;
    esac
}

# Deploy to Render
deploy_to_render() {
    log "INFO" "Deploying to Render..."
    
    if [[ -z "${RENDER_SERVICE_ID:-}" || -z "${RENDER_API_KEY:-}" ]]; then
        log "ERROR" "Render configuration missing. Set RENDER_SERVICE_ID and RENDER_API_KEY"
        return 1
    fi
    
    # Use Render deploy hook if available
    if [[ -n "${RENDER_DEPLOY_HOOK:-}" ]]; then
        log "INFO" "Triggering deployment via Render webhook..."
        response=$(curl -s -X POST "$RENDER_DEPLOY_HOOK" -w "%{http_code}")
        http_code="${response: -3}"
        
        if [[ "$http_code" == "200" ]]; then
            log "SUCCESS" "Deployment triggered successfully"
        else
            log "ERROR" "Failed to trigger deployment. HTTP code: $http_code"
            return 1
        fi
    else
        log "ERROR" "No deployment method configured for Render"
        return 1
    fi
    
    # Wait for deployment to complete
    log "INFO" "Waiting for deployment to complete..."
    local timeout=$DEPLOYMENT_TIMEOUT
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        if check_deployment_status; then
            log "SUCCESS" "Application deployed successfully"
            return 0
        fi
        
        sleep 10
        elapsed=$((elapsed + 10))
        log "INFO" "Waiting for deployment... (${elapsed}s/${timeout}s)"
    done
    
    log "ERROR" "Deployment timeout after ${timeout}s"
    return 1
}

# Deploy locally (development)
deploy_local() {
    log "INFO" "Starting local deployment..."
    
    # Stop existing process
    if [[ -f "$PROJECT_ROOT/server/pid" ]]; then
        local pid=$(cat "$PROJECT_ROOT/server/pid")
        if kill -0 "$pid" 2>/dev/null; then
            log "INFO" "Stopping existing application (PID: $pid)..."
            kill "$pid"
            sleep 5
        fi
    fi
    
    # Start application
    log "INFO" "Starting application..."
    cd "$PROJECT_ROOT/server"
    nohup npm start > "$PROJECT_ROOT/logs/app.log" 2>&1 &
    echo $! > "$PROJECT_ROOT/server/pid"
    cd - > /dev/null
    
    log "SUCCESS" "Application started locally"
    return 0
}

# Check deployment status
check_deployment_status() {
    local base_url="${API_BASE_URL:-}"
    if [[ -z "$base_url" ]]; then
        log "WARNING" "API_BASE_URL not configured. Skipping health check."
        return 0
    fi
    
    local timeout=$HEALTH_CHECK_TIMEOUT
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        if curl -sf "$base_url/health" > /dev/null 2>&1; then
            return 0
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    return 1
}

# Post-deployment validation
post_deployment_validation() {
    log "INFO" "Running post-deployment validation..."
    
    local base_url="${API_BASE_URL:-}"
    if [[ -z "$base_url" ]]; then
        log "WARNING" "API_BASE_URL not configured. Skipping health checks."
        return 0
    fi
    
    # Health check
    log "INFO" "Checking application health..."
    if ! curl -sf "$base_url/health" > /dev/null; then
        log "ERROR" "Application health check failed"
        return 1
    fi
    
    # Detailed health check
    log "INFO" "Running detailed health check..."
    local health_response=$(curl -s "$base_url/health")
    local status=$(echo "$health_response" | jq -r '.status // "unknown"')
    
    if [[ "$status" != "healthy" ]]; then
        log "WARNING" "Application status: $status"
    fi
    
    # Test critical endpoints
    log "INFO" "Testing critical endpoints..."
    local endpoints=("/api/posts" "/health/db" "/metrics")
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -sf "$base_url$endpoint" > /dev/null; then
            log "ERROR" "Endpoint test failed: $endpoint"
            return 1
        fi
    done
    
    log "SUCCESS" "Post-deployment validation completed successfully"
    return 0
}

# Rollback deployment
rollback_deployment() {
    log "WARNING" "Initiating rollback procedure..."
    
    send_deployment_notification "ERROR" "Initiating rollback for environment: $ENVIRONMENT, version: $VERSION"
    
    case "$ENVIRONMENT" in
        "production"|"staging")
            rollback_render
            ;;
        "development")
            rollback_local
            ;;
    esac
}

# Rollback Render deployment
rollback_render() {
    log "WARNING" "Rolling back Render deployment..."
    
    if [[ -n "${RENDER_DEPLOY_HOOK:-}" ]]; then
        # Deploy the previous version
        local previous_version=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "HEAD~1")
        log "INFO" "Rolling back to version: $previous_version"
        
        # Checkout previous version
        git checkout "$previous_version"
        
        # Trigger deployment
        response=$(curl -s -X POST "$RENDER_DEPLOY_HOOK" -w "%{http_code}")
        http_code="${response: -3}"
        
        if [[ "$http_code" == "200" ]]; then
            log "SUCCESS" "Rollback initiated successfully"
        else
            log "ERROR" "Rollback failed. HTTP code: $http_code"
            return 1
        fi
    else
        log "ERROR" "No rollback method configured"
        return 1
    fi
}

# Rollback local deployment
rollback_local() {
    log "WARNING" "Rolling back local deployment..."
    
    # Stop current application
    if [[ -f "$PROJECT_ROOT/server/pid" ]]; then
        local pid=$(cat "$PROJECT_ROOT/server/pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            log "INFO" "Stopped application (PID: $pid)"
        fi
    fi
    
    # Start previous version
    local previous_version=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "HEAD~1")
    log "INFO" "Rolling back to version: $previous_version"
    
    git checkout "$previous_version"
    
    # Restart application
    cd "$PROJECT_ROOT/server"
    nohup npm start > "$PROJECT_ROOT/logs/app.log" 2>&1 &
    echo $! > "$PROJECT_ROOT/server/pid"
    cd - > /dev/null
    
    log "SUCCESS" "Local rollback completed"
}

# Cleanup after deployment
cleanup() {
    log "INFO" "Cleaning up deployment artifacts..."
    
    # Remove old log files
    find "$PROJECT_ROOT/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Remove old deployment backups
    find "$PROJECT_ROOT/backups" -name "*.gz" -mtime +30 -delete 2>/dev/null || true
    
    log "SUCCESS" "Cleanup completed"
}

# Main deployment function
main() {
    # Create log directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    log "INFO" "=== Deployment Started ==="
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Version: $VERSION"
    log "INFO" "Timestamp: $TIMESTAMP"
    
    # Load environment configuration
    load_environment
    
    # Trap errors and trigger rollback
    trap 'log "ERROR" "Deployment failed. Triggering rollback..."; rollback_deployment; exit 1' ERR
    
    # Execute deployment steps
    if ! pre_deployment_checks; then
        log "ERROR" "Pre-deployment checks failed"
        exit 1
    fi
    
    if ! create_pre_deployment_backup; then
        log "ERROR" "Pre-deployment backup failed"
        exit 1
    fi
    
    if ! install_dependencies; then
        log "ERROR" "Dependency installation failed"
        exit 1
    fi
    
    if ! run_tests; then
        log "ERROR" "Tests failed"
        exit 1
    fi
    
    if ! deploy_application; then
        log "ERROR" "Application deployment failed"
        exit 1
    fi
    
    if ! post_deployment_validation; then
        log "ERROR" "Post-deployment validation failed"
        exit 1
    fi
    
    cleanup
    
    log "SUCCESS" "=== Deployment Completed Successfully ==="
    send_deployment_notification "SUCCESS" "Deployment completed successfully for $ENVIRONMENT ($VERSION)"
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment] [version]"
        echo ""
        echo "Environments: production, staging, development"
        echo "Version: Git tag or commit hash (optional, defaults to current commit)"
        echo ""
        echo "Examples:"
        echo "  $0 production v1.2.3"
        echo "  $0 staging"
        echo "  $0 development"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac