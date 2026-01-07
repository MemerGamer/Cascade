#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_ID=$1
REGION=${2:-"europe-west1"}
REPO_NAME=${3:-"cascade"}
TAG=${4:-"latest"}

# Try to get project ID from gcloud if not provided
if [ -z "$PROJECT_ID" ]; then
    if command -v gcloud >/dev/null 2>&1; then
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    fi
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Could not determine PROJECT_ID. Please provide it as the first argument or set it in gcloud config."
    echo "Usage: ./build-and-push.sh <PROJECT_ID> [REGION] [REPO_NAME] [TAG]"
    exit 1
fi

REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"

echo "🚀 Starting build and push process for project: $PROJECT_ID"
echo "Registry: $REGISTRY"
echo "Tag: $TAG"

# Helper function to build and push
build_and_push() {
    SERVICE_NAME=$1
    DOCKERFILE_PATH=$2
    CONTEXT_PATH=$3
    
    IMAGE_URI="$REGISTRY/$SERVICE_NAME:$TAG"
    
    echo "------------------------------------------------"
    echo "📦 Building $SERVICE_NAME..."
    echo "------------------------------------------------"
    
    docker build -t $IMAGE_URI -f $DOCKERFILE_PATH $CONTEXT_PATH
    
    echo "⬆️ Pushing $SERVICE_NAME..."
    docker push $IMAGE_URI
    
    echo "✅ $SERVICE_NAME done!"
}

# Build Backend Services (Context is root)
build_and_push "auth-service" "backend/services/auth/Dockerfile" "."
build_and_push "board-command-service" "backend/services/board-command/Dockerfile" "."
build_and_push "board-query-service" "backend/services/board-query/Dockerfile" "."
build_and_push "activity-service" "backend/services/activity/Dockerfile" "."
build_and_push "audit-service" "backend/services/audit/Dockerfile" "."

# Build Frontend (Context is frontend dir)
build_and_push "frontend" "frontend/Dockerfile" "frontend"

echo "------------------------------------------------"
echo "🎉 All images built and pushed successfully!"
echo "------------------------------------------------"
