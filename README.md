<div align="center">

<img src="cascade-logo.png" alt="Cascade Logo" width="275" />

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
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [GKE Deployment](#gke-deployment)
- [Scripts](#scripts)
- [License](#license)

## Getting Started

### Local Development

To run the project locally using Docker Compose:

1. Ensure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.
2. Start the services:
   ```bash
   docker-compose up --build
   ```
   More details in the local [docker compose documentation](./DOCKER-COMPOSE.md).

### GKE Deployment

To deploy the project to Google Kubernetes Engine (GKE) using Helm:

1. Configure your `gcloud` CLI and Kubernetes context.
2. Use the Helm charts located in the `helm/` directory.
3. You can use the provided scripts to automate the process.

### Accessing Kafka UI

Kafka UI is not exposed via Ingress by default. To access it:

```bash
kubectl port-forward svc/cascade-kafka-ui 8080:80
```

Then open http://localhost:8080 in your browser.

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
