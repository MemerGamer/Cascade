# Cascade GKE Architecture - Detailed Documentation

## Table of Contents

1. [Overview](#overview)
2. [Cluster Components](#cluster-components)
3. [Network Architecture](#network-architecture)
4. [Service Discovery & Communication](#service-discovery--communication)
5. [Database Architecture](#database-architecture)
6. [Data Flow & Synchronization](#data-flow--synchronization)
7. [Caching Strategy](#caching-strategy)
8. [Event-Driven Architecture](#event-driven-architecture)
9. [Deployment Topology](#deployment-topology)
10. [Configuration & Secrets](#configuration--secrets)

---

## Overview

Cascade is deployed on Google Kubernetes Engine (GKE) using Helm charts. The architecture implements several microservices patterns:

- **CQRS (Command Query Responsibility Segregation)**: Separate services for reads and writes
- **API Gateway Pattern**: Centralized request routing via Nginx
- **Event-Driven Architecture**: Kafka-based event streaming for async operations
- **Database per Service**: Logical separation using different databases in the same MongoDB cluster
- **Caching Layer**: Redis for read optimization

### Deployed Services in GKE

The following services are deployed to the Kubernetes cluster:

| Service | Port | Purpose | Replicas (HPA) |
|---------|------|---------|----------------|
| **Frontend** | 3000 | React SPA (Vite + TanStack Router) | 1-5 (autoscaling) |
| **API Gateway** | 80 | Nginx reverse proxy with CQRS routing | 1 (static) |
| **Auth Service** | 3001 | User authentication (Better Auth) | 1-5 (autoscaling) |
| **Board Command** | 3002 | Write operations for boards/tasks | 1-5 (autoscaling) |
| **Board Query** | 3003 | Read operations with caching | 1-5 (autoscaling) |
| **Activity Service** | 3004 | Real-time activity logging (Kafka consumer) | 1 (static) |
| **Audit Service** | 3005 | Immutable audit trail (Kafka consumer) | 1 (static) |
| **API Docs** | 3006 | Scalar API documentation | 1 (static) |

### Infrastructure Components

| Component | Type | Purpose |
|-----------|------|---------|
| **MongoDB** | StatefulSet (3 replicas) | Primary data store with replica set |
| **Redis** | Deployment (1 replica) | Caching layer for read operations |
| **Kafka** | Strimzi Operator (1 node) | Event streaming platform (KRaft mode) |
| **Nginx Ingress** | Controller | External traffic routing |

---

## Cluster Components

### 1. Ingress Controller (Entry Point)

**Component:** Nginx Ingress Controller  
**What it does:** Routes all external HTTP/HTTPS traffic into the cluster

**Routing Rules:**

```yaml
# From ingress.yaml template
- path: /api          → API Gateway (port 80)
- path: /reference    → API Docs Service (port 3006)
- path: /             → Frontend Service (port 80)
```

**How it works:**

- External users access the cluster via a single IP address
- The ingress examines the request path and forwards to the appropriate ClusterIP service
- All backend services remain internal (ClusterIP), not exposed to the internet

### 2. API Gateway (Nginx)

**Component:** Nginx-based API Gateway  
**Configuration:** `/helm/cascade/files/nginx.conf`  
**What it does:** Implements CQRS routing pattern by inspecting HTTP methods

**Routing Logic:**

```nginx
# Auth Service - All methods
location /api/auth {
    proxy_pass http://cascade-auth:3001;
}

# Boards - CQRS Split
location /api/boards {
    # Default: GET requests go to Query Service
    proxy_pass http://board_query;  # cascade-board-query:3003
    
    # Non-GET methods (POST/PUT/DELETE) go to Command Service
    limit_except GET {
        proxy_pass http://board_command;  # cascade-board-command:3002
    }
}

# Tasks - All methods to Command Service
location /api/tasks {
    proxy_pass http://cascade-board-command:3002;
}
```

**Why this design?**

- **Performance:** Read-heavy operations (GET) are routed to the optimized Query service with caching
- **Data Integrity:** Write operations (POST/PUT/DELETE) go to Command service which handles validation and event publishing
- **Scalability:** Query and Command services can scale independently based on load

### 3. Frontend Service

**Technology:** React + Vite + TanStack Router  
**Container Port:** 3000  
**Image:** `europe-west1-docker.pkg.dev/PROJECT_ID/cascade/frontend:latest`

**How Frontend Knows Which Services to Call:**

The frontend uses intelligent service discovery defined in `frontend/src/lib/config.ts`:

```typescript
const getApiUrl = (port: number, serviceName: string) => {
  // Browser / Client Side
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost") {
      return ""; // Use relative path (Ingress routing)
    }
    return `http://localhost:${port}`; // Local development
  }

  // Server Side (SSR) - not currently used but future-proofed
  if (import.meta.env.PROD) {
    return `http://${serviceName}:${port}`; // Internal K8s Service DNS
  }
  return `http://localhost:${port}`;
};

export const API_URLS = {
  AUTH: import.meta.env.VITE_AUTH_URL || getApiUrl(3001, "cascade-auth"),
  BOARD_COMMAND: import.meta.env.VITE_BOARD_COMMAND_URL || getApiUrl(3002, "cascade-board-command"),
  BOARD_QUERY: import.meta.env.VITE_BOARD_QUERY_URL || getApiUrl(3003, "cascade-board-query"),
};
```

**Key Insight:**

- **In production (GKE):** Frontend uses **relative paths** (empty string)
  - Example: `fetch("/api/boards")` → Goes through Ingress → API Gateway → Routed to appropriate service
- **In local development:** Frontend uses `http://localhost:PORT` to connect directly to services
- **Environment variables** can override defaults if needed (VITE_AUTH_URL, etc.)

**Why relative paths in production?**

1. **Same-origin policy:** No CORS issues since all requests appear to come from the same domain
2. **Simplicity:** No need to know internal service addresses
3. **Security:** Internal service addresses remain hidden from the client
4. **Flexibility:** Ingress can change routing without frontend changes

### 4. Auth Service

**Port:** 3001  
**Database:** `cascade-auth` (MongoDB)  
**Purpose:** User authentication and session management

**Features:**

- Email/password authentication (Better Auth)
- GitHub OAuth integration
- JWT token generation and validation
- Session management

**Database Connection:**

```env
MONGODB_URI=mongodb://cascade-mongodb-0.cascade-mongodb-headless:27017,
            cascade-mongodb-1.cascade-mongodb-headless:27017,
            cascade-mongodb-2.cascade-mongodb-headless:27017/cascade-auth?replicaSet=rs0
```

**Environment Variables:**

- `AUTH_SECRET`: Secret for Better Auth
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth secret
- `JWT_SECRET`: JWT signing key (shared with other services)

### 5. Board Command Service

**Port:** 3002  
**Database:** `cascade-board` (MongoDB)  
**Purpose:** Handle all write operations (CREATE, UPDATE, DELETE)

**Responsibilities:**

1. Validate incoming requests
2. Write data to MongoDB
3. Publish events to Kafka
4. Return response to client

**Example Flow - Creating a Board:**

```typescript
// 1. Receive POST /api/boards request
const newBoard = await BoardModel.create({
  name: "My Board",
  ownerId: "user123",
  visibility: "private",
  members: [{ userId: "user123", role: "owner" }],
  columns: [],
  tags: []
});

// 2. Publish event to Kafka
await kafkaClient.send("board.created", {
  boardId: newBoard._id,
  name: newBoard.name,
  ownerId: newBoard.ownerId,
  timestamp: new Date().toISOString()
});

// 3. Return response
return { success: true, board: newBoard };
```

**Kafka Events Published:**

- `board.created`
- `board.updated`
- `board.deleted`
- `task.created`
- `task.moved`
- `task.updated`
- `task.deleted`

### 6. Board Query Service

**Port:** 3003  
**Database:** `cascade-board` (MongoDB) - **Same database as Command service**  
**Cache:** Redis  
**Purpose:** Optimized read operations with caching

**Responsibilities:**

1. Handle GET requests for boards and tasks
2. Check Redis cache first
3. Query MongoDB on cache miss
4. Update cache with results
5. Consume Kafka events to invalidate stale cache entries

**Cache Strategy:**

```typescript
// Example: Get Boards by Owner
export async function getBoards(ownerId: string) {
  // 1. Check cache first
  const cached = await getCachedBoards(ownerId);
  if (cached) {
    return { success: true, boards: cached };
  }

  // 2. Cache miss - query database
  const boards = await Board.find({ 
    "members.userId": ownerId 
  });

  // 3. Update cache (TTL: 5 minutes)
  await setCachedBoards(ownerId, boards);

  return { success: true, boards };
}
```

**Cache Keys:**

- `boards:{userId}` - User's board list
- `board:{boardId}` - Individual board details
- `tasks:{boardId}` - Tasks for a specific board

**Cache Invalidation:**
The Query service listens to Kafka events and invalidates cache when data changes:

```typescript
// Kafka consumer handles cache invalidation
async function handleBoardUpdated(event: any) {
  const board = await Board.findById(event.boardId);
  if (board) {
    // Invalidate cache for owner
    await invalidateBoardCache(event.boardId, board.ownerId);
    
    // Invalidate cache for all members
    for (const member of board.members) {
      await invalidateBoardCache(event.boardId, member.userId);
    }
  }
}
```

**Cache TTL:** 5 minutes (300 seconds)

### 7. Activity Service

**Port:** 3004  
**Purpose:** Real-time activity monitoring and logging

**Responsibilities:**
1. Consume all relevant Kafka events
2. Log activities in real-time
3. Provide activity monitoring capabilities

**Kafka Events Consumed:**
- `user.registered`
- `user.logged_in`
- `board.created`
- `task.created`
- `task.moved`
- `task.updated`

**No Database:** Activity service only logs to stdout (captured by Kubernetes logging)

**Use Cases:**
- Real-time activity monitoring
- Debugging and troubleshooting
- User behavior analytics
- System health monitoring

**Example Activity Log:**
```json
{
  "event": "task.moved",
  "data": {
    "taskId": "507f1f77bcf86cd799439012",
    "boardId": "507f1f77bcf86cd799439011",
    "oldColumnId": "col_todo",
    "newColumnId": "col_inprogress"
  },
  "processedAt": "2025-01-07T10:40:00.000Z"
}
```

### 8. Audit Service

**Port:** 3005  
**Database:** `cascade-audit` (MongoDB)  
**Purpose:** Immutable audit trail for compliance and security

**Responsibilities:**
1. Consume all relevant Kafka events
2. Store immutable audit records in MongoDB
3. Maintain complete event history

**Kafka Events Consumed:**
- `user.registered`
- `user.logged_in`
- `board.created`
- `task.created`
- `task.moved`
- `task.updated`

**Database Connection:**

```env
MONGODB_URI=mongodb://cascade-mongodb-0.cascade-mongodb-headless:27017,
            cascade-mongodb-1.cascade-mongodb-headless:27017,
            cascade-mongodb-2.cascade-mongodb-headless:27017/cascade-audit?replicaSet=rs0
```

**Audit Record Schema:**

```javascript
{
  eventType: "task.moved",
  eventData: {
    taskId: "507f1f77bcf86cd799439012",
    boardId: "507f1f77bcf86cd799439011",
    oldColumnId: "col_todo",
    newColumnId: "col_inprogress",
    timestamp: "2025-01-07T10:40:00.000Z"
  },
  userId: "user_abc123",
  timestamp: ISODate("2025-01-07T10:40:00.000Z")
}
```

**Key Features:**
- **Immutable:** Records are never updated or deleted
- **Indexed:** Fast queries by eventType, userId, and timestamp
- **Compliance:** Meets audit trail requirements for regulations
- **Forensics:** Complete history for security investigations

**Use Cases:**
- Compliance auditing (SOC2, GDPR, etc.)
- Security forensics and incident response
- Historical data analysis
- User activity tracking
- Debugging complex issues

### 9. API Docs Service

**Port:** 3006  
**Purpose:** Serve API documentation via Scalar

Provides interactive API documentation at `/reference` path.

---

## Network Architecture

### Internal Service Communication

Kubernetes uses **DNS-based service discovery** for internal communication. Services communicate using their Kubernetes service names:

**Service DNS Format:**

```
<service-name>.<namespace>.svc.cluster.local:<port>
```

**Actual Service Names:**

- `cascade-auth.default.svc.cluster.local:3001`
- `cascade-board-command.default.svc.cluster.local:3002`
- `cascade-board-query.default.svc.cluster.local:3003`
- `cascade-frontend.default.svc.cluster.local:80`
- `cascade-api-gateway.default.svc.cluster.local:80`
- `cascade-mongodb-headless.default.svc.cluster.local:27017`
- `cascade-redis-master.default.svc.cluster.local:6379`
- `cascade-kafka-kafka-bootstrap.default.svc.cluster.local:9092`

**Short form (within same namespace):**

```
cascade-auth:3001
cascade-board-command:3002
```

### Service Types

All application services use **ClusterIP** (internal only):

```yaml
spec:
  type: ClusterIP  # Only accessible within cluster
  ports:
    - port: 3001   # Service port
      targetPort: http  # Container port
```

**Why ClusterIP?**

- Services don't need external access
- More secure (not exposed to internet)
- Ingress controller is the only external entry point

### Network Flow Diagram

```
Internet
    ↓
[GCP Load Balancer]
    ↓
[Nginx Ingress Controller] (External IP)
    ↓
    ├─→ /api/* → [API Gateway ClusterIP:80]
    │              ├─→ /api/auth → [Auth Service ClusterIP:3001]
    │              ├─→ GET /api/boards → [Board Query ClusterIP:3003]
    │              ├─→ POST/PUT/DELETE /api/boards → [Board Command ClusterIP:3002]
    │              └─→ /api/tasks → [Board Command ClusterIP:3002]
    │
    ├─→ /reference → [API Docs ClusterIP:3006]
    │
    └─→ /* → [Frontend ClusterIP:80]

Internal Communication:
[Board Command] ──produce──→ [Kafka ClusterIP:9092]
[Kafka] ──consume──→ [Board Query]
[Auth/Command/Query] ──read/write──→ [MongoDB StatefulSet]
[Board Query] ──cache──→ [Redis ClusterIP:6379]
```

---

## Service Discovery & Communication

### How Frontend Knows Which Service to Call

The frontend doesn't directly know about backend services. Instead:

1. **In Production (GKE):**
   - Frontend makes requests to **relative paths**: `/api/auth/session`, `/api/boards`, etc.
   - Browser sends these to the same domain (ingress IP)
   - Nginx Ingress routes based on path to API Gateway
   - API Gateway routes to appropriate service based on path + HTTP method

2. **In Development (localhost):**
   - Frontend directly calls `http://localhost:3001`, `http://localhost:3002`, etc.
   - Services run via docker-compose on known ports

**Configuration Logic:**

```typescript
// frontend/src/lib/config.ts
if (window.location.hostname !== "localhost") {
  // Production: Use relative paths (empty string)
  // fetch("/api/boards") → Goes through ingress
  return "";
} else {
  // Development: Use direct localhost URLs
  // fetch("http://localhost:3003/api/boards")
  return `http://localhost:${port}`;
}
```

**API Layer Example:**

```typescript
// frontend/src/lib/api.ts
export async function getBoards(ownerId: string) {
  // API_URLS.BOARD_QUERY is "" in production
  const res = await fetch(
    `${API_URLS.BOARD_QUERY}/api/boards?ownerId=${ownerId}`
  );
  // Actual request in production: fetch("/api/boards?ownerId=...")
  return res.json();
}
```

### How Services Know Which Database to Call

Each service has a **MONGODB_URI environment variable** injected by Kubernetes:

```yaml
# Example from deployment-board-command.yaml
env:
  - name: MONGODB_URI
    value: "mongodb://cascade-mongodb-0.cascade-mongodb-headless:27017,cascade-mongodb-1.cascade-mongodb-headless:27017,cascade-mongodb-2.cascade-mongodb-headless:27017/cascade-board?replicaSet=rs0"
```

**Breaking down the connection string:**

```
mongodb://
  cascade-mongodb-0.cascade-mongodb-headless:27017,  # Replica 1
  cascade-mongodb-1.cascade-mongodb-headless:27017,  # Replica 2
  cascade-mongodb-2.cascade-mongodb-headless:27017   # Replica 3
  /cascade-board                                     # Database name
  ?replicaSet=rs0                                    # Replica set name
```

**Service-Specific Databases:**

| Service | Database Name | Purpose |
|---------|---------------|---------|
| Auth Service | `cascade-auth` | User accounts, sessions |
| Board Command | `cascade-board` | Boards, tasks (write) |
| Board Query | `cascade-board` | Boards, tasks (read) |
| Audit Service | `cascade-audit` | Immutable audit events |
| Activity Service | None | Logs to stdout only |

**Why the same database for Command and Query?**

- They work with the same data model (boards and tasks)
- Logical separation is achieved through service boundaries, not database boundaries
- MongoDB replica set ensures consistency across all replicas
- Events ensure cache coherence

### DNS Resolution in Kubernetes

**Headless Service for MongoDB:**

```yaml
# mongodb.yaml
apiVersion: v1
kind: Service
metadata:
  name: cascade-mongodb-headless
spec:
  clusterIP: None  # Headless service
  ports:
    - port: 27017
  selector:
    app.kubernetes.io/component: mongodb
```

**Why headless?**

- Each MongoDB pod needs its own stable DNS name for replica set
- Headless service provides: `cascade-mongodb-0.cascade-mongodb-headless`, `cascade-mongodb-1.cascade-mongodb-headless`, etc.
- MongoDB driver connects to all replicas for high availability

**Regular Service for Redis:**

```yaml
# redis.yaml
apiVersion: v1
kind: Service
metadata:
  name: cascade-redis-master
spec:
  type: ClusterIP
  ports:
    - port: 6379
```

Board Query service connects: `redis://cascade-redis-master:6379`

**Kafka Service (Managed by Strimzi):**

```yaml
# Automatically created by Strimzi operator
cascade-kafka-kafka-bootstrap.default.svc.cluster.local:9092
```

Services connect using environment variable:

```yaml
env:
  - name: KAFKA_BROKERS
    value: "cascade-kafka-kafka-bootstrap.default.svc.cluster.local:9092"
```

---

## Database Architecture

### MongoDB Replica Set

**Deployment Type:** StatefulSet (for stable network identities)  
**Replicas:** 3 nodes  
**Replica Set Name:** `rs0`

**Why Replica Set?**

1. **High Availability:** If one node fails, others continue serving
2. **Data Redundancy:** Data replicated across all 3 nodes
3. **Read Scalability:** Reads can be distributed across replicas
4. **Automatic Failover:** MongoDB elects new primary if current fails

**Initialization:**

The replica set is initialized via a Kubernetes Job:

```yaml
# mongodb-init-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: cascade-mongodb-init
spec:
  template:
    spec:
      containers:
        - name: mongo-init
          image: mongo:latest
          command:
            - mongosh
            - --host
            - cascade-mongodb-0.cascade-mongodb-headless:27017
            - --eval
            - |
              rs.initiate({
                _id: "rs0",
                members: [
                  { _id: 0, host: "cascade-mongodb-0.cascade-mongodb-headless:27017" },
                  { _id: 1, host: "cascade-mongodb-1.cascade-mongodb-headless:27017" },
                  { _id: 2, host: "cascade-mongodb-2.cascade-mongodb-headless:27017" }
                ]
              });
      restartPolicy: OnFailure
```

**Storage:**
Each MongoDB pod has a dedicated PersistentVolumeClaim (1Gi):

```yaml
volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 1Gi
```

### Database Structure

**Physical Organization:**

```
MongoDB Replica Set (rs0)
├── cascade-auth (database)
│   └── users (collection)
│   └── sessions (collection)
│   └── accounts (collection)
│
├── cascade-board (database)
│   ├── boards (collection)
│   │   ├── _id
│   │   ├── name
│   │   ├── ownerId
│   │   ├── members []
│   │   ├── columns []
│   │   └── tags []
│   │
│   └── tasks (collection)
│       ├── _id
│       ├── boardId
│       ├── columnId
│       ├── title
│       ├── description
│       └── assignedTo
│
└── cascade-audit (database)
    └── auditevents (collection)
        ├── eventType
        ├── eventData
        ├── userId
        └── timestamp
```

**Collections Explained:**

**1. Boards Collection:**

```javascript
{
  _id: ObjectId("..."),
  name: "Sprint Planning",
  description: "Q1 2025 Sprint",
  ownerId: "user_abc123",
  visibility: "private",  // or "public"
  joinPin: "123456",      // for private boards
  members: [
    { userId: "user_abc123", role: "owner", joinedAt: ISODate(...) },
    { userId: "user_def456", role: "member", joinedAt: ISODate(...) }
  ],
  columns: [
    { id: "col_1", name: "To Do", order: 0, color: "#64748b" },
    { id: "col_2", name: "In Progress", order: 1, color: "#3b82f6" },
    { id: "col_3", name: "Done", order: 2, color: "#10b981" }
  ],
  tags: [
    { id: "tag_1", name: "Bug", color: "#ef4444" },
    { id: "tag_2", name: "Feature", color: "#8b5cf6" }
  ],
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

**2. Tasks Collection:**

```javascript
{
  _id: ObjectId("..."),
  boardId: ObjectId("..."),  // Reference to board
  columnId: "col_1",
  title: "Implement user authentication",
  description: "Add OAuth support",
  assignedTo: "user_def456",
  tags: ["tag_2"],  // Array of tag IDs
  priority: "high",  // low, medium, high
  dueDate: ISODate(...),
  order: 0,
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

### Database Separation Strategy

**"Database per Service" Pattern Implementation:**

While multiple services connect to the same MongoDB cluster, they use **different databases**:

```
MongoDB Cluster
├── Auth Service → cascade-auth database
├── Board Command → cascade-board database
└── Board Query → cascade-board database (same as Command)
```

**Why Board Command and Query share the same database?**

This is a pragmatic implementation of CQRS:

1. **Simplified Deployment:** No need for database replication between command and query
2. **Strong Consistency:** Both services see the same data immediately
3. **Eventual Consistency via Cache:** Redis cache provides query optimization
4. **Event-Driven Sync:** Kafka events ensure cache invalidation

**Alternative (More Complex) Approach:**

- Command writes to `cascade-board-write`
- Query reads from `cascade-board-read`
- Change Data Capture (CDC) or events replicate data between them
- **Not implemented** because added complexity doesn't justify benefits at this scale

---

## Data Flow & Synchronization

### Are the Databases All in Sync?

**Short Answer:** Yes, with two levels of synchronization:

#### Level 1: MongoDB Replica Set Synchronization

**How it works:**

1. All writes go to the **PRIMARY** node
2. PRIMARY replicates changes to **SECONDARY** nodes via the oplog (operation log)
3. Secondaries apply operations in the same order as primary
4. Replication is **asynchronous** but typically completes in milliseconds

**Guarantee:** MongoDB ensures all replicas eventually have identical data (eventual consistency within the replica set)

**Read Preference:**
By default, services read from PRIMARY for strong consistency. MongoDB driver can be configured to read from secondaries for better distribution.

**Connection String Analysis:**

```
mongodb://mongo1:27017,mongo2:27017,mongo3:27017/cascade-board?replicaSet=rs0
```

- Lists all 3 replicas
- Driver automatically discovers PRIMARY and connects
- If PRIMARY fails, driver reconnects to new PRIMARY after election

#### Level 2: Command-Query Synchronization

**Challenge:** Board Query service uses Redis cache, which can become stale when Board Command writes to MongoDB.

**Solution:** Event-driven cache invalidation via Kafka

**Synchronization Flow:**

```
1. Client Request
   ↓
2. Command Service receives POST /api/boards
   ↓
3. Write to MongoDB (cascade-board)
   ↓
4. Publish "board.created" event to Kafka
   ↓
5. Return success to client
   ↓
6. (Async) Query Service consumes event from Kafka
   ↓
7. Invalidate related cache keys in Redis
   ↓
8. Next GET request will fetch fresh data from MongoDB
```

**Detailed Example - Updating a Board:**

```typescript
// === COMMAND SERVICE (board-command) ===
// 1. Receive update request
app.put('/api/boards/:id', async (c) => {
  const boardId = c.req.param('id');
  const updates = await c.req.json();
  
  // 2. Update MongoDB
  const board = await Board.findByIdAndUpdate(
    boardId, 
    updates, 
    { new: true }
  );
  
  // 3. Publish event to Kafka
  await kafkaClient.send("board.updated", {
    boardId: board._id,
    updates: updates,
    timestamp: new Date().toISOString()
  });
  
  // 4. Return immediately (don't wait for cache invalidation)
  return c.json({ success: true, board });
});

// === KAFKA TOPIC ===
// Event: board.updated
// Data: { boardId: "123", updates: {...}, timestamp: "..." }

// === QUERY SERVICE (board-query) ===
// 5. Consume event from Kafka
async function handleBoardUpdated(event: any) {
  const board = await Board.findById(event.boardId);
  
  if (board) {
    // 6. Invalidate cache for owner
    await redis.del(`board:${event.boardId}`);
    await redis.del(`boards:${board.ownerId}`);
    
    // 7. Invalidate cache for all members
    for (const member of board.members) {
      await redis.del(`boards:${member.userId}`);
    }
  }
}

// 8. Next GET request rebuilds cache from fresh MongoDB data
app.get('/api/boards/:id', async (c) => {
  const boardId = c.req.param('id');
  
  // Check cache (will be empty after invalidation)
  const cached = await redis.get(`board:${boardId}`);
  if (!cached) {
    // Fetch fresh data from MongoDB
    const board = await Board.findById(boardId);
    
    // Update cache
    await redis.setex(`board:${boardId}`, 300, JSON.stringify(board));
    
    return c.json({ success: true, board });
  }
  
  return c.json({ success: true, board: JSON.parse(cached) });
});
```

**Timing Analysis:**

| Step | Time | Notes |
|------|------|-------|
| MongoDB write | ~10ms | PRIMARY write |
| Kafka publish | ~5ms | Async, non-blocking |
| Client response | **~15ms total** | User sees success immediately |
| Kafka consumption | ~50-500ms | Depends on consumer poll interval |
| Cache invalidation | ~5ms | Redis DEL operation |
| **Total propagation** | **~70-520ms** | Cache stale for this duration |

**Consistency Model:**

- **Strong consistency** for writes (MongoDB PRIMARY)
- **Eventual consistency** for reads (cache invalidation lag)
- **Acceptable staleness:** 70-520ms is negligible for most use cases
- **Cache TTL:** Even if events fail, cache expires after 5 minutes

### Data Consistency Guarantees

**Within MongoDB Replica Set:**

- ✅ **Guaranteed eventual consistency**
- ✅ **Strong consistency for reads from PRIMARY**
- ✅ **Automatic failover and recovery**

**Between Command and Query Services:**

- ✅ **Same database** = Strong consistency for data
- ⚠️ **Cache can be stale** for 70-520ms after writes
- ✅ **Cache TTL** (5 min) limits maximum staleness
- ✅ **Event-driven invalidation** ensures cache freshness

**What happens if Kafka is down?**

1. Command service continues writing to MongoDB
2. Query service continues serving (from cache or DB)
3. Cache may become stale until Kafka recovers
4. Cache TTL (5 minutes) limits impact
5. Critical: Reads still work, just might see slightly old data

**What happens if Redis is down?**

1. Query service catches Redis errors
2. Falls back to direct MongoDB reads
3. Performance degradation (no caching)
4. Functionality preserved

**Code Example - Resilient Cache:**

```typescript
export async function getCachedBoards(userId: string): Promise<any[] | null> {
  try {
    const cached = await redis.get(`boards:${userId}`);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    // Log error but don't fail - fallback to DB
    GlobalLogger.logger.warn({ err }, "Redis failed, using DB");
    return null;  // Triggers DB fallback
  }
}
```

---

## Caching Strategy

### Redis Cache Architecture

**Deployment:** Single Redis instance (1 replica)  
**Service:** `cascade-redis-master:6379`  
**Storage:** 1Gi PersistentVolumeClaim

**Cache Keys:**

| Key Pattern | Description | Example | TTL |
|-------------|-------------|---------|-----|
| `boards:{userId}` | User's board list | `boards:user_123` | 5 min |
| `board:{boardId}` | Single board details | `board:abc456` | 5 min |
| `tasks:{boardId}` | Tasks for a board | `tasks:abc456` | 5 min |

### Cache Operations

**1. Read-Through Caching:**

```typescript
async function getBoards(ownerId: string) {
  // 1. Try cache
  const cached = await getCachedBoards(ownerId);
  if (cached) {
    return { success: true, boards: cached };
  }
  
  // 2. Cache miss - query database
  const boards = await Board.find({ 
    "members.userId": ownerId 
  });
  
  // 3. Populate cache
  await setCachedBoards(ownerId, boards);
  
  return { success: true, boards };
}
```

**2. Write-Through Invalidation:**

```typescript
// Command service publishes event after write
await kafkaClient.send("board.updated", { boardId, updates });

// Query service invalidates cache on event
async function handleBoardUpdated(event: any) {
  await redis.del(`board:${event.boardId}`);
  await redis.del(`boards:${ownerId}`);
}
```

**Why invalidate instead of update cache?**

1. **Simpler logic:** Don't need to reconstruct full cache entries
2. **Consistency:** Avoid race conditions between updates
3. **Lazy loading:** Only cache data that's actually requested
4. **Lower memory:** Don't cache data nobody is reading

### Cache Performance Impact

**Without Cache:**

- Every GET request hits MongoDB
- ~20-50ms per query
- MongoDB becomes bottleneck under load

**With Cache:**

- Cache hit: ~2-5ms (Redis in-memory)
- Cache miss: ~25-55ms (Redis check + MongoDB query + cache write)
- **Typical hit rate:** 70-90% for active boards
- **Performance gain:** 4-10x faster for cached reads

**Memory Usage Estimate:**

```
Average board document: ~2KB (with members, columns, tags)
Average task document: ~0.5KB
Typical board with 50 tasks: ~27KB

1000 active boards with cache: ~27MB
Redis deployment: 1Gi PVC (plenty of headroom)
```

### Cache Warming Strategies

**Current:** Lazy loading (cache populated on first request after invalidation)

**Potential Optimizations (not implemented):**

1. **Pre-warm popular boards** on app startup
2. **Predictive caching** based on user behavior
3. **Background refresh** before TTL expiration

---

## Event-Driven Architecture

### Kafka Configuration

**Deployment:** Strimzi Operator with KRaft mode (no Zookeeper)  
**Brokers:** 1 node  
**Storage:** 1Gi persistent volume

**Why KRaft instead of Zookeeper?**

- Simpler architecture (fewer components)
- Better performance
- Official Kafka direction (Zookeeper deprecated)

**Topics (Auto-created):**

- `board.created`
- `board.updated`
- `board.deleted`
- `task.created`
- `task.moved`
- `task.updated`
- `task.deleted`

**Replication Factor:** 1 (single broker)  
**Partition Strategy:** Default (1 partition per topic)

### Event Flow

```
┌─────────────────┐
│ Board Command   │
│    Service      │
└────────┬────────┘
         │
         │ Produce Event
         ↓
┌─────────────────┐
│     Kafka       │
│   (Strimzi)     │
└────────┬────────┘
         │
         │ Consume Event
         ↓
┌─────────────────┐
│  Board Query    │
│    Service      │
└─────────────────┘
         │
         ↓
   Invalidate Cache
```

### Event Schema Examples

**1. board.created:**

```json
{
  "boardId": "507f1f77bcf86cd799439011",
  "name": "New Sprint Board",
  "ownerId": "user_abc123",
  "timestamp": "2025-01-07T10:30:00.000Z"
}
```

**2. board.updated:**

```json
{
  "boardId": "507f1f77bcf86cd799439011",
  "updates": {
    "name": "Updated Sprint Board",
    "description": "New description"
  },
  "timestamp": "2025-01-07T10:35:00.000Z"
}
```

**3. task.moved:**

```json
{
  "taskId": "507f1f77bcf86cd799439012",
  "boardId": "507f1f77bcf86cd799439011",
  "oldColumnId": "col_todo",
  "newColumnId": "col_inprogress",
  "order": 2,
  "timestamp": "2025-01-07T10:40:00.000Z"
}
```

### Producer Configuration

```typescript
// backend/services/board-command/src/kafka.ts
import { KafkaClient } from "@cascade/kafka";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(",");
// Value: "cascade-kafka-kafka-bootstrap.default.svc.cluster.local:9092"

export const kafkaClient = new KafkaClient(
  "board-command-service",
  KAFKA_BROKERS
);

export async function initKafka() {
  await kafkaClient.connectProducer();
  // Ready to publish events
}

// Publish event
export async function publishBoardCreated(boardId, name, ownerId) {
  await kafkaClient.send("board.created", {
    boardId,
    name,
    ownerId,
    timestamp: new Date().toISOString()
  });
}
```

### Consumer Configuration

```typescript
// backend/services/board-query/src/kafka.ts
import { KafkaClient } from "@cascade/kafka";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(",");

export const kafkaClient = new KafkaClient(
  "board-query-service",
  KAFKA_BROKERS
);

const TOPICS = [
  "board.created",
  "board.updated",
  "board.deleted",
  "task.created",
  "task.moved",
  "task.updated",
  "task.deleted",
];

export async function initKafka() {
  // Connect consumer with group ID
  await kafkaClient.connectConsumer(
    "board-query-group",  // Consumer group
    TOPICS,
    false  // Don't read from beginning
  );
  
  // Start consuming
  await kafkaClient.consume(handleEvent);
}

async function handleEvent(payload: EachMessagePayload) {
  const { topic, message } = payload;
  const event = JSON.parse(message.value?.toString() || "{}");
  
  switch (topic) {
    case "board.created":
      await handleBoardCreated(event);
      break;
    case "board.updated":
      await handleBoardUpdated(event);
      break;
    // ... other handlers
  }
}
```

### Consumer Groups

**Group ID:** `board-query-group`

**Why Consumer Groups?**

1. **Scalability:** Multiple Query service replicas share the workload
2. **Fault Tolerance:** If one consumer dies, others take over
3. **Offset Management:** Kafka tracks which messages have been processed

**Example with 3 Query Service Replicas:**

```
Kafka Topic: board.updated (3 partitions)
├── Partition 0 → Query Service Pod 1
├── Partition 1 → Query Service Pod 2
└── Partition 2 → Query Service Pod 3
```

Each pod processes different partitions, distributing the load.

### Reliability Considerations

**At-Least-Once Delivery:**

- Kafka guarantees events aren't lost
- Consumers may receive duplicates if they crash before committing offset
- Cache invalidation is **idempotent** (safe to run multiple times)

**Retry Logic:**

```typescript
// backend/packages/kafka/src/index.ts
async connectConsumer(groupId: string, topics: string[]) {
  this.consumer = this.kafka.consumer({ groupId });
  await this.consumer.connect();

  for (const topic of topics) {
    let retries = 0;
    const maxRetries = 10;
    const baseDelay = 1000;  // 1 second

    while (retries < maxRetries) {
      try {
        await this.consumer.subscribe({ topic });
        break;  // Success
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
```

**What happens if events are lost?**

- Cache becomes stale
- Cache TTL (5 min) eventually expires
- Fresh data is fetched from MongoDB
- **Mitigation:** Cache TTL provides safety net

---

## Deployment Topology

### Pod Distribution

```
GKE Cluster (default namespace)
├── Frontend Pods (1-5 replicas, HPA enabled)
├── API Gateway Pod (1 replica, static)
├── Auth Pods (1-5 replicas, HPA enabled)
├── Board Command Pods (1-5 replicas, HPA enabled)
├── Board Query Pods (1-5 replicas, HPA enabled)
├── Activity Pod (1 replica, static)
├── Audit Pod (1 replica, static)
├── API Docs Pod (1 replica, static)
├── MongoDB StatefulSet (3 replicas, cascade-mongodb-0/1/2)
├── Redis Deployment (1 replica)
└── Kafka Node (1 replica, managed by Strimzi Operator)
```

### Horizontal Pod Autoscaling (HPA)

**Enabled for:**

- Frontend
- Auth Service
- Board Command Service
- Board Query Service

**Configuration Example (from values.yaml):**

```yaml
auth:
  autoscaling:
    enabled: true
    minReplicas: 1
    maxReplicas: 5
    targetCPUUtilizationPercentage: 80
```

**How it works:**

1. Kubernetes monitors CPU usage of pods
2. When average CPU exceeds 80%, add more replicas
3. Scale up to maximum of 5 replicas
4. Scale down when CPU drops below threshold

**Scaling Behavior:**

```
Low Traffic (CPU < 80%):
└── 1 pod per service (minimum)

Medium Traffic (CPU 80-100%):
└── 2-3 pods per service

High Traffic (CPU > 100% sustained):
└── Up to 5 pods per service (maximum)
```

### Resource Limits

**From values.yaml:**

```yaml
auth:
  resources:
    requests:
      cpu: 100m      # 0.1 CPU core
      memory: 128Mi
    limits:
      cpu: 200m      # 0.2 CPU core
      memory: 256Mi
```

**Resource Budget per Service:**

| Service | CPU Request | Memory Request | CPU Limit | Memory Limit |
|---------|-------------|----------------|-----------|--------------|
| Auth | 100m | 128Mi | 200m | 256Mi |
| Board Command | 100m | 128Mi | - | - |
| Board Query | 100m | 128Mi | - | - |
| API Gateway | 50m | 64Mi | 100m | 128Mi |
| API Docs | 50m | 64Mi | - | - |

**Total Cluster Requirements (minimum):**

- CPU: ~600m (0.6 cores) - including Activity and Audit services
- Memory: ~832Mi
- Plus MongoDB, Redis, Kafka overhead (~500m CPU, ~1.5Gi RAM)
- **Grand Total:** ~1.1 CPU cores, ~2.3Gi RAM minimum

**Typical GKE Cluster:**

- 3 nodes (e2-medium: 2 vCPUs, 4GB RAM each)
- Total: 6 vCPUs, 12GB RAM
- Plenty of headroom for scaling

### Storage

**PersistentVolumeClaims:**

```
MongoDB:
├── cascade-mongodb-data-cascade-mongodb-0 (1Gi)
├── cascade-mongodb-data-cascade-mongodb-1 (1Gi)
└── cascade-mongodb-data-cascade-mongodb-2 (1Gi)

Redis:
└── cascade-redis (1Gi)

Kafka:
└── data-0-cascade-kafka-pool-0 (1Gi)
```

**StorageClass:** `standard` (GCP Persistent Disk)

**Total Storage:** ~6Gi

### Health Checks & Probes

Services expose health endpoints that Kubernetes monitors:

```yaml
# Example health check (if implemented)
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

**Note:** Current deployment templates don't explicitly define probes, relying on Kubernetes defaults.

---

## Configuration & Secrets

### Secrets Management

**Kubernetes Secret:** `cascade-secrets`

**Stored Values:**

| Secret Key | Used By | Purpose |
|------------|---------|---------|
| `AUTH_SECRET` | Auth Service | Better Auth secret key |
| `JWT_SECRET` | Auth, Command, Query | JWT token signing/verification |
| `GITHUB_CLIENT_ID` | Auth Service | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | Auth Service | GitHub OAuth secret |

**Secret Creation:**

```yaml
# helm/cascade/templates/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "cascade.fullname" . }}-secrets
type: Opaque
stringData:
  AUTH_SECRET: {{ .Values.secrets.authSecret | quote }}
  JWT_SECRET: {{ .Values.secrets.authSecret | quote }}  # Reuses AUTH_SECRET
  GITHUB_CLIENT_ID: {{ .Values.secrets.githubClientId | quote }}
  GITHUB_CLIENT_SECRET: {{ .Values.secrets.githubClientSecret | quote }}
```

**Injection into Pods:**

```yaml
# Example from deployment-auth.yaml
env:
  - name: AUTH_SECRET
    valueFrom:
      secretKeyRef:
        name: cascade-secrets
        key: AUTH_SECRET
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: cascade-secrets
        key: JWT_SECRET
```

### ConfigMaps

**API Gateway Nginx Configuration:**

```yaml
# helm/cascade/templates/configmap-api-gateway.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cascade-api-gateway-config
data:
  nginx.conf: |
    # Full nginx configuration from files/nginx.conf
    # Templated with Helm to include service names
```

**Mounted in API Gateway Pod:**

```yaml
volumeMounts:
  - name: config
    mountPath: /etc/nginx/nginx.conf
    subPath: nginx.conf
volumes:
  - name: config
    configMap:
      name: cascade-api-gateway-config
```

### Environment Variables

**Common Environment Variables:**

| Variable | Example Value | Purpose |
|----------|---------------|---------|
| `PORT` | `3001`, `3002`, `3003` | Service port |
| `NODE_ENV` | `production` | Environment mode |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `MONGODB_URI` | `mongodb://...` | Database connection string |
| `REDIS_URL` | `redis://cascade-redis-master:6379` | Cache connection |
| `KAFKA_BROKERS` | `cascade-kafka-kafka-bootstrap...:9092` | Event broker |
| `AUTH_SECRET` | `***` (from secret) | Auth encryption key |
| `JWT_SECRET` | `***` (from secret) | JWT signing key |
| `GITHUB_CLIENT_ID` | `***` (from secret) | OAuth app ID |
| `GITHUB_CLIENT_SECRET` | `***` (from secret) | OAuth secret |

**Override via values.yaml:**

```yaml
# helm/cascade/values.yaml
secrets:
  authSecret: "production-secret-here"
  githubClientId: "your-github-app-id"
  githubClientSecret: "your-github-app-secret"
```

**Set during Helm install/upgrade:**

```bash
helm upgrade cascade helm/cascade \
  --set secrets.authSecret="my-secret" \
  --set secrets.githubClientId="abc123" \
  --set secrets.githubClientSecret="xyz789"
```

### Image Repository Configuration

**Repository Pattern:**

```
europe-west1-docker.pkg.dev/PROJECT_ID/cascade/<service-name>:latest
```

**Services:**

- `auth-service:latest`
- `board-command-service:latest`
- `board-query-service:latest`
- `frontend:latest`
- `api-docs:latest` (uses backend Dockerfile with arg)

**Image Pull Policy:** `Always` (always pull latest tag)

**Configuration in values.yaml:**

```yaml
app:
  image:
    repository: europe-west1-docker.pkg.dev/PROJECT_ID/cascade
    pullPolicy: Always
    tag: "latest"
```

**Deployment reference:**

```yaml
spec:
  containers:
    - name: auth
      image: "{{ .Values.app.image.repository }}/auth-service:{{ .Values.app.image.tag }}"
      imagePullPolicy: {{ .Values.app.image.pullPolicy }}
```

---

## Summary

### Key Architectural Decisions

1. **CQRS Implementation:**
   - Separate Command and Query services
   - Both share the same MongoDB database
   - Cache invalidation via Kafka events
   - Pragmatic approach balancing simplicity and performance

2. **API Gateway Pattern:**
   - Nginx routes based on path and HTTP method
   - GET → Query Service (optimized reads)
   - POST/PUT/DELETE → Command Service (validated writes)
   - Frontend uses relative paths in production

3. **Service Discovery:**
   - Kubernetes DNS for service-to-service communication
   - Environment variables for database/cache/Kafka addresses
   - Frontend routes through Ingress (no direct service calls)

4. **Data Consistency:**
   - MongoDB replica set provides strong consistency
   - Redis cache invalidated via Kafka events
   - Acceptable eventual consistency window (70-520ms)
   - Cache TTL (5 min) limits maximum staleness

5. **Scalability:**
   - Horizontal Pod Autoscaling for application services
   - MongoDB replica set for database scalability
   - Kafka enables async processing
   - Redis reduces database load

6. **Resilience:**
   - MongoDB automatic failover
   - Graceful Redis failure handling (fallback to DB)
   - Kafka retry logic with exponential backoff
   - Cache TTL provides safety net for event failures

### Current Limitations & Future Improvements

**Current Limitations:**

1. **Single Redis instance:** No redundancy (becomes SPOF for caching)
2. **Single Kafka broker:** Limited throughput and no fault tolerance
3. **No distributed tracing:** Hard to debug cross-service issues
4. **Activity logs only to stdout:** Consider centralized logging solution
5. **No audit query API:** Audit service stores data but doesn't expose query endpoints

**Potential Improvements:**

1. **Redis Cluster/Sentinel:**

   ```yaml
   redis:
     replicas: 3
     sentinel:
       enabled: true
   ```

2. **Multi-Broker Kafka:**

   ```yaml
   kafka:
     replicas: 3
     config:
       default.replication.factor: 3
       min.insync.replicas: 2
   ```

3. **Centralized Logging for Activity Service:**
   - Deploy ELK Stack (Elasticsearch, Logstash, Kibana)
   - Or use GCP Cloud Logging with better queries
   - Add activity search and filtering

4. **Audit Query API:**
   - Add REST endpoints to Audit service
   - Query audit logs by user, date range, event type
   - Useful for compliance reporting

5. **Implement Distributed Tracing:**
   - Add OpenTelemetry instrumentation
   - Deploy Jaeger or Tempo
   - Correlate requests across services

6. **Database Indexing:**

   ```javascript
   // Add indexes for common queries
   BoardSchema.index({ "members.userId": 1 });
   TaskSchema.index({ boardId: 1, columnId: 1 });
   AuditEventSchema.index({ userId: 1, timestamp: -1 });
   AuditEventSchema.index({ eventType: 1, timestamp: -1 });
   ```

7. **Rate Limiting:**
   - Add rate limiting at Ingress or API Gateway
   - Protect against abuse

8. **Monitoring & Alerts:**
   - Deploy Prometheus + Grafana
   - Set up alerts for high CPU, memory, error rates
   - Monitor Kafka consumer lag for Activity and Audit services

---

## Conclusion

Cascade's GKE architecture demonstrates a well-designed microservices system with clear separation of concerns:

- **Frontend** uses relative paths, routing through a unified Ingress
- **API Gateway** intelligently routes based on HTTP methods (CQRS)
- **Services** discover each other via Kubernetes DNS
- **Databases** are logically separated but physically shared for consistency
- **Caching** optimizes read performance with event-driven invalidation
- **Events** enable async operations, cache coherence, and observability
- **Activity & Audit** services provide full event logging and compliance capabilities

The system prioritizes **pragmatism over purity**, implementing CQRS without full database separation, which simplifies operations while still achieving the performance benefits of read/write splitting.

**MongoDB replica set** ensures data is always in sync across all 3 nodes, and **Kafka events** keep the Redis cache fresh while powering Activity monitoring and Audit trail. The result is a scalable, resilient, and observable system that balances consistency, performance, operational simplicity, and compliance requirements.
