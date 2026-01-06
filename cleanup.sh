#!/bin/bash

# Cascade Cleanup Script
# This script removes the GKE cluster and related resources.

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
    echo "Usage: ./cleanup.sh <PROJECT_ID> [REGION] [CLUSTER_NAME]"
    exit 1
fi

echo "⚠️  WARNING: This will DELETE the GKE cluster '$CLUSTER_NAME' and all its data."
echo "   It will NOT delete the Artifact Registry repository '$REPO_NAME' to preserve images."
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo "🚀 Starting Cleanup..."

# 1. Delete GKE Cluster
echo "------------------------------------------------"
echo "🗑️  Deleting GKE Cluster..."
if gcloud container clusters describe $CLUSTER_NAME --region $REGION --project $PROJECT_ID >/dev/null 2>&1; then
    gcloud container clusters delete $CLUSTER_NAME \
        --region $REGION \
        --project $PROJECT_ID \
        --quiet
    echo "✅ Cluster deleted."
else
    echo "Cluster $CLUSTER_NAME not found. Skipping."
fi

# 2. Optional: Delete Artifact Registry
# Uncomment if you want to delete images too
# echo "------------------------------------------------"
# echo "🗑️  Deleting Artifact Registry..."
# gcloud artifacts repositories delete $REPO_NAME \
#    --location=$REGION \
#    --project=$PROJECT_ID \
#    --quiet

echo "------------------------------------------------"
echo "✅ Cleanup Complete!"
echo "------------------------------------------------"
