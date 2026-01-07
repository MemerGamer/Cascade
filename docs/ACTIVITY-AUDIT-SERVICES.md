# Activity and Audit Services - Integration Guide

## Overview

The Activity and Audit services have been integrated into the GKE deployment to provide comprehensive observability and compliance capabilities. These services consume Kafka events in real-time to provide activity monitoring and immutable audit trails.

## What Was Added

### 1. Activity Service (Port 3004)

**Purpose:** Real-time activity monitoring and logging

**How it works:**

- Consumes all Kafka events from user actions and system changes
- Logs activities to stdout (captured by Kubernetes/GCP logging)
- Provides real-time visibility into system activity

**Kafka Events Consumed:**

- `user.registered` - New user sign-ups
- `user.logged_in` - User login events
- `board.created` - New board creation
- `task.created` - New task creation
- `task.moved` - Task column changes
- `task.updated` - Task modifications

**Key Features:**

- Lightweight (no database required)
- Real-time event streaming
- Structured JSON logging
- Easy integration with log aggregation tools (ELK, GCP Logging)

**Example Log Output:**

```json
{
  "event": "task.moved",
  "data": {
    "taskId": "507f1f77bcf86cd799439012",
    "boardId": "507f1f77bcf86cd799439011",
    "oldColumnId": "col_todo",
    "newColumnId": "col_inprogress",
    "timestamp": "2025-01-07T10:40:00.000Z"
  },
  "processedAt": "2025-01-07T10:40:00.123Z"
}
```

**Use Cases:**

- Real-time activity dashboards
- User behavior analytics
- System health monitoring
- Debugging and troubleshooting
- Performance monitoring

### 2. Audit Service (Port 3005)

**Purpose:** Immutable audit trail for compliance and security

**How it works:**

- Consumes all Kafka events
- Stores immutable records in MongoDB (`cascade-audit` database)
- Provides permanent historical record of all system changes

**Kafka Events Consumed:**

- Same events as Activity Service
- All events are stored permanently

**Database Schema:**

```javascript
{
  eventType: "task.moved",           // Event category
  eventData: {                       // Full event payload
    taskId: "507f1f77bcf86cd799439012",
    boardId: "507f1f77bcf86cd799439011",
    oldColumnId: "col_todo",
    newColumnId: "col_inprogress",
    timestamp: "2025-01-07T10:40:00.000Z"
  },
  userId: "user_abc123",             // Associated user (if applicable)
  timestamp: ISODate("2025-01-07T10:40:00.000Z")  // Indexed for fast queries
}
```

**Key Features:**

- Immutable records (never updated or deleted)
- Indexed by eventType, userId, and timestamp
- Complete event history
- Compliance-ready (SOC2, GDPR, HIPAA, etc.)
- Forensics and security investigations

**Use Cases:**

- Compliance auditing
- Security forensics
- Historical data analysis
- Regulatory reporting
- Dispute resolution
- Incident investigation

## Deployment Changes

### New Kubernetes Resources

**Created:**

- `helm/cascade/templates/deployment-activity.yaml` - Activity service deployment and service
- `helm/cascade/templates/deployment-audit.yaml` - Audit service deployment and service

**Modified:**

- `build-and-push.sh` - Added activity-service and audit-service to build process
- `docs/architecture_presentation.md` - Updated architecture diagrams
- `docs/GKE-ARCHITECTURE.md` - Added detailed service documentation
- `README.md` - Updated services list

### Resource Allocation

**Activity Service:**

```yaml
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 100m
    memory: 128Mi
```

**Audit Service:**

```yaml
resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 100m
    memory: 256Mi
```

**Health Checks:**
Both services include:

- Liveness probe: `/health` endpoint (checks if service is running)
- Readiness probe: `/health` endpoint (checks if service is ready to receive traffic)

### Database Segregation

The Audit service uses its own database (`cascade-audit`) in the MongoDB replica set:

```console
MongoDB Replica Set (rs0)
├── cascade-auth (Auth Service)
├── cascade-board (Board Command & Query)
└── cascade-audit (Audit Service) ← NEW
```

**Why separate database?**

- Clear separation of concerns
- Independent scaling and backup strategies
- Audit data isolation for compliance
- Different retention policies possible

## Deployment Instructions

### 1. Build Docker Images

The build script now includes Activity and Audit services:

```bash
./build-and-push.sh YOUR_PROJECT_ID europe-west1 cascade latest
```

This will build and push:

- ✅ auth-service
- ✅ board-command-service
- ✅ board-query-service
- ✅ **activity-service** ← NEW
- ✅ **audit-service** ← NEW
- ✅ frontend

### 2. Deploy to GKE

Use the standard Helm deployment process:

```bash
helm upgrade --install cascade helm/cascade \
  --set app.image.repository="europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/cascade" \
  --set app.image.tag="latest" \
  --set secrets.githubClientId="YOUR_GITHUB_CLIENT_ID" \
  --set secrets.githubClientSecret="YOUR_GITHUB_CLIENT_SECRET" \
  --set secrets.authSecret="YOUR_AUTH_SECRET"
```

**Note:** No additional configuration required! The Activity and Audit services are deployed automatically.

### 3. Verify Deployment

Check that all services are running:

```bash
kubectl get pods

# Expected output (including):
cascade-activity-xxxxx      1/1     Running
cascade-audit-xxxxx         1/1     Running
```

Check service health:

```bash
kubectl port-forward svc/cascade-activity 3004:3004
curl http://localhost:3004/health
# {"status":"ok","service":"activity-service"}

kubectl port-forward svc/cascade-audit 3005:3005
curl http://localhost:3005/health
# {"status":"ok","service":"audit-service"}
```

### 4. View Activity Logs

**Using kubectl:**

```bash
kubectl logs -f deployment/cascade-activity
```

**Using GCP Console:**

1. Go to GKE → Workloads → cascade-activity
2. Click "Logs" tab
3. View real-time event stream

**Example log entries:**

```console
[ACTIVITY] user.registered { userId: "user_123", email: "user@example.com" }
[ACTIVITY] board.created { boardId: "board_456", name: "Sprint Board" }
[ACTIVITY] task.moved { taskId: "task_789", from: "todo", to: "doing" }
```

### 5. Query Audit Data

Connect to MongoDB and query audit records:

```bash
# Port-forward to MongoDB
kubectl port-forward svc/cascade-mongodb-headless 27017:27017

# Connect with mongosh
mongosh mongodb://localhost:27017/cascade-audit

# Query audit events
db.auditevents.find({ eventType: "task.moved" }).limit(10)
db.auditevents.find({ userId: "user_abc123" }).sort({ timestamp: -1 }).limit(10)
db.auditevents.countDocuments({ eventType: "board.created" })
```

**Useful queries:**

```javascript
// Get all events for a specific user
db.auditevents.find({ userId: "user_abc123" }).sort({ timestamp: -1 })

// Get events in a time range
db.auditevents.find({
  timestamp: {
    $gte: ISODate("2025-01-01"),
    $lte: ISODate("2025-01-31")
  }
})

// Count events by type
db.auditevents.aggregate([
  { $group: { _id: "$eventType", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Get recent board creations
db.auditevents.find({ eventType: "board.created" })
  .sort({ timestamp: -1 })
  .limit(10)
```

## Benefits

### 1. Observability

**Before:** Limited visibility into system activity
**After:**

- Real-time activity monitoring via Activity service
- Complete historical record via Audit service
- Easy debugging of user issues
- Performance monitoring capabilities

### 2. Compliance

**Before:** No audit trail for regulatory compliance
**After:**

- Immutable audit log of all system changes
- Ready for SOC2, GDPR, HIPAA, etc.
- Forensics capability for security incidents
- Dispute resolution with evidence

### 3. Security

**Before:** Limited forensic capabilities
**After:**

- Track unauthorized access attempts
- Identify suspicious patterns
- Incident response with complete history
- User action accountability

### 4. Analytics

**Before:** No historical data for analysis
**After:**

- User behavior patterns
- Feature usage statistics
- System health trends
- Business intelligence insights

## Architecture Benefits

### Event-Driven Design Advantages

1. **Loose Coupling:** Activity and Audit services don't affect core functionality
2. **Scalability:** Services can scale independently
3. **Resilience:** If Activity/Audit fail, core system continues working
4. **Extensibility:** Easy to add more event consumers in the future

### Kafka Consumer Groups

Each service has its own consumer group:

- `activity-group` - Activity Service
- `audit-group` - Audit Service
- `board-query-group` - Board Query Service

**Benefits:**

- Independent processing speeds
- Separate offset tracking
- Fault isolation
- Parallel consumption

### Database Isolation

Each service has its own database:

- `cascade-auth` - User authentication
- `cascade-board` - Boards and tasks
- `cascade-audit` - Audit events

**Benefits:**

- Clear ownership
- Independent scaling
- Backup flexibility
- Compliance isolation

## Monitoring & Operations

### Health Checks

Both services expose `/health` endpoints:

```bash
# Check Activity service
curl http://cascade-activity:3004/health

# Check Audit service
curl http://cascade-audit:3005/health
```

Kubernetes uses these for:

- **Liveness probes:** Restart pod if unhealthy
- **Readiness probes:** Remove from service if not ready

### Resource Monitoring

Monitor resource usage:

```bash
# Check pod resource usage
kubectl top pods | grep -E "activity|audit"

# View detailed pod info
kubectl describe pod cascade-activity-xxxxx
kubectl describe pod cascade-audit-xxxxx
```

### Kafka Consumer Lag

Monitor if services are keeping up with events:

```bash
# Port-forward to Kafka UI
kubectl port-forward svc/cascade-kafka-ui 8080:80

# Open http://localhost:8080 in browser
# Check consumer groups: activity-group, audit-group
# Monitor lag (should be near 0)
```

**What is lag?**

- Number of messages waiting to be processed
- High lag = service falling behind
- Should be near 0 for healthy system

### Troubleshooting

**Activity service not receiving events:**

1. Check Kafka broker is running: `kubectl get pods | grep kafka`
2. Check Activity pod logs: `kubectl logs -f deployment/cascade-activity`
3. Verify events are being published: Check Board Command logs
4. Check Kafka topics exist: Use Kafka UI

**Audit service not storing data:**

1. Check MongoDB is running: `kubectl get pods | grep mongodb`
2. Check Audit pod logs: `kubectl logs -f deployment/cascade-audit`
3. Verify database connection: Check `cascade-audit` database exists
4. Check disk space: Audit data can grow over time

**High consumer lag:**

1. Check pod resource limits (may need more CPU/memory)
2. Check MongoDB performance (add indexes if needed)
3. Consider horizontal scaling (increase replicas)

## Future Enhancements

### 1. Activity Dashboard

Create a web UI to view real-time activity:

- Live event stream
- User activity timelines
- System health metrics
- Event filtering and search

### 2. Audit Query API

Add REST endpoints to Audit service:

```typescript
GET /api/audit/events?userId=xxx&startDate=xxx&endDate=xxx
GET /api/audit/events/:eventId
GET /api/audit/stats
```

### 3. Data Retention Policies

Implement automatic data cleanup:

- Keep Activity logs for 30 days
- Keep Audit records for 7 years (compliance)
- Archive old data to cold storage

### 4. Alerting

Set up alerts for important events:

- Failed login attempts
- Board deletions
- Unusual activity patterns
- System errors

### 5. Advanced Analytics

Use audit data for insights:

- User engagement metrics
- Feature adoption rates
- Performance bottlenecks
- Usage patterns

## Cost Considerations

### Resource Costs

**Activity Service:**

- CPU: 50m (low)
- Memory: 64Mi (minimal)
- Storage: None (logs to stdout)
- **Cost:** ~$2-5/month on GKE

**Audit Service:**

- CPU: 50m (low)
- Memory: 128Mi (small)
- Storage: Grows with usage (~1-10GB/month typical)
- **Cost:** ~$5-15/month on GKE + storage costs

### Storage Growth

**Audit database growth estimate:**

```console
Average event: ~500 bytes
1000 events/day: ~15MB/month
10,000 events/day: ~150MB/month
100,000 events/day: ~1.5GB/month
```

**MongoDB storage:**

- GCP Persistent Disk: ~$0.17/GB/month
- 10GB audit data: ~$1.70/month

**Total additional cost:** ~$10-20/month for most deployments

## Summary

The integration of Activity and Audit services adds significant value:

✅ **Real-time observability** via Activity logging  
✅ **Compliance-ready** audit trail  
✅ **Security forensics** capability  
✅ **Easy deployment** (no additional configuration)  
✅ **Low overhead** (~$10-20/month)  
✅ **Production-ready** with health checks and monitoring  

The event-driven architecture makes these services non-intrusive - they consume events without affecting core system performance or functionality. If Activity or Audit services fail, the core application continues working normally.

**Recommendation:** Deploy to production for any system that needs compliance, security auditing, or detailed activity monitoring.
