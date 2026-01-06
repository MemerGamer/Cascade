#!/bin/bash

# Cascade GKE Setup Script
# This script automates the setup of the GKE cluster and deployment of the Cascade application.

set -e

# Configuration
PROJECT_ID=$1
REGION=${2:-"europe-west1"}
CLUSTER_NAME=${3:-"cascade-cluster"}
REPO_NAME="cascade"

# Try to get project ID from gcloud if not provided
if [ -z "$PROJECT_ID" ]; then
    if command -v gcloud >/dev/null 2>&1; then
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    fi
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Could not determine PROJECT_ID. Please provide it as the first argument or set it in gcloud config."
    echo "Usage: ./setup.sh <PROJECT_ID> [REGION] [CLUSTER_NAME]"
    exit 1
fi

echo "🚀 Starting Cascade GKE Setup..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Cluster: $CLUSTER_NAME"

# 1. Prerequisites Check
echo "------------------------------------------------"
echo "🔍 Checking prerequisites..."
command -v gcloud >/dev/null 2>&1 || { echo >&2 "gcloud is required but not installed. Aborting."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo >&2 "kubectl is required but not installed. Aborting."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo >&2 "helm is required but not installed. Aborting."; exit 1; }
echo "✅ Prerequisites met."

# 2. GKE Cluster Creation
echo "------------------------------------------------"
echo "🏗️ Creating GKE Cluster (this may take a few minutes)..."
# Check if cluster exists
if gcloud container clusters describe $CLUSTER_NAME --region $REGION --project $PROJECT_ID >/dev/null 2>&1; then
    echo "Cluster $CLUSTER_NAME already exists. Skipping creation."
else
    gcloud container clusters create $CLUSTER_NAME \
        --region $REGION \
        --project $PROJECT_ID \
        --num-nodes 1 \
        --machine-type e2-standard-4 \
        --enable-autoscaling --min-nodes 1 --max-nodes 3
fi

# Get Credentials
echo "🔑 Getting cluster credentials..."
gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID

# 3. Helm Repositories
echo "------------------------------------------------"
echo "📦 Adding Helm repositories..."

helm repo add strimzi https://strimzi.io/charts/
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add provectus https://provectus.github.io/kafka-ui-charts
helm repo update

# 4. Infrastructure Installation
echo "------------------------------------------------"
echo "🌐 Installing Nginx Ingress Controller..."
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace

echo "🔒 Installing Cert-Manager (Optional for Extra Points)..."
helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager --create-namespace \
    --version v1.13.3 \
    --set installCRDs=true

# 5. Build and Push Images
echo "------------------------------------------------"
echo "🐳 Building and Pushing Docker Images..."
# Ensure Artifact Registry exists
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Cascade Docker Repository" \
        --project=$PROJECT_ID
fi

# Run build script
./build-and-push.sh $PROJECT_ID $REGION $REPO_NAME "latest"

# 6. Deploy Cascade
echo "------------------------------------------------"
echo "🚀 Deploying Cascade Helm Chart..."
# Update dependencies
helm dependency update helm/cascade

# Install/Upgrade
helm upgrade --install cascade helm/cascade \
    --set app.image.repository="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME" \
    --set app.image.tag="latest"

echo "------------------------------------------------"
echo "✅ Setup Complete!"
echo "To get the external IP of the Ingress:"
echo "kubectl get svc -n ingress-nginx ingress-nginx-controller"
echo "Then map that IP to 'cascade.local' in your /etc/hosts file OR access it directly via the IP."
echo "------------------------------------------------"

echo "🔄 Configuring Auth Service with Ingress IP..."
# Wait for Ingress IP
INGRESS_IP=""
echo "Waiting for Ingress External IP..."
while [ -z "$INGRESS_IP" ]; do
  INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [ -z "$INGRESS_IP" ]; then
    sleep 5
  fi
done

echo "Ingress IP: $INGRESS_IP"
echo "Updating cascade-auth deployment with TRUSTED_ORIGINS..."
kubectl set env deployment/cascade-auth TRUSTED_ORIGINS="http://$INGRESS_IP"
echo "✅ Auth service configured."

echo "------------------------------------------------"
echo "To access Kafka UI:"
echo "kubectl port-forward svc/cascade-kafka-ui 8080:80"
echo "Then open http://localhost:8080"
echo "------------------------------------------------"
