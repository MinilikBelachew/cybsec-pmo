# Deploying to Contabo VPS with Docker/Kubernetes & Nginx

This guide is for **production (main)**: `https://cybsec.addisanalytics.com`.

We support **Docker Compose** and **Kubernetes (K3s)**, and two image workflows (build on Docker Desktop / Mac & push to Docker Hub vs. build on the server).

### Repo files
1. **Main (prod)** Compose: [docker-compose.prod.yml](docker-compose.prod.yml) — Hub images, ports **3010 / 6010**
2. **Stage** Compose: [docker-compose.stage.yml](docker-compose.stage.yml) — separate stack on the same VPS (`cybsec-stage.learnica.net`, ports **3040 / 6040**). Do not mix the two.
3. Kubernetes manifests under [k8s/](k8s/)
4. Nginx template: [nginx/nginx.conf](nginx/nginx.conf) (stage-oriented sample — main site on the VPS uses `/etc/nginx/sites-available/cybsec.conf`)
5. Backend env template: [backend/.env.prod.example](backend/.env.prod.example) → copy to `backend/.env.prod` on the VPS

---

## Port Conflict Prevention Summary (Main)

Main publishes host ports **bound to `127.0.0.1` only** (Nginx on the same VPS proxies to them; they are not exposed on the public IP):

| Service | Host port | Container |
|---------|-----------|-----------|
| Frontend | `127.0.0.1:3010` | `cybersec-frontend` |
| Backend API | `127.0.0.1:6010` | `cybersec-backend` |
| Postgres | `127.0.0.1:5433` | `cybersec-postgres` |
| Redis | `127.0.0.1:6378` | `cybersec-redis` |

Stage (if present on the same VPS) uses **3040 / 6040 / 5437 / 6380** and must stay on [docker-compose.stage.yml](docker-compose.stage.yml).

---

## Security Best Practices & Environment Variables

### 1. Frontend Environment Variables (Build-Time Only)
Next.js bakes `NEXT_PUBLIC_*` into the bundle at **image build** time. They cannot be changed by restarting the container.

For **main**, build the frontend image with:

- `NEXT_PUBLIC_API_URL=https://cybsec.addisanalytics.com/api/v1`
- `NEXT_PUBLIC_WS_URL=https://cybsec.addisanalytics.com`
- `NEXT_PUBLIC_APP_URL=https://cybsec.addisanalytics.com`

Do **not** use stage URLs (`cybsec-stage.learnica.net`) when building the image that main will pull.

### 2. Backend Environment Variables (Runtime)
The backend gets config from:

1. **`backend/.env.prod`** on the VPS (`env_file` in Compose) — JWT secrets, Entra, mail, domains, etc.
2. **`environment:` in `docker-compose.prod.yml`** — Docker network hosts (`postgres`, `redis`, `mpxj-service`) and `DATABASE_URL` from the root `.env`.

Compose `environment` overrides the same keys from `env_file`.

On the VPS, set in `backend/.env.prod` for **main**:

- `FRONTEND_DOMAIN=https://cybsec.addisanalytics.com`
- `BACKEND_DOMAIN=https://cybsec.addisanalytics.com`
- `ENTRA_REDIRECT_URI=https://cybsec.addisanalytics.com/api/v1/auth/entra/callback`
- Secure random values for `AUTH_JWT_SECRET`, `AUTH_REFRESH_SECRET`, `AUTH_FORGOT_SECRET`, `AUTH_CONFIRM_EMAIL_SECRET`

### 3. Database Credentials (Root `.env`)
Compose interpolates Postgres credentials from a **root** `.env` next to `docker-compose.prod.yml`:

```env
DATABASE_USERNAME=your_secure_prod_username
DATABASE_PASSWORD=your_secure_prod_password
DATABASE_NAME=your_prod_database_name
```

Those values **must match** `DATABASE_USERNAME` / `DATABASE_PASSWORD` / `DATABASE_NAME` (and `DATABASE_URL` host `postgres`) inside `backend/.env.prod`.

---

## Docker Hub Private Repository (1 Free Private Limit)

1. Create one private Hub repo: **`cybersec-pmo`**
2. Tags used by main:
   - `aynuayex/cybersec-pmo:backend`
   - `aynuayex/cybersec-pmo:frontend`
   - `aynuayex/cybersec-pmo:mpxj-service`

---

## METHOD 1: Docker Compose (Main)

### 1. Install Docker on the VPS (first time only)

```bash
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

### WORKFLOW A: Build on Docker Desktop / Mac → Push Hub → Pull on VPS (Default for main)

`docker-compose.prod.yml` is already set to **Option 2 (pull images)**.

#### On your PC

```bash
cd /path/to/cybsec-pmo
git checkout main
git pull origin main
docker login -u aynuayex
```

**Backend**

```bash
cd backend
docker build -t aynuayex/cybersec-pmo:backend .
docker push aynuayex/cybersec-pmo:backend
```

**MPXJ**

```bash
cd ../mpxj-service
docker build -t aynuayex/cybersec-pmo:mpxj-service .
docker push aynuayex/cybersec-pmo:mpxj-service
```

**Frontend (MAIN domain — required)**

```bash
cd ../frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://cybsec.addisanalytics.com/api/v1 \
  --build-arg NEXT_PUBLIC_WS_URL=https://cybsec.addisanalytics.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://cybsec.addisanalytics.com \
  --build-arg NEXT_PUBLIC_ENTRA_CLIENT_ID=1977447d-18f8-4fa3-9be1-4d2b196e0ede \
  --build-arg NEXT_PUBLIC_ENTRA_TENANT_ID=301b9d6d-03a0-4afa-994d-367a03b30b5a \
  -t aynuayex/cybersec-pmo:frontend .
docker push aynuayex/cybersec-pmo:frontend
```

PowerShell (Windows) equivalent uses `` ` `` line continuations instead of `\`.

#### First-time / config copy (if needed)

```bash
ssh YOUR_USER@YOUR_CONTABO_VPS_IP "mkdir -p /var/www/cybsec-pmo/backend"
scp ./docker-compose.prod.yml YOUR_USER@YOUR_CONTABO_VPS_IP:/var/www/cybsec-pmo/
scp ./backend/.env.prod YOUR_USER@YOUR_CONTABO_VPS_IP:/var/www/cybsec-pmo/backend/.env.prod
```

#### On the VPS (PuTTY)

```bash
cd /var/www/cybsec-pmo
docker login -u aynuayex
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Do **not** use `up --build` for Workflow A — that rebuilds from source instead of Hub images.

Port / compose-only changes (e.g. `127.0.0.1` binds) do **not** require rebuilding images; `up -d` is enough after updating the compose file on the server.

---

### WORKFLOW B: Build on the VPS

1. Clone or pull `main` under `/var/www/cybsec-pmo`.
2. Edit `backend/.env.prod` for main domains and secrets.
3. In `docker-compose.prod.yml`, uncomment **Option 1 `build:`** and comment **Option 2 `image:`** for backend, frontend, and mpxj-service. Ensure frontend `args` use `https://cybsec.addisanalytics.com`.
4. Start:

```bash
cd /var/www/cybsec-pmo
docker compose -f docker-compose.prod.yml up --build -d
```

---

## Database & Prisma Studio (Main)

- Postgres host port: **`5433`**, bound to **`127.0.0.1`** only.
- From your laptop, use an SSH tunnel (not a direct public connection):

```bash
ssh -L 5433:127.0.0.1:5433 YOUR_USER@YOUR_CONTABO_VPS_IP
```

Then point DBeaver / TablePlus at `127.0.0.1:5433`.

**Prisma Studio**

```bash
cd /var/www/cybsec-pmo/backend
npx prisma studio --port 5555
```

Tunnel:

```bash
ssh -L 5555:127.0.0.1:5555 YOUR_USER@YOUR_CONTABO_VPS_IP
```

Open `http://localhost:5555`.

On first boot, the backend runs migrations (`migration:run`) and seed as configured in the image entrypoint.

---

## METHOD 2: Kubernetes (K3s)

### 1. Install K3s

```bash
curl -sfL https://get.k3s.io | sh -s - --disable traefik
```

### 2. Docker Hub pull secret

```bash
sudo kubectl create secret docker-registry dockerhub-registry \
  --docker-username=aynuayex \
  --docker-password="<your-password>" \
  --docker-email="your-email@example.com"
```

### 3. Apply manifests

Configure credentials on the server (do not commit secrets), then:

```bash
cd /var/www/cybsec-pmo/k8s/
sudo kubectl apply -f postgres-deployment.yaml
sudo kubectl apply -f redis-deployment.yaml
sudo kubectl apply -f mpxj-deployment.yaml
sudo kubectl apply -f backend-deployment.yaml
sudo kubectl apply -f frontend-deployment.yaml
sudo kubectl get pods
```

### 4. Switching from Compose to K3s

```bash
cd /var/www/cybsec-pmo
sudo docker compose -f docker-compose.prod.yml down
sudo systemctl enable k3s && sudo systemctl start k3s
```

In `/etc/nginx/sites-available/cybsec.conf`:

- Comment **Option A** (`3010` / `6010`)
- Uncomment **Option B** (NodePorts `30300` / `30601`)
- `sudo nginx -t && sudo systemctl reload nginx`

---

## Nginx & SSL (Main)

Main Nginx site: `/etc/nginx/sites-available/cybsec.conf`

- `server_name cybsec.addisanalytics.com www.cybsec.addisanalytics.com`
- Frontend → `http://127.0.0.1:3010`
- API / Socket.IO → `http://127.0.0.1:6010`

Enable / reload:

```bash
sudo ln -sf /etc/nginx/sites-available/cybsec.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

SSL (Certbot):

```bash
sudo certbot --nginx -d cybsec.addisanalytics.com -d www.cybsec.addisanalytics.com
```

---

## Survive Reboots

```bash
sudo systemctl enable docker
sudo systemctl enable containerd
# If using K3s:
sudo systemctl enable k3s
```

---

## Kubernetes Secrets Reminder

Edit placeholders on the server in `k8s/backend-deployment.yaml` (`ENTRA_CLIENT_SECRET`, `MAIL_PASSWORD`, `BREAK_GLASS_EMERGENCY_SECRET`), then:

```bash
sudo kubectl apply -f /var/www/cybsec-pmo/k8s/backend-deployment.yaml
```

---

## Quick redeploy checklist (Main)

1. PC: build & push `backend`, `mpxj-service`, `frontend` (main `NEXT_PUBLIC_*`)
2. VPS: `docker compose -f docker-compose.prod.yml pull && up -d`
3. Verify https://cybsec.addisanalytics.com
4. Leave stage alone (`docker-compose.stage.yml` / ports 3040 & 6040)
