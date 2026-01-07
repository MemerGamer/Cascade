# Cascade Documentation

Welcome to the Cascade documentation! This directory contains all technical documentation for the project.

## Quick Links

- [Architecture Presentation](./architecture_presentation.md) - High-level architecture diagrams and patterns
- [Docker Compose Setup](./DOCKER-COMPOSE.md) - Local development with Docker Compose
- [Microservices Patterns](#microservices-patterns) - Patterns implemented in the project

## Project Overview

Cascade is an event-driven team task board built on Google Kubernetes Engine (GKE) using microservices architecture.

### Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Framework**: Hono (microservices), Vite + TanStack (frontend)
- **Message Broker**: Apache Kafka (Strimzi)
- **Databases**: MongoDB (replica set), Redis (cache)
- **Orchestration**: Kubernetes (GKE), Helm
- **CI/CD**: GitHub Actions

## Architecture

Cascade implements a microservices architecture with the following core services:

### Services

1. **Auth Service** (`auth`) - User authentication using Better Auth
2. **Board Command Service** (`board-command`) - Write operations for boards and tasks
3. **Board Query Service** (`board-query`) - Read operations with caching
4. **Activity Service** (`activity`) - Real-time activity logging
5. **Audit Service** (`audit`) - Immutable audit trail

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

## Event Flow

1. User action → Command Service
2. Command Service writes to DB
3. Command Service publishes event to Kafka
4. Query Service consumes event, invalidates cache
5. Activity Service logs the event
6. Audit Service stores immutable record

## Deployment

### Local Development

See [DOCKER-COMPOSE.md](./DOCKER-COMPOSE.md)

### GKE Deployment

Use the Helm charts in `/helm/cascade/`:

```bash
./setup.sh <PROJECT_ID>
```

## Testing

Tests are written using Vitest and run automatically on CI:

```bash
cd backend
bun run test
```

## API Documentation

API documentation is available via Scalar when running locally:

- Board Command: http://localhost:3002/reference

## Contributing

See the main [README](../README.md) for contribution guidelines.
