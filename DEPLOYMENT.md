# Deployment and Monitoring Guide

## Continuous Deployment Setup

### GitHub Actions CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:

- Runs tests on multiple Node.js versions (18.x, 20.x)
- Builds the client application
- Automatically deploys to Render on pushes to main/master branch

### Required GitHub Secrets

Add these secrets to your GitHub repository:

- `RENDER_API_KEY`: Your Render API key
- `RENDER_SERVICE_ID`: Your Render service ID

### Render Configuration

Use the `render.yaml` file for infrastructure as code deployment, or configure manually:

1. **API Service**:

   - Service Type: Web Service
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Environment Variables:
     - `NODE_ENV=production`
     - `MONGO_URI` (set in Render dashboard)
     - `JWT_SECRET` (set in Render dashboard)
     - `FRONTEND_URL` (set in Render dashboard)
     - `LOG_LEVEL=info`

### GitHub Pages Configuration

The client is deployed to GitHub Pages using GitHub Actions:

- Build Command: `cd client && npm install && npm run build`
- Deploy Directory: `client/dist`
- Base URL: Automatically set to repository path
- Enable GitHub Pages in repository settings (Settings > Pages > Source: Deploy from a branch > gh-pages)

## HTTPS/SSL Configuration

Render automatically provides SSL certificates for all deployed services. No additional configuration needed.

## Monitoring and Logging

### Health Check Endpoints

- `GET /health` - General application health
- `GET /health/db` - Database connection health

### Logging

- **Development**: Console logging with colors
- **Production**: File logging to `logs/` directory with Winston
  - `logs/error.log` - Error-level logs
  - `logs/combined.log` - All logs

### Performance Monitoring

- Response time tracking for all requests
- Memory usage logging (every 5 minutes in production)
- Slow request detection (> 1 second)

### Log Aggregation

Logs are written to files in production. Consider integrating with:

- **Logtail** or **Better Stack** for log aggregation
- **Sentry** for error tracking
- **DataDog** or **New Relic** for application monitoring

## Environment Variables

### Server (.env.production)

```
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://your-frontend-domain.com
LOG_LEVEL=info
```

### Client (.env.production)

```
VITE_API_URL=https://your-api-domain.com/api
VITE_USE_FAKE_USER=false
```

## Deployment Steps

1. **Push to GitHub**: Commit and push all changes to main branch
2. **GitHub Actions**: Will automatically run tests, deploy server to Render, and deploy client to GitHub Pages
3. **Render**: Server will rebuild and redeploy automatically
4. **GitHub Pages**: Client will be deployed to https://username.github.io/repository-name/
5. **DNS**: Point your custom domain to Render for API and GitHub Pages for client (optional)
6. **SSL**: Automatic SSL certificates will be provisioned for both

## Monitoring Dashboard

Set up monitoring using:

- Render's built-in metrics
- Health check endpoints for uptime monitoring
- Log aggregation service for centralized logging
- Application performance monitoring (APM) tool
