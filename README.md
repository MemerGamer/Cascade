<div align="center">

<img src="docs/assets/cascade-logo.png" alt="Cascade Logo" width="275" />

Event-Driven Team Task Board on GKE

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![TanStack](https://img.shields.io/badge/-TanStack-FF4154?style=for-the-badge&logo=react-query&logoColor=white)](https://tanstack.com/)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![GKE](https://img.shields.io/badge/Google%20Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/kubernetes-engine)
[![Helm](https://img.shields.io/badge/helm-%230F1689.svg?style=for-the-badge&logo=helm&logoColor=white)](https://helm.sh/)
[![Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=for-the-badge&logo=apache-kafka&logoColor=white)](https://kafka.apache.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

</div>

## Table of Contents

- [About](#cascade)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [GKE Deployment](#gke-deployment)
- [Authentication](#authentication)
- [Scripts](#scripts)
- [License](#license)

## Architecture

Cascade implements a microservices architecture with the following core services:

### Services

1. **Auth Service** (`auth`) - User authentication using Better Auth with email/password and GitHub OAuth
2. **Board Command Service** (`board-command`) - Write operations for boards and tasks
3. **Board Query Service** (`board-query`) - Read operations with caching
4. **Activity Service** (`activity`) - Real-time activity logging
5. **Audit Service** (`audit`) - Immutable audit trail
6. **API Docs Service** (`api-docs`) - Centralized API documentation

### Microservices Patterns

#### 1. CQRS (Command Query Responsibility Segregation)

- **Command Service**: Handles all write operations
- **Query Service**: Optimized for read operations with Redis caching
- Async synchronization via Kafka events

#### 2. Event Sourcing (Partial)

- All state changes published as events to Kafka
- Audit service maintains immutable event log

#### 3. API Gateway Pattern

- Nginx ingress controller routes traffic
- Path-based routing to appropriate services

#### 4. Database per Service

- Each service has its own MongoDB database or collection
- No shared databases between services

#### 5. Saga Pattern (Orchestration)

- Multi-step workflows coordinated via Kafka events
- Example: Board creation triggers notifications and audit logs

#### 6. Circuit Breaker (via Retry Logic)

- Services implement retry mechanisms for Kafka connections

### Event Flow

1. User action → Command Service
2. Command Service writes to DB
3. Command Service publishes event to Kafka
4. Query Service consumes event, invalidates cache
5. Activity Service logs the event
6. Audit Service stores immutable record

## Getting Started

### Local Development

To run the project locally using Docker Compose:

1. Ensure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.
2. Start the services:

   ```bash
   docker-compose up --build
   ```

   More details in the local [docker compose documentation](./docs/DOCKER-COMPOSE.md).

### GKE Deployment

To deploy the project to Google Kubernetes Engine (GKE) using Helm:

**Quick Start**:

```bash
./setup.sh <YOUR_PROJECT_ID>
```

**Manual Deployment**: See the [Deployment Checklist](./docs/DEPLOYMENT-CHECKLIST.md) for step-by-step instructions.

**Key Features**:

- Automated cluster setup and configuration
- Kafka with KRaft mode (no Zookeeper)
- MongoDB 3-node replica set
- Redis caching layer
- Nginx Ingress with dynamic IP support (nip.io)
- GitHub OAuth authentication

### Accessing Kafka UI

Kafka UI is not exposed via Ingress by default. To access it:

```bash
kubectl port-forward svc/cascade-kafka-ui 8080:80
```

Then open <http://localhost:8080> in your browser.

## Authentication

Cascade supports multiple authentication methods:

### Email/Password Authentication

Users can sign up and sign in using email and password (powered by Better Auth).

### GitHub OAuth

Users can sign in with their GitHub accounts for a seamless experience.

**Setup Instructions**: See [GitHub OAuth Setup Guide](./docs/GITHUB-OAUTH.md) for detailed configuration steps.

**Quick Setup**:

1. Create a GitHub OAuth App at <https://github.com/settings/developers>
2. Deploy with secrets:

   ```bash
   helm upgrade cascade helm/cascade \
     --set secrets.githubClientId="your-client-id" \
     --set secrets.githubClientSecret="your-secret"
   ```

3. Configure callback URL: `http://<INGRESS_IP>/api/auth/callback/github`

## API Documentation

API documentation is available via Scalar for each microservice when running:

- **Centralized API Docs**: <http://localhost:3006>

## Documentation

- **[Architecture Overview](./docs/architecture_presentation.md)** - High-level architecture diagrams
- **[GKE Architecture Guide](./docs/GKE-ARCHITECTURE.md)** - Detailed documentation on how Cascade works in Kubernetes
  - Service discovery and communication patterns
  - Database architecture and synchronization
  - Caching strategy and data flow
  - Event-driven architecture with Kafka
  - Complete deployment topology

## Scripts

- `setup.sh`: Initializes the environment and prepares dependencies.
- `cleanup.sh`: Cleans up local or remote resources.
- `build-and-push.sh`: Builds Docker images and pushes them to a container registry.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Star History

<a href="https://www.star-history.com/#MemerGamer/Cascade&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=MemerGamer/Cascade&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=MemerGamer/Cascade&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=MemerGamer/Cascade&type=date&legend=top-left" />
 </picture>
</a>
