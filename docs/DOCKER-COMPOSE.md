# Cascade - Local Development with Docker Compose

This setup allows you to run the entire Cascade application stack with a single command.

## Quick Start

```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

## Services

Once running, the following services will be available:

| Service          | URL                   | Description                   |
| ---------------- | --------------------- | ----------------------------- |
| Frontend         | http://localhost:5173 | React UI                      |
| Auth Service     | http://localhost:3001 | Authentication                |
| Board Command    | http://localhost:3002 | Write API                     |
| Board Query      | http://localhost:3003 | Read API                      |
| Activity Service | http://localhost:3004 | Event logging                 |
| Audit Service    | http://localhost:3005 | Audit trail                   |
| Kafka            | localhost:9092        | Event streaming               |
| MongoDB          | localhost:27017-27019 | Database (3-node replica set) |
| Redis            | localhost:6379        | Cache                         |

## Architecture

- **Kafka**: KRaft mode (no Zookeeper) with auto-topic creation
- **MongoDB**: 3-node replica set for high availability
- **Redis**: Single instance for caching
- **Microservices**: Event-driven with CQRS pattern

## Health Checks

```bash
# Check all services
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # Board Command
curl http://localhost:3003/health  # Board Query
curl http://localhost:3004/health  # Activity
curl http://localhost:3005/health  # Audit
```

## Event Flow

1. User signs up → `user.registered` event
2. User creates board → `board.created` event
3. User creates task → `task.created` event
4. User moves task → `task.moved` event
5. Query service invalidates cache on all events
6. Activity service logs all events
7. Audit service stores all events permanently

## Troubleshooting

### MongoDB Replica Set Not Initialized

```bash
# Restart mongo-init
docker compose restart mongo-init
```

### Kafka Connection Issues

```bash
# Check Kafka is healthy
docker compose ps kafka
docker compose logs kafka
```

### Clear All Data

```bash
docker compose down -v
docker compose up -d
```
