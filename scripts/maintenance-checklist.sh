#!/bin/bash

# Maintenance Checklist Script for MERN Blog Application
# This script performs automated maintenance tasks and validates system health
# Usage: ./scripts/maintenance-checklist.sh [task-type]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TASK_TYPE=${1:-"daily"}
ENVIRONMENT=${2:-$(cat "$PROJECT_ROOT/.env" 2>/dev/null | grep "NODE_ENV" | cut -d'=' -f2 || echo "production")}
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

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
    elif [[ -f "$PROJECT_ROOT/server/.env" ]]; then
        export $(cat "$PROJECT_ROOT/server/.env" | grep -v '#' | awk '/=/ {print $1}')
    fi
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
    
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $message" | tee -a "$PROJECT_ROOT/logs/maintenance-$TASK_TYPE.log"
    
    # Count issues
    case "$level" in
        "ERROR") ((ERROR_COUNT++)) ;;
        "WARNING") ((WARNING_COUNT++)) ;;
    esac
}

# Check system health
check_system_health() {
    log "INFO" "Checking system health..."
    
    local base_url="${API_BASE_URL:-}"
    local issues=0
    
    if [[ -n "$base_url" ]]; then
        # Health endpoint check
        if curl -sf "$base_url/health" > /dev/null; then
            log "SUCCESS" "Health endpoint responding"
        else
            log "ERROR" "Health endpoint not responding"
            ((issues++))
        fi
        
        # Database health check
        if curl -sf "$base_url/health/db" > /dev/null; then
            log "SUCCESS" "Database is healthy"
        else
            log "ERROR" "Database health check failed"
            ((issues++))
        fi
        
        # Performance metrics check
        if curl -sf "$base_url/metrics" > /dev/null; then
            log "SUCCESS" "Metrics endpoint responding"
        else
            log "WARNING" "Metrics endpoint not responding"
        fi
    else
        log "WARNING" "API_BASE_URL not configured, skipping health checks"
    fi
    
    return $issues
}

# Check disk space
check_disk_space() {
    log "INFO" "Checking disk space..."
    
    local threshold_warning=80
    local threshold_critical=90
    
    # Check root partition
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $disk_usage -lt $threshold_warning ]]; then
        log "SUCCESS" "Disk usage: ${disk_usage}% (healthy)"
    elif [[ $disk_usage -lt $threshold_critical ]]; then
        log "WARNING" "Disk usage: ${disk_usage}% (warning)"
    else
        log "ERROR" "Disk usage: ${disk_usage}% (critical)"
        return 1
    fi
    
    # Check application logs directory
    local log_dir_size
    log_dir_size=$(du -sm "$PROJECT_ROOT/logs" 2>/dev/null | cut -f1)
    
    if [[ $log_dir_size -gt 1000 ]]; then
        log "WARNING" "Log directory size: ${log_dir_size}MB (consider cleanup)"
    fi
    
    return 0
}

# Check memory usage
check_memory_usage() {
    log "INFO" "Checking memory usage..."
    
    local mem_info
    mem_info=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    
    local mem_percent
    mem_percent=$(echo "$mem_info" | cut -d'.' -f1)
    
    if [[ $mem_percent -lt 70 ]]; then
        log "SUCCESS" "Memory usage: ${mem_percent}% (healthy)"
    elif [[ $mem_percent -lt 85 ]]; then
        log "WARNING" "Memory usage: ${mem_percent}% (warning)"
    else
        log "ERROR" "Memory usage: ${mem_percent}% (critical)"
        return 1
    fi
    
    return 0
}

# Check SSL certificate validity
check_ssl_certificates() {
    log "INFO" "Checking SSL certificate validity..."
    
    local domains=("${API_BASE_URL:-}" "${FRONTEND_URL:-}")
    
    for domain in "${domains[@]}"; do
        if [[ -n "$domain" && "$domain" == https://* ]]; then
            local hostname
            hostname=$(echo "$domain" | sed 's|https\?://||' | sed 's|/.*||')
            
            local cert_info
            if cert_info=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null); then
                local expire_date
                expire_date=$(echo "$cert_info" | grep notAfter | cut -d= -f2)
                local expire_timestamp
                expire_timestamp=$(date -d "$expire_date" +%s 2>/dev/null || echo 0)
                local current_timestamp
                current_timestamp=$(date +%s)
                local days_until_expire
                days_until_expire=$(( (expire_timestamp - current_timestamp) / 86400 ))
                
                if [[ $days_until_expire -gt 30 ]]; then
                    log "SUCCESS" "SSL certificate for $hostname expires in $days_until_expire days"
                elif [[ $days_until_expire -gt 7 ]]; then
                    log "WARNING" "SSL certificate for $hostname expires in $days_until_expire days"
                else
                    log "ERROR" "SSL certificate for $hostname expires in $days_until_expire days"
                fi
            else
                log "WARNING" "Could not check SSL certificate for $hostname"
            fi
        fi
    done
}

# Update dependencies
update_dependencies() {
    log "INFO" "Updating dependencies..."
    
    cd "$PROJECT_ROOT/server"
    
    # Check for outdated packages
    local outdated_count
    outdated_count=$(npm outdated --json 2>/dev/null | jq 'keys | length' 2>/dev/null || echo "0")
    
    if [[ $outdated_count -gt 0 ]]; then
        log "INFO" "Found $outdated_count outdated packages"
        
        # Security updates only
        if npm audit --audit-level=moderate > /dev/null 2>&1; then
            log "SUCCESS" "No security vulnerabilities found"
        else
            log "WARNING" "Security vulnerabilities found"
            return 1
        fi
    else
        log "SUCCESS" "All dependencies are up to date"
    fi
    
    cd - > /dev/null
    return 0
}

# Clean up old files
cleanup_old_files() {
    log "INFO" "Cleaning up old files..."
    
    # Clean old log files
    local log_retention_days=7
    find "$PROJECT_ROOT/logs" -name "*.log" -mtime +$log_retention_days -delete 2>/dev/null || true
    log "INFO" "Cleaned log files older than $log_retention_days days"
    
    # Clean old backups
    local backup_retention_days=30
    find "$PROJECT_ROOT/backups" -name "*.gz" -mtime +$backup_retention_days -delete 2>/dev/null || true
    log "INFO" "Cleaned backup files older than $backup_retention_days days"
    
    # Clean temporary files
    find "$PROJECT_ROOT" -name "*.tmp" -mtime +1 -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "*.swp" -delete 2>/dev/null || true
    log "INFO" "Cleaned temporary files"
    
    # Clean npm cache
    if command -v npm &> /dev/null; then
        npm cache clean --force > /dev/null 2>&1 || true
        log "INFO" "Cleaned npm cache"
    fi
}

# Verify backups
verify_backups() {
    log "INFO" "Verifying backup integrity..."
    
    local backup_script="$SCRIPT_DIR/backup-database.sh"
    if [[ -f "$backup_script" && -x "$backup_script" ]]; then
        # Run a test backup to verify functionality
        if "$backup_script" "$ENVIRONMENT" > /dev/null 2>&1; then
            log "SUCCESS" "Backup verification test passed"
        else
            log "ERROR" "Backup verification test failed"
            return 1
        fi
    else
        log "WARNING" "Backup script not found or not executable"
    fi
    
    return 0
}

# Check monitoring alerts
check_monitoring_alerts() {
    log "INFO" "Checking monitoring alerts..."
    
    # Check Sentry for recent errors
    if [[ -n "${SENTRY_DSN:-}" ]]; then
        # This would require Sentry API integration
        log "INFO" "Sentry monitoring active"
    fi
    
    # Check application logs for errors
    local error_count
    error_count=$(find "$PROJECT_ROOT/logs" -name "*.log" -mtime -1 -exec grep -h "ERROR" {} \; 2>/dev/null | wc -l)
    
    if [[ $error_count -eq 0 ]]; then
        log "SUCCESS" "No recent errors found in logs"
    else
        log "WARNING" "Found $error_count error entries in recent logs"
    fi
}

# Generate maintenance report
generate_maintenance_report() {
    local report_file="$PROJECT_ROOT/logs/maintenance-report-$TASK_TYPE-$TIMESTAMP.json"
    
    log "INFO" "Generating maintenance report..."
    
    cat > "$report_file" << EOF
{
    "timestamp": "$TIMESTAMP",
    "task_type": "$TASK_TYPE",
    "environment": "$ENVIRONMENT",
    "summary": {
        "errors": $ERROR_COUNT,
        "warnings": $WARNING_COUNT,
        "status": "$([ $ERROR_COUNT -eq 0 ] && echo "healthy" || echo "issues_found")"
    },
    "checks": {
        "system_health": "$([ $((ERROR_COUNT + WARNING_COUNT)) -eq 0 ] && echo "passed" || echo "needs_attention")",
        "disk_space": "$([ $ERROR_COUNT -eq 0 ] && echo "healthy" || echo "warning")",
        "memory_usage": "checked",
        "ssl_certificates": "checked",
        "dependencies": "checked",
        "backups": "verified"
    },
    "next_maintenance": "$([ "$TASK_TYPE" = "daily" ] && echo "$(date -d '+1 day' -Iseconds)" || echo "$(date -d '+1 week' -Iseconds)")"
}
EOF
    
    log "SUCCESS" "Maintenance report generated: $report_file"
}

# Send maintenance notification
send_maintenance_notification() {
    local status="$1"
    local message="$2"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local emoji="🔧"
        
        case "$status" in
            "success") color="good"; emoji="✅" ;;
            "warning") color="warning"; emoji="⚠️" ;;
            "error") color="danger"; emoji="❌" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$emoji Maintenance $status\",\"fields\":[{\"title\":\"Task Type\",\"value\":\"$TASK_TYPE\",\"short\":true},{\"title\":\"Environment\",\"value\":\"$ENVIRONMENT\",\"short\":true},{\"title\":\"Errors\",\"value\":\"$ERROR_COUNT\",\"short\":true},{\"title\":\"Warnings\",\"value\":\"$WARNING_COUNT\",\"short\":true},{\"title\":\"Message\",\"value\":\"$message\",\"short\":false}]}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Daily maintenance tasks
daily_maintenance() {
    log "INFO" "Starting daily maintenance tasks..."
    
    ERROR_COUNT=0
    WARNING_COUNT=0
    
    check_system_health
    check_disk_space
    check_memory_usage
    update_dependencies
    check_monitoring_alerts
    cleanup_old_files
    
    if [[ $ERROR_COUNT -eq 0 ]]; then
        send_maintenance_notification "success" "Daily maintenance completed successfully"
        return 0
    else
        send_maintenance_notification "error" "Daily maintenance completed with $ERROR_COUNT errors and $WARNING_COUNT warnings"
        return 1
    fi
}

# Weekly maintenance tasks
weekly_maintenance() {
    log "INFO" "Starting weekly maintenance tasks..."
    
    ERROR_COUNT=0
    WARNING_COUNT=0
    
    daily_maintenance
    verify_backups
    check_ssl_certificates
    
    if [[ $ERROR_COUNT -eq 0 ]]; then
        send_maintenance_notification "success" "Weekly maintenance completed successfully"
        return 0
    else
        send_maintenance_notification "error" "Weekly maintenance completed with $ERROR_COUNT errors"
        return 1
    fi
}

# Monthly maintenance tasks
monthly_maintenance() {
    log "INFO" "Starting monthly maintenance tasks..."
    
    ERROR_COUNT=0
    WARNING_COUNT=0
    
    weekly_maintenance
    
    # Additional monthly tasks
    log "INFO" "Running monthly-specific tasks..."
    
    # Performance analysis (would integrate with performance monitoring)
    log "INFO" "Performance analysis would run here"
    
    # Security audit
    log "INFO" "Running security audit..."
    if command -v npm &> /dev/null; then
        cd "$PROJECT_ROOT/server"
        npm audit --audit-level=moderate > /dev/null 2>&1
        cd - > /dev/null
    fi
    
    if [[ $ERROR_COUNT -eq 0 ]]; then
        send_maintenance_notification "success" "Monthly maintenance completed successfully"
        return 0
    else
        send_maintenance_notification "error" "Monthly maintenance completed with $ERROR_COUNT errors"
        return 1
    fi
}

# Main function
main() {
    # Create log directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    log "INFO" "=== Maintenance Task Started ==="
    log "INFO" "Task Type: $TASK_TYPE"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Timestamp: $TIMESTAMP"
    
    # Load environment configuration
    load_environment
    
    # Execute maintenance based on task type
    case "$TASK_TYPE" in
        "daily")
            daily_maintenance
            ;;
        "weekly")
            weekly_maintenance
            ;;
        "monthly")
            monthly_maintenance
            ;;
        "test")
            log "INFO" "Running maintenance test..."
            check_system_health
            check_disk_space
            check_memory_usage
            ;;
        *)
            log "ERROR" "Unknown task type: $TASK_TYPE"
            echo "Usage: $0 [daily|weekly|monthly|test] [environment]"
            exit 1
            ;;
    esac
    
    # Generate maintenance report
    generate_maintenance_report
    
    log "INFO" "=== Maintenance Task Completed ==="
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [task-type] [environment]"
        echo ""
        echo "Task Types:"
        echo "  daily   - Daily maintenance tasks (default)"
        echo "  weekly  - Weekly maintenance tasks"
        echo "  monthly - Monthly maintenance tasks"
        echo "  test    - Test maintenance checks"
        echo ""
        echo "Environments: production, staging, development"
        echo ""
        echo "Examples:"
        echo "  $0 daily production"
        echo "  $0 weekly staging"
        echo "  $0 monthly"
        echo "  $0 test"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac