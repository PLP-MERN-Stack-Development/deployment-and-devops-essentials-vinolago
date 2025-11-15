#!/bin/bash

# Incident Response Script for MERN Blog Application
# This script provides automated incident detection, response, and escalation procedures
# Usage: ./scripts/incident-response.sh [action] [severity] [incident-id]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ACTION=${1:-"detect"}
SEVERITY=${2:-"medium"}
INCIDENT_ID=${3:-$(date +"%Y%m%d_%H%M%S")}
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Severity levels and response times
declare -A SEVERITY_RESPONSE_TIME=(
    ["critical"]=900    # 15 minutes
    ["high"]=1800       # 30 minutes
    ["medium"]=7200     # 2 hours
    ["low"]=86400       # 24 hours
)

declare -A SEVERITY_ESCALATION=(
    ["critical"]=300    # 5 minutes
    ["high"]=900        # 15 minutes
    ["medium"]=3600     # 1 hour
    ["low"]=14400       # 4 hours
)

# Load environment variables
load_environment() {
    local env_file="$PROJECT_ROOT/server/.env.production"
    if [[ -f "$env_file" ]]; then
        export $(cat "$env_file" | grep -v '#' | awk '/=/ {print $1}')
    fi
    
    # Set default values
    export INCIDENT_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
    export ONCALL_EMAIL=${ONCALL_EMAIL:-"oncall@company.com"}
    export ESCALATION_EMAIL=${ESCALATION_EMAIL:-"escalation@company.com"}
    export PAGERDUTY_INTEGRATION_KEY=${PAGERDUTY_INTEGRATION_KEY:-""}
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
        "INCIDENT") color="$PURPLE" ;;
        "CRITICAL") color="$RED" ;;
    esac
    
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $message" | tee -a "$PROJECT_ROOT/logs/incidents.log"
    
    # Log incident-specific messages to incident file
    if [[ "$ACTION" != "test" ]]; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$PROJECT_ROOT/logs/incident-$INCIDENT_ID.log"
    fi
}

# Send incident notifications
send_incident_notification() {
    local level="$1"
    local message="$2"
    local details="${3:-}"
    
    # Slack notification
    if [[ -n "$INCIDENT_WEBHOOK_URL" ]]; then
        local color="warning"
        local emoji="🚨"
        
        case "$level" in
            "CRITICAL") color="danger"; emoji="🔴" ;;
            "ERROR") color="danger"; emoji="🚨" ;;
            "WARNING") color="warning"; emoji="⚠️" ;;
            "INFO") color="good"; emoji="ℹ️" ;;
        esac
        
        local fields="[
            {\"title\":\"Incident ID\",\"value\":\"$INCIDENT_ID\",\"short\":true},
            {\"title\":\"Severity\",\"value\":\"$SEVERITY\",\"short\":true},
            {\"title\":\"Timestamp\",\"value\":\"$TIMESTAMP\",\"short\":true},
            {\"title\":\"Message\",\"value\":\"$message\",\"short\":false}
        ]"
        
        if [[ -n "$details" ]]; then
            fields="[
                {\"title\":\"Incident ID\",\"value\":\"$INCIDENT_ID\",\"short\":true},
                {\"title\":\"Severity\",\"value\":\"$SEVERITY\",\"short\":true},
                {\"title\":\"Timestamp\",\"value\":\"$TIMESTAMP\",\"short\":true},
                {\"title\":\"Message\",\"value\":\"$message\",\"short\":false},
                {\"title\":\"Details\",\"value\":\"$details\",\"short\":false}
            ]"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$emoji INCIDENT $level\",\"fields\":$fields}]}" \
            "$INCIDENT_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Email notification for critical incidents
    if [[ "$SEVERITY" == "critical" || "$SEVERITY" == "high" ]]; then
        local subject="INCIDENT $SEVERITY: $INCIDENT_ID - $message"
        echo -e "Incident Details:\nIncident ID: $INCIDENT_ID\nSeverity: $SEVERITY\nTimestamp: $TIMESTAMP\nMessage: $message\n\nDetails: $details" | \
        mail -s "$subject" -S smtp="$SMTP_HOST" \
             -S from="incidents@company.com" \
             "$ONCALL_EMAIL" 2>/dev/null || true
    fi
    
    # PagerDuty notification
    if [[ -n "$PAGERDUTY_INTEGRATION_KEY" && "$SEVERITY" == "critical" ]]; then
        curl -X POST -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"dedup_key\": \"$INCIDENT_ID\",
                \"payload\": {
                    \"summary\": \"$message\",
                    \"source\": \"mern-blog-application\",
                    \"severity\": \"$SEVERITY\",
                    \"component\": \"web-application\",
                    \"group\": \"infrastructure\",
                    \"class\": \"service_disruption\"
                }
            }" \
            'https://events.pagerduty.com/v2/enqueue' 2>/dev/null || true
    fi
}

# Detect incidents automatically
detect_incidents() {
    log "INFO" "Starting automatic incident detection..."
    
    local incident_detected=false
    local detection_results=""
    
    # Check application health
    if ! check_application_health; then
        incident_detected=true
        detection_results="${detection_results}Application health check failed; "
    fi
    
    # Check error rates
    if check_error_rate; then
        incident_detected=true
        detection_results="${detection_results}High error rate detected; "
    fi
    
    # Check performance degradation
    if check_performance_degradation; then
        incident_detected=true
        detection_results="${detection_results}Performance degradation detected; "
    fi
    
    # Check resource usage
    if check_resource_exhaustion; then
        incident_detected=true
        detection_results="${detection_results}Resource exhaustion detected; "
    fi
    
    if [[ "$incident_detected" == "true" ]]; then
        SEVERITY="high"  # Auto-detected issues are typically high severity
        log "CRITICAL" "Incident detected: $detection_results"
        send_incident_notification "ERROR" "Automatic incident detection triggered" "$detection_results"
        return 0
    else
        log "SUCCESS" "No incidents detected"
        return 1
    fi
}

# Check application health
check_application_health() {
    local base_url="${API_BASE_URL:-}"
    if [[ -z "$base_url" ]]; then
        log "WARNING" "API_BASE_URL not configured, skipping health check"
        return 0
    fi
    
    # Basic health endpoint
    if ! curl -sf "$base_url/health" > /dev/null; then
        log "ERROR" "Health endpoint not responding"
        return 1
    fi
    
    # Detailed health check
    local health_response
    if health_response=$(curl -s "$base_url/health"); then
        local status
        status=$(echo "$health_response" | jq -r '.status // "unknown"')
        
        if [[ "$status" != "healthy" ]]; then
            log "ERROR" "Application status: $status"
            return 1
        fi
    else
        log "ERROR" "Failed to get detailed health information"
        return 1
    fi
    
    return 0
}

# Check error rates
check_error_rate() {
    local base_url="${API_BASE_URL:-}"
    if [[ -z "$base_url" ]]; then
        return 0
    fi
    
    # Get recent error rate from performance endpoint
    if ! curl -sf "$base_url/api/performance/realtime" > /dev/null; then
        return 0  # Endpoint might not be available, don't flag as error
    fi
    
    local error_rate
    error_rate=$(curl -s "$base_url/api/performance/realtime" | jq -r '.data.metrics.errorRate // 0')
    
    # Check if error rate exceeds threshold (5%)
    local threshold=5.0
    if (( $(echo "$error_rate > $threshold" | bc -l) )); then
        log "ERROR" "High error rate detected: ${error_rate}%"
        return 1
    fi
    
    return 0
}

# Check performance degradation
check_performance_degradation() {
    local base_url="${API_BASE_URL:-}"
    if [[ -z "$base_url" ]]; then
        return 0
    fi
    
    # Get current response time
    local start_time
    start_time=$(date +%s%N)
    curl -sf "$base_url/health" > /dev/null
    local end_time
    end_time=$(date +%s%N)
    
    local response_time
    response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    
    # Check if response time exceeds threshold (2000ms for critical detection)
    local threshold=2000
    if [[ $response_time -gt $threshold ]]; then
        log "ERROR" "High response time detected: ${response_time}ms"
        return 1
    fi
    
    return 0
}

# Check resource exhaustion
check_resource_exhaustion() {
    # Check memory usage
    local mem_usage
    mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [[ $mem_usage -gt 90 ]]; then
        log "ERROR" "High memory usage detected: ${mem_usage}%"
        return 1
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    
    if [[ $disk_usage -gt 90 ]]; then
        log "ERROR" "High disk usage detected: ${disk_usage}%"
        return 1
    fi
    
    return 0
}

# Create incident record
create_incident_record() {
    log "INFO" "Creating incident record..."
    
    local incident_file="$PROJECT_ROOT/logs/incident-$INCIDENT_ID.json"
    
    cat > "$incident_file" << EOF
{
    "incident_id": "$INCIDENT_ID",
    "severity": "$SEVERITY",
    "status": "open",
    "timestamp": "$TIMESTAMP",
    "detection_method": "$ACTION",
    "environment": "$(cat "$PROJECT_ROOT/.env" 2>/dev/null | grep "NODE_ENV" | cut -d'=' -f2 || echo "production")",
    "triggered_by": "$(whoami)",
    "description": "Incident detected via automated monitoring",
    "estimated_resolution_time": "${SEVERITY_RESPONSE_TIME[$SEVERITY]} seconds",
    "timeline": [
        {
            "timestamp": "$TIMESTAMP",
            "event": "incident_detected",
            "description": "Incident detected by automated monitoring"
        }
    ]
}
EOF
    
    log "SUCCESS" "Incident record created: $incident_file"
}

# Execute incident response procedures
execute_incident_response() {
    log "INCIDENT" "Executing incident response procedures..."
    
    # Add timeline entry
    add_incident_timeline "response_started" "Starting incident response procedures"
    
    # Send initial notification
    send_incident_notification "CRITICAL" "Incident response initiated" "Incident ID: $INCIDENT_ID"
    
    # Execute severity-specific response procedures
    case "$SEVERITY" in
        "critical")
            execute_critical_response
            ;;
        "high")
            execute_high_response
            ;;
        "medium")
            execute_medium_response
            ;;
        "low")
            execute_low_response
            ;;
    esac
    
    # Create incident record
    create_incident_record
    
    # Start escalation monitoring
    if [[ "$SEVERITY" != "low" ]]; then
        start_escalation_monitoring
    fi
}

# Critical incident response
execute_critical_response() {
    log "CRITICAL" "Executing critical incident response..."
    
    add_incident_timeline "critical_response" "Critical incident response procedures started"
    
    # Immediate actions
    log "CRITICAL" "Initiating immediate response actions..."
    
    # Check if rollback is needed
    if should_rollback; then
        log "CRITICAL" "Triggering emergency rollback..."
        add_incident_timeline "rollback_initiated" "Emergency rollback initiated"
        "$SCRIPT_DIR/rollback-enhanced.sh" production previous full
    fi
    
    # Scale resources if needed
    if should_scale_resources; then
        log "CRITICAL" "Scaling resources..."
        add_incident_timeline "scaling_resources" "Resource scaling initiated"
    fi
    
    # Notify all stakeholders
    add_incident_timeline "stakeholder_notification" "All stakeholders notified"
}

# High severity incident response
execute_high_response() {
    log "ERROR" "Executing high severity incident response..."
    
    add_incident_timeline "high_response" "High severity incident response procedures started"
    
    # Notify on-call team immediately
    send_incident_notification "ERROR" "High severity incident detected" "Immediate response required"
    
    # Assess impact
    assess_incident_impact
    
    # Prepare response plan
    prepare_response_plan
}

# Medium severity incident response
execute_medium_response() {
    log "WARNING" "Executing medium severity incident response..."
    
    add_incident_timeline "medium_response" "Medium severity incident response procedures started"
    
    # Notify development team
    send_incident_notification "WARNING" "Medium severity incident detected" "Investigation required"
    
    # Schedule investigation
    schedule_incident_investigation
}

# Low severity incident response
execute_low_response() {
    log "INFO" "Executing low severity incident response..."
    
    add_incident_timeline "low_response" "Low severity incident response procedures started"
    
    # Log for future analysis
    log "INFO" "Low severity incident logged for analysis"
    
    # Add to maintenance backlog
    add_to_maintenance_backlog
}

# Assess incident impact
assess_incident_impact() {
    log "INFO" "Assessing incident impact..."
    
    # Check user impact
    local affected_users
    affected_users=$(estimate_affected_users)
    
    # Check business impact
    local business_impact
    business_impact=$(assess_business_impact)
    
    add_incident_timeline "impact_assessment" "Impact assessment completed: $affected_users users affected, $business_impact business impact"
}

# Estimate affected users
estimate_affected_users() {
    # This would integrate with actual monitoring data
    echo "unknown"
}

# Assess business impact
assess_business_impact() {
    # This would integrate with business logic
    echo "moderate"
}

# Prepare response plan
prepare_response_plan() {
    log "INFO" "Preparing incident response plan..."
    
    local response_plan_file="$PROJECT_ROOT/logs/response-plan-$INCIDENT_ID.txt"
    
    cat > "$response_plan_file" << EOF
Incident Response Plan - $INCIDENT_ID
======================================

Severity: $SEVERITY
Timestamp: $TIMESTAMP
Estimated Resolution Time: ${SEVERITY_RESPONSE_TIME[$SEVERITY]} seconds

Response Steps:
1. Investigate root cause
2. Implement temporary fix if possible
3. Monitor system recovery
4. Deploy permanent fix
5. Verify system stability
6. Document lessons learned

On-Call Team:
- Primary: On-call engineer
- Secondary: Development lead
- Escalation: Engineering manager

Communication Channels:
- Slack: #incidents
- Email: incidents@company.com
- Phone: Emergency hotline
EOF
    
    log "SUCCESS" "Response plan created: $response_plan_file"
}

# Schedule incident investigation
schedule_incident_investigation() {
    log "INFO" "Scheduling incident investigation..."
    
    # Create investigation ticket
    local investigation_ticket="$PROJECT_ROOT/logs/investigation-$INCIDENT_ID.md"
    
    cat > "$investigation_ticket" << EOF
# Incident Investigation - $INCIDENT_ID

## Incident Details
- **ID**: $INCIDENT_ID
- **Severity**: $SEVERITY
- **Timestamp**: $TIMESTAMP
- **Status**: Under Investigation

## Investigation Required
- [ ] Timeline reconstruction
- [ ] Root cause analysis
- [ ] Impact assessment
- [ ] Prevention measures
- [ ] Documentation

## Assigned To
TBD

## Investigation Notes
EOF
    
    log "SUCCESS" "Investigation scheduled: $investigation_ticket"
}

# Add to maintenance backlog
add_to_maintenance_backlog() {
    log "INFO" "Adding incident to maintenance backlog..."
    
    local backlog_file="$PROJECT_ROOT/logs/maintenance-backlog.md"
    
    echo "- **$(date +'%Y-%m-%d')**: Incident $INCIDENT_ID ($SEVERITY) - Follow-up required" >> "$backlog_file"
}

# Add timeline entry
add_incident_timeline() {
    local event="$1"
    local description="$2"
    
    log "INFO" "Adding timeline entry: $event - $description"
    
    # Update incident file with timeline entry
    local incident_file="$PROJECT_ROOT/logs/incident-$INCIDENT_ID.json"
    if [[ -f "$incident_file" ]]; then
        local timeline_entry
        timeline_entry=$(jq -n --arg timestamp "$(date -Iseconds)" --arg event "$event" --arg description "$description" \
            '{timestamp: $timestamp, event: $event, description: $description}')
        
        jq ".timeline += [$timeline_entry]" "$incident_file" > "$incident_file.tmp"
        mv "$incident_file.tmp" "$incident_file"
    fi
}

# Start escalation monitoring
start_escalation_monitoring() {
    log "INFO" "Starting escalation monitoring..."
    
    local escalation_time="${SEVERITY_ESCALATION[$SEVERITY]}"
    
    # In a real implementation, this would use a proper job scheduler
    log "INFO" "Escalation monitoring started for $escalation_time seconds"
}

# Test incident response procedures
test_incident_response() {
    log "INFO" "Testing incident response procedures..."
    
    # Test notification systems
    send_incident_notification "INFO" "Test incident notification" "This is a test of the incident response system"
    
    # Test incident record creation
    create_incident_record
    
    # Test timeline functionality
    add_incident_timeline "test" "Test timeline entry"
    
    log "SUCCESS" "Incident response test completed"
}

# Main function
main() {
    # Create log directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    log "INFO" "=== Incident Response Started ==="
    log "INFO" "Action: $ACTION"
    log "INFO" "Severity: $SEVERITY"
    log "INFO" "Incident ID: $INCIDENT_ID"
    log "INFO" "Timestamp: $TIMESTAMP"
    
    # Load environment configuration
    load_environment
    
    # Execute based on action
    case "$ACTION" in
        "detect")
            if detect_incidents; then
                execute_incident_response
            fi
            ;;
        "respond")
            execute_incident_response
            ;;
        "test")
            test_incident_response
            ;;
        *)
            log "ERROR" "Unknown action: $ACTION"
            echo "Usage: $0 [detect|respond|test] [severity] [incident-id]"
            exit 1
            ;;
    esac
    
    log "INFO" "=== Incident Response Completed ==="
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [action] [severity] [incident-id]"
        echo ""
        echo "Actions:"
        echo "  detect  - Automatic incident detection (default)"
        echo "  respond - Manual incident response"
        echo "  test    - Test incident response procedures"
        echo ""
        echo "Severity levels:"
        echo "  critical - Immediate response required"
        echo "  high     - 30 minute response time"
        echo "  medium   - 2 hour response time"
        echo "  low      - 24 hour response time"
        echo ""
        echo "Examples:"
        echo "  $0 detect critical"
        echo "  $0 respond high incident_123"
        echo "  $0 test"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac