#!/bin/bash

# Database Backup Script for MERN Blog Application
# This script creates automated backups of the MongoDB database
# Usage: ./scripts/backup-database.sh [environment]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS=30

# Load environment variables
if [[ -f "$PROJECT_ROOT/server/.env.$ENVIRONMENT" ]]; then
    export $(cat "$PROJECT_ROOT/server/.env.$ENVIRONMENT" | grep -v '#' | awk '/=/ {print $1}')
elif [[ -f "$PROJECT_ROOT/server/.env" ]]; then
    export $(cat "$PROJECT_ROOT/server/.env" | grep -v '#' | awk '/=/ {print $1}')
fi

# Configuration validation
MONGO_URI=${MONGO_URI:-"mongodb://localhost:27017/mern_blog"}
S3_BUCKET=${BACKUP_S3_BUCKET:-""}
S3_PREFIX=${BACKUP_S3_PREFIX:-"database-backups"}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-""}

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_DIR/backup.log"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete
    log "Cleanup completed"
}

# Perform database backup
perform_backup() {
    local backup_filename="mern_blog_${ENVIRONMENT}_${TIMESTAMP}.gz"
    local backup_path="$BACKUP_DIR/$backup_filename"
    
    log "Starting database backup..."
    log "Environment: $ENVIRONMENT"
    log "Database URI: ${MONGO_URI%@*}" # Hide credentials
    log "Backup file: $backup_filename"
    
    # Create backup using mongodump
    if command -v mongodump &> /dev/null; then
        log "Using mongodump for backup..."
        mongodump \
            --uri="$MONGO_URI" \
            --gzip \
            --archive="$backup_path" \
            --excludeCollection=system.sessions \
            --excludeCollection=system.users \
            --excludeCollection=logs
    else
        log "ERROR: mongodump not found. Please install MongoDB Database Tools."
        exit 1
    fi
    
    # Verify backup file
    if [[ -f "$backup_path" && -s "$backup_path" ]]; then
        local backup_size=$(du -h "$backup_path" | cut -f1)
        log "Backup completed successfully"
        log "Backup size: $backup_size"
        
        # Encrypt backup if encryption key is provided
        if [[ -n "$ENCRYPTION_KEY" ]]; then
            encrypt_backup "$backup_path"
        fi
        
        # Upload to S3 if bucket is configured
        if [[ -n "$S3_BUCKET" ]]; then
            upload_to_s3 "$backup_path" "$backup_filename"
        fi
        
        # Verify backup integrity
        verify_backup "$backup_path"
        
        return 0
    else
        log "ERROR: Backup file is empty or missing"
        return 1
    fi
}

# Encrypt backup file
encrypt_backup() {
    local file="$1"
    log "Encrypting backup file..."
    
    if command -v gpg &> /dev/null; then
        gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
            --s2k-digest-algo SHA512 --s2k-count 65536 --force-mdc \
            --quiet --no-greeting --batch --yes \
            --passphrase "$ENCRYPTION_KEY" \
            --symmetric --output "${file}.gpg" "$file"
        
        # Remove unencrypted file
        rm "$file"
        log "Backup encrypted successfully"
    else
        log "WARNING: gpg not found. Backup will not be encrypted."
    fi
}

# Upload backup to S3
upload_to_s3() {
    local file="$1"
    local filename="$2"
    local s3_key="${S3_PREFIX}/${ENVIRONMENT}/${filename}"
    
    log "Uploading backup to S3..."
    log "S3 Bucket: $S3_BUCKET"
    log "S3 Key: $s3_key"
    
    if command -v aws &> /dev/null; then
        # Upload to S3 with server-side encryption
        aws s3 cp "$file" "s3://${S3_BUCKET}/${s3_key}" \
            --server-side-encryption AES256 \
            --storage-class STANDARD_IA
        
        if [[ $? -eq 0 ]]; then
            log "Backup uploaded to S3 successfully"
            
            # Create a manifest file for backup tracking
            local manifest_file="$BACKUP_DIR/backup_manifest.json"
            cat > "$manifest_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "filename": "$filename",
    "s3_bucket": "$S3_BUCKET",
    "s3_key": "$s3_key",
    "size": "$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")",
    "encrypted": $([[ -n "$ENCRYPTION_KEY" ]] && echo "true" || echo "false")
}
EOF
            
            # Upload manifest to S3
            aws s3 cp "$manifest_file" "s3://${S3_BUCKET}/${S3_PREFIX}/${ENVIRONMENT}/manifest.json" \
                --server-side-encryption AES256
        else
            log "ERROR: Failed to upload backup to S3"
            return 1
        fi
    else
        log "WARNING: AWS CLI not found. Backup will not be uploaded to S3."
    fi
}

# Verify backup integrity
verify_backup() {
    local file="$1"
    log "Verifying backup integrity..."
    
    if [[ "$file" == *.gpg ]]; then
        # Decrypt and verify encrypted backup
        if command -v gpg &> /dev/null; then
            gpg --quiet --batch --yes --passphrase "$ENCRYPTION_KEY" \
                --decrypt "$file" | gzip -t
        else
            log "ERROR: Cannot verify encrypted backup - gpg not found"
            return 1
        fi
    else
        # Verify unencrypted backup
        gzip -t "$file"
    fi
    
    if [[ $? -eq 0 ]]; then
        log "Backup integrity verification passed"
    else
        log "ERROR: Backup integrity verification failed"
        return 1
    fi
}

# Test backup restoration
test_restoration() {
    local file="$1"
    log "Testing backup restoration (dry run)..."
    
    # Create temporary directory for test
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    if [[ "$file" == *.gpg ]]; then
        # Decrypt and test encrypted backup
        if command -v gpg &> /dev/null; then
            gpg --quiet --batch --yes --passphrase "$ENCRYPTION_KEY" \
                --decrypt "$file" | mongorestore --uri="$MONGO_URI" --dryRun --gzip --archive=/dev/stdin --nsInclude="*"
        else
            log "ERROR: Cannot test encrypted backup restoration - gpg not found"
            return 1
        fi
    else
        # Test unencrypted backup restoration
        mongorestore --uri="$MONGO_URI" --dryRun --gzip --archive="$file" --nsInclude="*"
    fi
    
    if [[ $? -eq 0 ]]; then
        log "Backup restoration test passed"
    else
        log "ERROR: Backup restoration test failed"
        return 1
    fi
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$temp_dir"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Slack notification if webhook is configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local emoji="✅"
        
        case "$status" in
            "success") color="good"; emoji="✅" ;;
            "warning") color="warning"; emoji="⚠️" ;;
            "error") color="danger"; emoji="❌" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$emoji Database Backup $status\",\"fields\":[{\"title\":\"Environment\",\"value\":\"$ENVIRONMENT\",\"short\":true},{\"title\":\"Timestamp\",\"value\":\"$(date)\",\"short\":true},{\"title\":\"Message\",\"value\":\"$message\",\"short\":false}]}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Email notification if SMTP is configured
    if [[ -n "${SMTP_HOST:-}" ]]; then
        echo "$message" | mail -s "Database Backup $status - $ENVIRONMENT" \
            -S smtp="$SMTP_HOST" \
            -S from="backup@company.com" \
            "${BACKUP_NOTIFICATION_EMAIL:-admin@company.com}" 2>/dev/null || true
    fi
}

# Main execution
main() {
    log "=== Database Backup Script Started ==="
    log "Environment: $ENVIRONMENT"
    log "Timestamp: $TIMESTAMP"
    
    # Check if MongoDB is accessible
    if ! mongosh "$MONGO_URI" --eval "db.adminCommand('ping')" &>/dev/null; then
        log "ERROR: Cannot connect to MongoDB"
        send_notification "error" "Cannot connect to MongoDB database"
        exit 1
    fi
    
    # Perform cleanup of old backups
    cleanup_old_backups
    
    # Perform backup
    local backup_filename="mern_blog_${ENVIRONMENT}_${TIMESTAMP}.gz"
    local backup_path="$BACKUP_DIR/$backup_filename"
    
    if perform_backup; then
        log "Database backup completed successfully"
        send_notification "success" "Database backup completed: $backup_filename"
        
        # Test restoration (optional, takes more time)
        if [[ "${TEST_RESTORATION:-false}" == "true" ]]; then
            test_restoration "$backup_path"
        fi
    else
        log "ERROR: Database backup failed"
        send_notification "error" "Database backup failed for environment: $ENVIRONMENT"
        exit 1
    fi
    
    log "=== Database Backup Script Completed ==="
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment] [options]"
        echo ""
        echo "Environments: production, staging, development"
        echo ""
        echo "Environment Variables:"
        echo "  MONGO_URI            - MongoDB connection string"
        echo "  BACKUP_S3_BUCKET     - S3 bucket for backup storage"
        echo "  BACKUP_S3_PREFIX     - S3 key prefix (default: database-backups)"
        echo "  BACKUP_ENCRYPTION_KEY - Encryption key for backup files"
        echo "  SLACK_WEBHOOK_URL    - Slack webhook for notifications"
        echo "  TEST_RESTORATION     - Set to 'true' to test restoration"
        echo ""
        echo "Examples:"
        echo "  $0 production"
        echo "  $0 staging TEST_RESTORATION=true"
        exit 0
        ;;
    *)
        main
        ;;
esac