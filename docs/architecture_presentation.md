# Cascade Architecture Presentation

## Slide 1: System Architecture on GKE

This diagram illustrates the high-level architecture of Cascade running on Google Kubernetes Engine.

```mermaid
graph TB
    subgraph "External"
        User[User Browser]
    end

    subgraph "GKE Cluster"
        Ingress[Nginx Ingress Controller]

        subgraph "API Gateway Layer"
            Gateway["API Gateway (Nginx)"]
        end

        subgraph "Frontend Layer"
            FE[Frontend Service]
            FE_Pods["Frontend Pods (HPA)"]
        end

        subgraph "Microservices Layer"
            Auth[Auth Service]
            Cmd[Board Command Service]
            Query[Board Query Service]
            Activity[Activity Service]
            Audit[Audit Service]
            ApiDocs[API Docs Service]
        end

        subgraph "Messaging & Persistence"
            Kafka["Kafka Cluster (Strimzi KRaft)"]
            Mongo[MongoDB ReplicaSet 3-node]
            Redis[Redis Single Instance]
        end
    end

    User -->|HTTPS/HTTP| Ingress
    Ingress -->|"/ (root)"| FE
    Ingress -->|/api| Gateway
    Ingress -->|/reference| ApiDocs

    FE --> FE_Pods

    Gateway -->|"/api/auth/**"| Auth
    Gateway -->|"POST/PUT/DELETE /api/boards"| Cmd
    Gateway -->|"GET /api/boards"| Query
    Gateway -->|"/api/tasks/**"| Cmd

    Cmd -->|Produce Events| Kafka
    Auth -->|Produce Events| Kafka
    Kafka -->|Consume Events| Query
    Kafka -->|Consume Events| Activity
    Kafka -->|Consume Events| Audit

    Auth --> Mongo
    Cmd --> Mongo
    Query --> Mongo
    Audit --> Mongo
    Query --> Redis
```

## Slide 2: Microservices Patterns (CQRS & API Gateway)

This diagram details the Command Query Responsibility Segregation (CQRS) pattern and how the API Gateway routes traffic.

**Key Implementation Details:**

- Both Command and Query services connect to the **same MongoDB database** (`cascade-board`)
- Command service writes data directly to MongoDB, Query service reads it
- Events ensure cache invalidation and eventual consistency
- All services in the same MongoDB ReplicaSet but using different databases for separation of concerns

```mermaid
sequenceDiagram
    participant User
    participant Ingress as Nginx Ingress
    participant Gateway as API Gateway (Nginx)
    participant Cmd as Board Command Service
    participant Kafka as Kafka (Strimzi)
    participant Query as Board Query Service
    participant DB as MongoDB (cascade-board DB)
    participant Cache as Redis

    Note over User, Gateway: WRITE Operation (Command)
    User->>Ingress: POST /api/boards (Create Board)
    Ingress->>Gateway: Forward to API Gateway
    Gateway->>Cmd: Route POST to Command Service
    Cmd->>DB: Write Board to cascade-board DB
    Cmd->>Kafka: Publish "board.created" Event
    Cmd-->>User: 200 OK (Board Created)

    Note over Kafka, Query: Async Event Propagation
    Kafka->>Query: Consume "board.created" Event
    Query->>Cache: Invalidate Board Cache Keys

    Note over User, Gateway: READ Operation (Query)
    User->>Ingress: GET /api/boards
    Ingress->>Gateway: Forward to API Gateway
    Gateway->>Query: Route GET to Query Service
    Query->>Cache: Check Redis Cache
    alt Cache Hit
        Query-->>User: Return Cached Boards
    else Cache Miss
        Query->>DB: Read from cascade-board DB
        Query->>Cache: Store in Cache (TTL: 5 min)
        Query-->>User: Return Boards from DB
    end
```

## Slide 3: Reactive Programming Pattern (RxJS)

This diagram shows how the Activity service uses reactive programming with RxJS to process Kafka events as observable streams.

**Key Implementation Details:**

- Activity service uses `ReactiveKafkaConsumer` wrapper for Kafka integration
- Events are processed as RxJS Observable streams with operators
- Demonstrates reactive paradigm with `map`, `filter`, `tap`, and `catchError` operators
- Provides backpressure handling and graceful error recovery

```mermaid
sequenceDiagram
    participant Kafka as Kafka Topics
    participant Subject as RxJS Subject
    participant Pipeline as Observable Pipeline
    participant Activity as Activity Logger

    Note over Kafka, Subject: Event Stream Initialization
    Kafka->>Subject: Message arrives (board.created)
    Subject->>Pipeline: next(payload)

    Note over Pipeline: Reactive Operators Chain
    Note over Pipeline: tap - log debug info
    Note over Pipeline: filter - validate data exists
    Note over Pipeline: map - transform to activity
    Note over Pipeline: catchError - handle errors gracefully

    Pipeline->>Activity: Processed event
    Activity->>Activity: Log activity to stdout
    
    Note over Subject, Activity: Stream Continues (Non-blocking)
    
    Kafka->>Subject: Next message (task.moved)
    Subject->>Pipeline: next(payload)
    Pipeline->>Activity: Processed event
```
