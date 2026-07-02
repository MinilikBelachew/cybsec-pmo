# MPXJ parser microservice

Internal HTTP service that converts Microsoft Project files (`.mpp`, `.mpx`, MSPDI `.xml`) into normalized JSON for the NestJS import worker.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `POST` | `/parse` | Multipart field `file` → parsed schedule JSON |

## Local build

```bash
cd mpxj-service
mvn package -DskipTests
java -jar target/mpxj-service-1.0.0.jar
```

## Docker

Started automatically via root `docker-compose.dev.yml` as `mpxj-service` on the internal network (`http://mpxj-service:8080`).

```bash
# Test from host while stack is running (temporary port mapping optional)
docker compose -f docker-compose.dev.yml exec backend \
  wget -qO- http://mpxj-service:8080/health
```
