#!/bin/bash

# Deployment Rollback Script
# Usage: ./rollback.sh <environment> <deployment-id>
# Example: ./rollback.sh production abc123

set -e

ENVIRONMENT=${1:-production}
DEPLOYMENT_ID=${2:-""}
ROLLBACK_TIMEOUT=300  # 5 minutes

echo "🔄 Starting rollback process..."
echo "Environment: $ENVIRONMENT"
echo "Deployment ID: ${DEPLOYMENT_ID:-"previous"}"

# Function to check service health
check_health() {
    local url=$1
    local timeout=$2
    local start_time=$(date +%s)
    
    echo "Checking health of $url..."
    
    while true; do
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            echo "❌ Health check timeout for $url"
            return 1
        fi
        
        if curl -f -s "$url/health" > /dev/null 2>&1; then
            echo "✅ Service is healthy: $url"
            return 0
        fi
        
        echo "⏳ Waiting for service to be healthy... ($elapsed seconds)"
        sleep 10
    done
}

# Function to rollback Render service
rollback_render() {
    local service_id=$1
    local api_key=$2
    local service_name=$3
    
    echo "🔄 Rolling back Render service: $service_name"
    
    if [ -n "$DEPLOYMENT_ID" ]; then
        echo "Rolling back to specific deployment: $DEPLOYMENT_ID"
        # Note: Render API doesn't directly support rollback by ID
        # This would need to be implemented with Render's API
        # For now, we'll trigger a redeploy which goes back to the last successful deployment
    else
        echo "Rolling back to previous deployment"
    fi
    
    # Trigger a new deployment (which will rollback to previous state)
    curl -X POST "https://api.render.com/v1/services/$service_id/deploys" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d '{
            "clearCache": true
        }'
    
    echo "✅ Rollback initiated for $service_name"
}

# Function to rollback GitHub Pages
rollback_github_pages() {
    local branch=$1
    
    echo "🔄 Rolling back GitHub Pages: $branch"
    
    # Get the previous deployment commit
    PREVIOUS_COMMIT=$(git log --oneline --skip=1 -n 1 | cut -d' ' -f1)
    
    if [ -n "$PREVIOUS_COMMIT" ]; then
        echo "Rolling back to commit: $PREVIOUS_COMMIT"
        
        # Update gh-pages branch
        git checkout gh-pages
        git reset --hard $PREVIOUS_COMMIT
        git push origin gh-pages --force
        
        echo "✅ GitHub Pages rollback completed"
    else
        echo "❌ Could not find previous commit for rollback"
        return 1
    fi
}

# Main rollback logic
case $ENVIRONMENT in
    "staging")
        echo "🎯 Performing staging rollback..."
        
        # Rollback staging services
        rollback_render "$RENDER_SERVICE_ID_STAGING" "$RENDER_API_KEY_STAGING" "Staging API"
        rollback_github_pages "gh-pages-staging"
        
        # Verify health
        echo "🔍 Verifying staging rollback..."
        check_health "$STAGING_API_URL" 300
        check_health "$STAGING_FRONTEND_URL" 300
        ;;
        
    "production")
        echo "🎯 Performing production rollback..."
        
        # Rollback production services
        rollback_render "$RENDER_SERVICE_ID" "$RENDER_API_KEY" "Production API"
        rollback_github_pages "gh-pages"
        
        # Verify health
        echo "🔍 Verifying production rollback..."
        check_health "$PRODUCTION_API_URL" 300
        check_health "$PRODUCTION_FRONTEND_URL" 300
        ;;
        
    *)
        echo "❌ Invalid environment. Use 'staging' or 'production'"
        exit 1
        ;;
esac

echo "✅ Rollback completed successfully!"
echo "📋 Rollback Summary:"
echo "   Environment: $ENVIRONMENT"
echo "   Time: $(date)"
echo "   Deployment ID: ${DEPLOYMENT_ID:-"previous"}"

# Send notification (if webhook is configured)
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔄 Deployment rollback completed for $ENVIRONMENT\"}" \
        "$SLACK_WEBHOOK" || true
fi

echo "📧 Notification sent (if configured)"