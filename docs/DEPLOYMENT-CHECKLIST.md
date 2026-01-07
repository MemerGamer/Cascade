# Cascade Deployment Checklist

Quick reference guide for deploying Cascade to GKE with GitHub OAuth.

## Pre-Deployment Checklist

- [ ] GCP Project created
- [ ] `gcloud` CLI configured
- [ ] `kubectl` installed
- [ ] `helm` installed
- [ ] Docker installed
- [ ] GitHub OAuth app created (see [GITHUB-OAUTH.md](./GITHUB-OAUTH.md))
- [ ] GitHub Client ID and Secret saved securely

## Deployment Steps

### 1. Create GKE Cluster (First Time Only)

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-west1"
export CLUSTER_NAME="cascade-cluster"

gcloud container clusters create $CLUSTER_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --num-nodes 1 \
  --machine-type e2-standard-4 \
  --enable-autoscaling --min-nodes 1 --max-nodes 3
```

### 2. Get Cluster Credentials

```bash
gcloud container clusters get-credentials $CLUSTER_NAME \
  --region $REGION \
  --project $PROJECT_ID
```

### 3. Install Infrastructure (First Time Only)

```bash
# Add Helm repos
helm repo add strimzi https://strimzi.io/charts/
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add provectus https://provectus.github.io/kafka-ui-charts
helm repo update

# Install Nginx Ingress
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install Cert-Manager (optional but recommended)
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --version v1.13.3 \
  --set installCRDs=true
```

### 4. Create Artifact Registry (First Time Only)

```bash
gcloud artifacts repositories create cascade \
  --repository-format=docker \
  --location=$REGION \
  --description="Cascade Docker Repository" \
  --project=$PROJECT_ID
```

### 5. Build and Push Images

```bash
./build-and-push.sh $PROJECT_ID $REGION cascade latest
```

Expected output:

```
✅ auth-service done!
✅ board-command-service done!
✅ board-query-service done!
✅ frontend done!
🎉 All images built and pushed successfully!
```

### 6. Deploy with Helm

```bash
# Update dependencies
helm dependency update helm/cascade

# Deploy with secrets
helm upgrade --install cascade helm/cascade \
  --set app.image.repository="$REGION-docker.pkg.dev/$PROJECT_ID/cascade" \
  --set app.image.tag="latest" \
  --set secrets.githubClientId="YOUR_GITHUB_CLIENT_ID" \
  --set secrets.githubClientSecret="YOUR_GITHUB_CLIENT_SECRET" \
  --set secrets.authSecret="$(openssl rand -base64 32)"
```

### 7. Get Ingress IP

```bash
# Wait for external IP (may take a few minutes)
kubectl get svc -n ingress-nginx ingress-nginx-controller -w

# Once available, save it
export INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Your application will be available at: http://$INGRESS_IP"
```

### 8. Configure Auth Service

```bash
# Update BASE_URL and TRUSTED_ORIGINS
kubectl set env deployment/cascade-auth \
  BASE_URL="http://$INGRESS_IP" \
  TRUSTED_ORIGINS="http://$INGRESS_IP"

# Wait for rollout
kubectl rollout status deployment/cascade-auth
```

### 9. Update GitHub OAuth Callback URL

Go to your GitHub OAuth app settings and update:

- **Homepage URL**: `http://<INGRESS_IP>`
- **Callback URL**: `http://<INGRESS_IP>/api/auth/callback/github`

### 10. Verify Deployment

```bash
# Check all pods are running
kubectl get pods

# Check services
kubectl get svc

# Test application
curl http://$INGRESS_IP/api/auth/health

# Access application in browser
echo "Open: http://$INGRESS_IP"
```

## Post-Deployment Verification

- [ ] All pods are `Running`
- [ ] Frontend loads correctly
- [ ] Login page shows "Continue with GitHub" button
- [ ] Email/password authentication works
- [ ] GitHub OAuth authentication works
- [ ] Can create boards
- [ ] Can create tasks
- [ ] Kafka UI accessible (port-forward to check)

## Updating Deployment

### Update Code Only

```bash
# Rebuild and push images
./build-and-push.sh $PROJECT_ID

# Restart deployments to pull new images
kubectl rollout restart deployment/cascade-auth
kubectl rollout restart deployment/cascade-frontend
kubectl rollout restart deployment/cascade-board-command
kubectl rollout restart deployment/cascade-board-query

# Wait for rollouts
kubectl rollout status deployment/cascade-auth
kubectl rollout status deployment/cascade-frontend
```

### Update Secrets

```bash
helm upgrade cascade helm/cascade \
  --reuse-values \
  --set secrets.githubClientId="NEW_CLIENT_ID" \
  --set secrets.githubClientSecret="NEW_CLIENT_SECRET"

# Restart auth service
kubectl rollout restart deployment/cascade-auth
```

### Update Configuration

```bash
helm upgrade cascade helm/cascade \
  --reuse-values \
  --set auth.replicaCount=2
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see errors
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>
```

### Image Pull Errors

```bash
# Verify image exists
gcloud artifacts docker images list $REGION-docker.pkg.dev/$PROJECT_ID/cascade

# Check pod events
kubectl get events --sort-by='.lastTimestamp'
```

### OAuth Not Working

See detailed troubleshooting in [GITHUB-OAUTH.md](./GITHUB-OAUTH.md#troubleshooting).

## Cleanup

### Delete Entire Deployment

```bash
# Delete Cascade
helm uninstall cascade

# Delete infrastructure
helm uninstall ingress-nginx -n ingress-nginx
helm uninstall cert-manager -n cert-manager

# Delete cluster
gcloud container clusters delete $CLUSTER_NAME \
  --region $REGION \
  --project $PROJECT_ID
```

### Keep Cluster, Delete Cascade Only

```bash
helm uninstall cascade
```

## Automated Deployment

Use the provided script for automated setup:

```bash
./setup.sh $PROJECT_ID $REGION $CLUSTER_NAME
```

This script automates steps 1-8 above.

## Production Recommendations

- [ ] Use HTTPS with cert-manager and Let's Encrypt
- [ ] Set up proper DNS (not relying on IP)
- [ ] Configure resource limits properly
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure backup for MongoDB
- [ ] Set up proper secrets management (Google Secret Manager)
- [ ] Enable GKE Autopilot or configure node pools properly
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Configure proper logging (Cloud Logging)
- [ ] Set up alerts for service health

## Resources

- [Main README](../README.md)
- [GitHub OAuth Setup](./GITHUB-OAUTH.md)
- [Docker Compose Setup](./DOCKER-COMPOSE.md)
- [Architecture Documentation](./architecture_presentation.md)
