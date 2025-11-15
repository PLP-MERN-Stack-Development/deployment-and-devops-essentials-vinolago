#!/bin/bash

# Setup script for MERN Blog Application maintenance tools
# This script makes all maintenance scripts executable and sets up the environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Setting up MERN Blog maintenance tools..."

# Make all scripts executable
echo "Making scripts executable..."
chmod +x "$SCRIPT_DIR"/*.sh

# Create necessary directories
echo "Creating directory structure..."
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/backups"
mkdir -p "$PROJECT_ROOT/configs"

# Set up environment files if they don't exist
echo "Setting up environment configuration..."

# Create .env file if it doesn't exist
if [[ ! -f "$PROJECT_ROOT/server/.env" ]]; then
    cat > "$PROJECT_ROOT/server/.env" << 'EOF'
# Environment Configuration for MERN Blog Application
NODE_ENV=development
PORT=3000

# Database Configuration
MONGO_URI=mongodb://localhost:27017/mern_blog

# Security
JWT_SECRET=your-super-secret-jwt-key-here

# Application URLs
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Monitoring Configuration
SENTRY_DSN=your-sentry-dsn-here
SLACK_WEBHOOK_URL=your-slack-webhook-url-here

# Backup Configuration
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_ENCRYPTION_KEY=your-encryption-key

# Notification Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Deployment Configuration
RENDER_SERVICE_ID=your-render-service-id
RENDER_API_KEY=your-render-api-key
RENDER_DEPLOY_HOOK=your-deploy-hook-url
EOF
    echo "📝 Created default .env file - please update with your actual values"
fi

# Create backup directory structure
echo "Setting up backup configuration..."
cat > "$PROJECT_ROOT/scripts/backup-config.env" << 'EOF'
# Backup Configuration
BACKUP_S3_BUCKET=mern-blog-backups
BACKUP_S3_PREFIX=database-backups
BACKUP_ENCRYPTION_KEY=your-backup-encryption-key
BACKUP_RETENTION_DAYS=30
TEST_RESTORATION=false

# Notification Settings
SLACK_WEBHOOK_URL=your-backup-notification-webhook
BACKUP_NOTIFICATION_EMAIL=admin@company.com
EOF

# Create monitoring configuration
echo "Setting up monitoring configuration..."
cat > "$PROJECT_ROOT/scripts/monitoring-config.env" << 'EOF'
# Monitoring Configuration
MONITORING_ENABLED=true
HEALTH_CHECK_TIMEOUT=60
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@company.com,dev@company.com

# Alert Channels
SLACK_WEBHOOK_URL=your-slack-webhook-url
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890
ALERT_PHONE_NUMBERS=+1234567890,+0987654321

# Dashboard Configuration
GRAFANA_ENABLED=false
GRAFANA_URL=https://your-grafana.com
GRAFANA_API_KEY=your-grafana-api-key

# Performance Thresholds
PERFORMANCE_WARNING_THRESHOLD=1000
PERFORMANCE_CRITICAL_THRESHOLD=2000
ERROR_RATE_WARNING_THRESHOLD=5
ERROR_RATE_CRITICAL_THRESHOLD=10
EOF

# Create incident response configuration
echo "Setting up incident response configuration..."
cat > "$PROJECT_ROOT/scripts/incident-config.env" << 'EOF'
# Incident Response Configuration
INCIDENT_WEBHOOK_URL=your-incident-webhook-url
ONCALL_EMAIL=oncall@company.com
ESCALATION_EMAIL=escalation@company.com

# PagerDuty Configuration (Optional)
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key
PAGERDUTY_SERVICE_KEY=your-pagerduty-service-key

# Response Time Thresholds (in seconds)
CRITICAL_RESPONSE_TIME=900
HIGH_RESPONSE_TIME=1800
MEDIUM_RESPONSE_TIME=7200
LOW_RESPONSE_TIME=86400

# Escalation Time Thresholds (in seconds)
CRITICAL_ESCALATION_TIME=300
HIGH_ESCALATION_TIME=900
MEDIUM_ESCALATION_TIME=3600
LOW_ESCALATION_TIME=14400
EOF

# Set up cron jobs for automated maintenance
echo "Setting up automated maintenance cron jobs..."

CRON_FILE="/tmp/mern-blog-cron"
cat > "$CRON_FILE" << 'EOF'
# MERN Blog Application Maintenance Cron Jobs

# Daily maintenance at 2:00 AM UTC
0 2 * * * cd /path/to/your/project && ./scripts/maintenance-checklist.sh daily production >> logs/maintenance-cron.log 2>&1

# Weekly maintenance on Sunday at 1:00 AM UTC
0 1 * * 0 cd /path/to/your/project && ./scripts/maintenance-checklist.sh weekly production >> logs/maintenance-cron.log 2>&1

# Monthly maintenance on 1st of each month at 12:00 AM UTC
0 0 1 * * cd /path/to/your/project && ./scripts/maintenance-checklist.sh monthly production >> logs/maintenance-cron.log 2>&1

# Daily database backup at 2:00 AM UTC
0 2 * * * cd /path/to/your/project && ./scripts/backup-database.sh production >> logs/backup-cron.log 2>&1

# Incident detection every 5 minutes
*/5 * * * * cd /path/to/your/project && ./scripts/incident-response.sh detect >> logs/incident-detection.log 2>&1

# Health check every minute
* * * * * cd /path/to/your/project && ./scripts/maintenance-checklist.sh test production > /dev/null 2>&1
EOF

echo "📋 Cron jobs configuration created at $CRON_FILE"
echo "⚠️  Please update the paths in the cron file before installing:"
echo "   crontab $CRON_FILE"

# Create a quick reference guide
echo "Creating quick reference guide..."
cat > "$PROJECT_ROOT/MAINTENANCE_QUICK_REFERENCE.md" << 'EOF'
# MERN Blog Maintenance - Quick Reference

## Available Scripts

### Database Management
```bash
# Create database backup
./scripts/backup-database.sh production

# Restore database from backup
./scripts/backup-database.sh production restore backup-file.gz
```

### Application Deployment
```bash
# Deploy application
./scripts/deploy.sh production v1.2.3

# Rollback application
./scripts/rollback-enhanced.sh production v1.1.0 full
```

### Maintenance Tasks
```bash
# Daily maintenance
./scripts/maintenance-checklist.sh daily

# Weekly maintenance
./scripts/maintenance-checklist.sh weekly

# Monthly maintenance
./scripts/maintenance-checklist.sh monthly
```

### Incident Response
```bash
# Detect incidents
./scripts/incident-response.sh detect

# Manual incident response
./scripts/incident-response.sh respond critical

# Test incident procedures
./scripts/incident-response.sh test
```

## Emergency Procedures

### Application Down
1. Check health endpoint: `curl -f http://localhost:3000/health`
2. Check logs: `tail -f logs/application.log`
3. If critical, trigger rollback: `./scripts/rollback-enhanced.sh production previous full`

### Database Issues
1. Check database health: `curl -f http://localhost:3000/health/db`
2. Verify backups: `./scripts/backup-database.sh production`
3. If needed, restore from backup

### Performance Issues
1. Check performance metrics: `curl http://localhost:3000/api/performance/realtime`
2. Run incident detection: `./scripts/incident-response.sh detect`
3. Scale resources or restart services if needed

## Configuration Files

- `server/.env` - Main application configuration
- `scripts/backup-config.env` - Backup settings
- `scripts/monitoring-config.env` - Monitoring settings  
- `scripts/incident-config.env` - Incident response settings

## Log Locations

- `logs/application.log` - Application logs
- `logs/maintenance-*.log` - Maintenance task logs
- `logs/backup-*.log` - Backup operation logs
- `logs/incidents.log` - Incident detection logs
- `logs/incident-*.json` - Individual incident records

## Important URLs

- Health Check: `GET /health`
- Database Health: `GET /health/db`
- Performance Metrics: `GET /api/performance/realtime`
- System Metrics: `GET /metrics`

## Contact Information

- DevOps Lead: devops@company.com
- On-Call: oncall@company.com
- Emergency: +1-XXX-XXX-XXXX

---
For detailed information, see MAINTENANCE_PLAN.md
EOF

# Create a validation script
echo "Creating validation script..."
cat > "$PROJECT_ROOT/scripts/validate-setup.sh" << 'EOF'
#!/bin/bash

echo "🔍 Validating MERN Blog maintenance setup..."

ERRORS=0
WARNINGS=0

# Check if scripts are executable
echo "Checking script permissions..."
for script in backup-database.sh deploy.sh rollback-enhanced.sh maintenance-checklist.sh incident-response.sh; do
    if [[ -x "$script" ]]; then
        echo "✅ $script is executable"
    else
        echo "❌ $script is not executable"
        ((ERRORS++))
    fi
done

# Check directory structure
echo "Checking directory structure..."
for dir in logs backups configs; do
    if [[ -d "$PROJECT_ROOT/$dir" ]]; then
        echo "✅ $dir directory exists"
    else
        echo "❌ $dir directory missing"
        ((ERRORS++))
    fi
done

# Check configuration files
echo "Checking configuration files..."
for config in server/.env scripts/backup-config.env scripts/monitoring-config.env scripts/incident-config.env; do
    if [[ -f "$PROJECT_ROOT/$config" ]]; then
        echo "✅ $config exists"
    else
        echo "❌ $config missing"
        ((WARNINGS++))
    fi
done

# Check required tools
echo "Checking required tools..."
for tool in curl git jq bc; do
    if command -v "$tool" &> /dev/null; then
        echo "✅ $tool is available"
    else
        echo "⚠️  $tool not found - some features may not work"
        ((WARNINGS++))
    fi
done

# Check optional tools
echo "Checking optional tools..."
for tool in mongodump mongorestore mongosh aws gpg; do
    if command -v "$tool" &> /dev/null; then
        echo "✅ $tool is available"
    else
        echo "⚠️  $tool not found - consider installing for full functionality"
    fi
done

echo ""
echo "📊 Setup validation summary:"
echo "   Errors: $ERRORS"
echo "   Warnings: $WARNINGS"

if [[ $ERRORS -eq 0 ]]; then
    echo "✅ Setup validation passed!"
    exit 0
else
    echo "❌ Setup validation failed with $ERRORS errors"
    exit 1
fi
EOF

chmod +x "$PROJECT_ROOT/scripts/validate-setup.sh"

echo ""
echo "🎉 Maintenance tool setup completed!"
echo ""
echo "Next steps:"
echo "1. Update configuration files with your actual values:"
echo "   - server/.env"
echo "   - scripts/backup-config.env"
echo "   - scripts/monitoring-config.env"
echo "   - scripts/incident-config.env"
echo ""
echo "2. Validate the setup:"
echo "   ./scripts/validate-setup.sh"
echo ""
echo "3. Install cron jobs (update paths first):"
echo "   crontab /path/to/project/scripts/mern-blog-cron"
echo ""
echo "4. Test the scripts:"
echo "   ./scripts/maintenance-checklist.sh test"
echo "   ./scripts/incident-response.sh test"
echo ""
echo "📖 For detailed documentation, see:"
echo "   - MAINTENANCE_PLAN.md (comprehensive guide)"
echo "   - MAINTENANCE_QUICK_REFERENCE.md (quick reference)"
echo ""
echo "🔧 All maintenance scripts are now ready to use!"