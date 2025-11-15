# Deployment and DevOps for MERN Applications

This assignment focuses on deploying a full MERN stack application to production, implementing CI/CD pipelines, and setting up monitoring for your application.

## Assignment Overview

You will:

1. Prepare your MERN application for production deployment
2. Deploy the backend to a cloud platform
3. Deploy the frontend to a static hosting service
4. Set up CI/CD pipelines with GitHub Actions
5. Implement monitoring and maintenance strategies

## Getting Started

1. Accept the GitHub Classroom assignment invitation
2. Clone your personal repository that was created by GitHub Classroom
3. Follow the setup instructions in the `Week7-Assignment.md` file
4. Use the provided templates and configuration files as a starting point

## Files Included

- `Week7-Assignment.md`: Detailed assignment instructions
- `.github/workflows/`: GitHub Actions workflow templates
- `deployment/`: Deployment configuration files and scripts
- `.env.example`: Example environment variable templates
- `monitoring/`: Monitoring configuration examples

## Requirements

- A completed MERN stack application from previous weeks
- Accounts on the following services:
  - GitHub
  - MongoDB Atlas
  - Render, Railway, or Heroku (for backend)
  - Vercel, Netlify, or GitHub Pages (for frontend)
- Basic understanding of CI/CD concepts

## Deployment Platforms

### Backend Deployment Options

- **Render**: Easy to use, free tier available
- **Railway**: Developer-friendly, generous free tier
- **Heroku**: Well-established, extensive documentation

### Frontend Deployment Options

- **Vercel**: Optimized for React apps, easy integration
- **Netlify**: Great for static sites, good CI/CD
- **GitHub Pages**: Free, integrated with GitHub

## CI/CD Pipeline

The assignment includes templates for setting up GitHub Actions workflows:

- `frontend-ci.yml`: Tests and builds the React application
- `backend-ci.yml`: Tests the Express.js backend
- `frontend-cd.yml`: Deploys the frontend to your chosen platform
- `backend-cd.yml`: Deploys the backend to your chosen platform

## Submission

Your work will be automatically submitted when you push to your GitHub Classroom repository. Make sure to:

1. Complete all deployment tasks
2. Set up CI/CD pipelines with GitHub Actions
3. Deploy both frontend and backend to production
4. Document your deployment process in the README.md
5. Include screenshots of your CI/CD pipeline in action
6. Add URLs to your deployed applications

## Deployment Process

### Frontend Deployment (Vercel)

The frontend is a React application built with Vite and deployed on Vercel for optimal performance and scalability.

**Steps:**

1. Connect the GitHub repository to Vercel
2. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`
3. Set environment variables in Vercel dashboard (e.g., API base URL)
4. Deploy automatically on pushes to main branch via Vercel's Git integration

### Backend Deployment (Render)

The backend is an Express.js API deployed on Render, providing a reliable hosting solution with automatic scaling.

**Steps:**

1. Create a new Web Service on Render
2. Connect the GitHub repository
3. Configure build and start settings:
   - Build Command: `npm ci`
   - Start Command: `npm start`
4. Set environment variables (database URL, JWT secrets, etc.)
5. Deploy automatically via GitHub Actions or manual triggers

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

- **CI/CD Workflow** (`.github/workflows/ci-cd.yml`): Comprehensive pipeline including linting, security checks, testing, and deployment to staging/production
- **Deploy Workflow** (`.github/workflows/deploy.yml`): Simplified deployment workflow for Render and GitHub Pages

The pipeline runs on pushes to main/master/develop branches and includes:

- Code quality checks (linting, formatting)
- Security audits
- Unit and integration tests
- Automated deployment to staging (develop branch) and production (main branch)
- Smoke tests post-deployment
- Slack notifications for deployment status

## CI/CD Pipeline Screenshots

Below are screenshots showing the CI/CD pipeline in action:

### Pipeline Overview

![CI/CD Pipeline Overview](screenshots/pipeline-overview.png)

### Successful Deployment

![Successful Deployment](screenshots/successful-deployment.png)

### Test Results

![Test Results](screenshots/test-results.png)

_Note: Replace the placeholder image paths with actual screenshot files uploaded to the repository._

## Deployed Application URLs

- **Frontend (Vercel)**: https://blog-app-81n6.vercel.app/
- **Backend (Render)**: https://deployment-and-devops-essentials-vinolago.onrender.com

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
