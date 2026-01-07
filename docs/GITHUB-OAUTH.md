# GitHub OAuth Setup Guide

This guide explains how to set up and configure GitHub OAuth authentication for Cascade.

## Overview

Cascade uses [Better Auth](https://www.better-auth.com/) with GitHub OAuth provider to enable users to sign in with their GitHub accounts. The implementation handles dynamic IPs in GKE deployments using [nip.io](https://nip.io/) for stable callback URLs.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating a GitHub OAuth App](#creating-a-github-oauth-app)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- GitHub account
- Running GKE cluster (or local development environment)
- Access to your project's Docker registry
- `kubectl` and `helm` CLI tools installed

## Creating a GitHub OAuth App

### 1. Navigate to GitHub Developer Settings

Go to [GitHub Developer Settings](https://github.com/settings/developers) or:

- Click your profile picture → Settings
- Scroll down to "Developer settings" (left sidebar)
- Click "OAuth Apps"
- Click "New OAuth App"

### 2. Configure OAuth App

Fill in the following details:

**For Production (GKE):**

- **Application name**: `Cascade` (or your preferred name)
- **Homepage URL**: `http://<YOUR_INGRESS_IP>.nip.io` or `http://<YOUR_INGRESS_IP>`
- **Authorization callback URL**: `http://<YOUR_INGRESS_IP>.nip.io/api/auth/callback/github`

**For Local Development:**

- **Application name**: `Cascade Local`
- **Homepage URL**: `http://localhost:5173`
- **Authorization callback URL**: `http://localhost:3001/api/auth/callback/github`

> **Note**: You can create separate OAuth apps for development and production, or add multiple callback URLs.

### 3. Get Your Credentials

After creating the app:

1. Copy the **Client ID**
2. Click "Generate a new client secret"
3. Copy the **Client Secret** (you won't be able to see it again!)

### 4. Enable Email Scope (Important!)

For **GitHub Apps** (not OAuth Apps), you need to enable email access:

1. Go to Permissions and Events → Account Permissions
2. Set "Email Addresses" to "Read-Only"
3. Save changes

> **Note**: Regular OAuth Apps have email access by default.

## Configuration

### Secrets Management

Cascade keeps secrets secure by:

1. **Never committing secrets to the repository**
2. **Passing secrets via Helm values during deployment**
3. **Storing secrets in Kubernetes Secrets**

### Option 1: Using Environment Variables (Local Development)

Create a `.env` file in `backend/services/auth/`:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
AUTH_SECRET=your_random_secret_string
BASE_URL=http://localhost:3001
```

### Option 2: Using Helm Values (Production)

Secrets are passed during Helm deployment (see Deployment section below).

## Deployment

### Local Development with Docker Compose

1. Create `.env` file with your credentials (see Configuration above)
2. Start services:

```bash
docker-compose up --build
```

3. Frontend will be at `http://localhost:5173`
4. Auth service at `http://localhost:3001`

### Production Deployment on GKE

#### Step 1: Build and Push Docker Images

First, build the updated images with OAuth support:

```bash
./build-and-push.sh <YOUR_PROJECT_ID>
```

This builds and pushes:

- `auth-service` with GitHub OAuth provider
- `frontend` with GitHub sign-in button

#### Step 2: Deploy with Helm

Deploy Cascade with your GitHub OAuth credentials:

```bash
helm upgrade --install cascade helm/cascade \
  --set app.image.repository="europe-west1-docker.pkg.dev/<YOUR_PROJECT_ID>/cascade" \
  --set app.image.tag="latest" \
  --set secrets.githubClientId="<YOUR_GITHUB_CLIENT_ID>" \
  --set secrets.githubClientSecret="<YOUR_GITHUB_CLIENT_SECRET>" \
  --set secrets.authSecret="<RANDOM_SECRET_STRING>"
```

#### Step 3: Get Ingress IP and Configure BASE_URL

Wait for the Ingress to get an external IP:

```bash
# Get the ingress IP
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Your Ingress IP: $INGRESS_IP"
```

Configure the auth service with the correct BASE_URL:

```bash
# Option A: Using nip.io (recommended for dynamic IPs)
kubectl set env deployment/cascade-auth \
  BASE_URL="http://$INGRESS_IP.nip.io" \
  TRUSTED_ORIGINS="http://$INGRESS_IP,http://$INGRESS_IP.nip.io"

# Option B: Using direct IP
kubectl set env deployment/cascade-auth \
  BASE_URL="http://$INGRESS_IP" \
  TRUSTED_ORIGINS="http://$INGRESS_IP"
```

#### Step 4: Update GitHub OAuth App Callback URL

Update your GitHub OAuth app with the correct callback URL:

**If using nip.io (Option A):**

```console
http://<INGRESS_IP>.nip.io/api/auth/callback/github
```

**If using direct IP (Option B):**

```console
http://<INGRESS_IP>/api/auth/callback/github
```

#### Step 5: Verify Deployment

```bash
# Check all pods are running
kubectl get pods

# Check auth service logs
kubectl logs -l app.kubernetes.io/component=auth

# Access your application
echo "Access Cascade at: http://$INGRESS_IP"
```

### Using the Automated Setup Script

The `setup.sh` script automates the entire deployment process:

```bash
./setup.sh <PROJECT_ID> <REGION> <CLUSTER_NAME>
```

After the script completes, it will display the callback URL you need to configure in GitHub.

## Testing

### Test GitHub OAuth Flow

1. Navigate to your Cascade application
2. You should see the login page with:
   - Email/Password fields
   - "Continue with GitHub" button (with GitHub icon)
3. Click "Continue with GitHub"
4. You'll be redirected to GitHub to authorize the app
5. After authorization, you'll be redirected back to Cascade
6. You should be logged in with your GitHub account

### Verify User Data

After signing in with GitHub, verify that:

- User email is captured (check auth service logs)
- User session is created
- User can access boards and tasks

## Troubleshooting

### Common Issues

#### 1. "Invalid Redirect URI" Error

**Problem**: GitHub shows an error about the redirect URI not matching.

**Solution**:

- Verify the callback URL in your GitHub OAuth app matches exactly:
  - `http://<INGRESS_IP>.nip.io/api/auth/callback/github` OR
  - `http://<INGRESS_IP>/api/auth/callback/github`
- Check that `BASE_URL` environment variable is set correctly in the auth deployment:

  ```bash
  kubectl get deployment cascade-auth -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="BASE_URL")].value}'
  ```

#### 2. "email_not_found" Error

**Problem**: Better Auth can't find the user's email.

**Solution**:

- For **GitHub Apps**: Enable email scope (see step 4 in Creating OAuth App)
- For **OAuth Apps**: This should work by default
- Verify the `user:email` scope is included

#### 3. GitHub Button Not Showing

**Problem**: The "Continue with GitHub" button doesn't appear.

**Solution**:

- Verify frontend pod is running the latest image:

  ```bash
  kubectl rollout restart deployment/cascade-frontend
  kubectl rollout status deployment/cascade-frontend
  ```

- Check browser console for errors
- Verify the icon SVG is rendering correctly

#### 4. Callback Times Out or Fails

**Problem**: After GitHub authorization, the callback hangs or fails.

**Solution**:

- Verify auth service is running: `kubectl get pods -l app.kubernetes.io/component=auth`
- Check auth service logs: `kubectl logs -l app.kubernetes.io/component=auth`
- Verify TRUSTED_ORIGINS includes your domain:

  ```bash
  kubectl get deployment cascade-auth -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TRUSTED_ORIGINS")].value}'
  ```

- Test auth service health: `curl http://<INGRESS_IP>/api/auth/health`

#### 5. Secrets Not Loading

**Problem**: Auth service logs show "GITHUB_CLIENT_ID is undefined".

**Solution**:

- Verify secrets are created:

  ```bash
  kubectl get secret cascade-secrets -o yaml
  ```

- Check that deployment references the correct secret:

  ```bash
  kubectl get deployment cascade-auth -o yaml | grep -A 5 GITHUB_CLIENT_ID
  ```

- Re-deploy with correct secrets:

  ```bash
  helm upgrade cascade helm/cascade --set secrets.githubClientId="..." --set secrets.githubClientSecret="..."
  ```

### Debug Commands

```bash
# Check auth service environment variables
kubectl exec -it deployment/cascade-auth -- env | grep -E "GITHUB|BASE_URL|TRUSTED"

# View auth service logs
kubectl logs -f deployment/cascade-auth

# Describe auth deployment
kubectl describe deployment cascade-auth

# Check secret contents (base64 encoded)
kubectl get secret cascade-secrets -o jsonpath='{.data.GITHUB_CLIENT_ID}' | base64 -d

# Test auth service directly
kubectl port-forward svc/cascade-auth 3001:3001
# Then visit: http://localhost:3001/api/auth/health
```

## Architecture

### OAuth Flow Diagram

```console
User → Frontend → Auth Service → GitHub OAuth
                      ↓
                   MongoDB
                      ↓
                    Kafka → Activity/Audit Services
```

### Components

1. **Frontend** (`frontend/src/routes/index.tsx`):

   - Login form with GitHub button
   - Auth client integration

2. **Auth Service** (`backend/services/auth/src/auth.ts`):

   - Better Auth configuration
   - GitHub provider setup
   - Session management

3. **Kubernetes**:
   - Secrets for credentials
   - Environment variables for BASE_URL
   - Ingress routing

### Security Considerations

- ✅ Secrets never committed to repository
- ✅ Secrets passed via Helm values at deploy time
- ✅ Kubernetes Secrets encrypted at rest
- ✅ HTTPS recommended for production (use cert-manager)
- ✅ TRUSTED_ORIGINS prevents CSRF attacks

## Additional Resources

- [Better Auth Documentation](https://www.better-auth.com/)
- [Better Auth GitHub Provider](https://www.better-auth.com/docs/authentication/social)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [nip.io Documentation](https://nip.io/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

## Support

If you encounter issues not covered in this guide:

1. Check the [Issues](https://github.com/MemerGamer/Cascade/issues) page
2. Review auth service logs: `kubectl logs -l app.kubernetes.io/component=auth`
3. Verify your GitHub OAuth app configuration
4. Open a new issue with details about your setup
