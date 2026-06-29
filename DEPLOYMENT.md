# Deploying to Contabo VPS with Docker/Kubernetes & Nginx

This guide contains the step-by-step instructions to deploy your application to your Contabo VPS server. We have provided instructions for **both** Docker Compose and Kubernetes (K3s), and for **both** image workflows (building locally on Mac & pushing to Docker Hub vs. building directly on the server).

We have created the following files in your repository to assist you:
1. Production Docker Compose config: [docker-compose.prod.yml](docker-compose.prod.yml)
2. Kubernetes manifests:
   - [postgres-deployment.yaml](k8s/postgres-deployment.yaml)
   - [redis-deployment.yaml](k8s/redis-deployment.yaml)
   - [backend-deployment.yaml](k8s/backend-deployment.yaml)
   - [frontend-deployment.yaml](k8s/frontend-deployment.yaml)
3. Nginx template config: [nginx.conf](nginx/nginx.conf)
4. Production Environment Template: [backend/.env.prod](backend/.env.prod)

---

## Port Conflict Prevention Summary (VPS Status)
Your server already has active applications on several ports. To prevent any conflicts:
- **Postgres**: Exposed on host port **`5433`** (container internal port is 5432). Does not conflict with host Postgres.
- **Redis**: Exposed on host port **`6378`** (container internal port is 6379). Does not conflict with host Redis.
- **Backend API**: Exposed on host port **`6010`**.
- **Frontend App**: Exposed on host port **`3010`**.

---

## 🔒 Security Best Practices & Environment Variables

### 1. Frontend Environment Variables (Build-Time Only)
Next.js compiles environment variables starting with `NEXT_PUBLIC_` **directly into the HTML/JS bundle at build time**. 
- Because they are compiled into the static assets, they **cannot** be changed dynamically at runtime when the container starts.
- This is why you must pass your real production domain when building the image. 
- In [docker-compose.prod.yml](docker-compose.prod.yml), these are defined under the `args:` key of the `build` block. If you build using Docker Compose, it reads them automatically, decreasing the commands you need to run!

### 2. Backend Environment Variables & Root `.env` (Runtime)
The backend container reads its runtime configuration from `backend/.env.prod` via the `env_file` directive.
- **What you must update**: Before running the containers on your VPS, you **MUST** edit the `backend/.env.prod` file on your VPS to replace the placeholder values:
  - Generate secure, random keys for `AUTH_JWT_SECRET`, `AUTH_REFRESH_SECRET`, `AUTH_FORGOT_SECRET`, and `AUTH_CONFIRM_EMAIL_SECRET`.
  - Update `FRONTEND_DOMAIN` and `BACKEND_DOMAIN` to `https://cybsec.addisanalytics.com`.

### 3. Database Credentials Security (Compose Best Practice)
To avoid hardcoding Postgres credentials directly into the `docker-compose.prod.yml` file, we use Compose environment interpolation:
```yaml
POSTGRES_USER: ${DATABASE_USERNAME:-root}
POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-secret}
POSTGRES_DB: ${DATABASE_NAME:-api}
```
- **Best Practice Setup**: Create a `.env` file in the **root directory** of your project on the VPS (the same folder where `docker-compose.prod.yml` resides) and add your production credentials:
  ```env
  DATABASE_USERNAME=your_secure_prod_username
  DATABASE_PASSWORD=your_secure_prod_password
  DATABASE_NAME=your_prod_database_name
  ```
- **CRITICAL**: If you set these credentials in the root `.env` file, you **MUST also update** the database connection string and environment variables inside `backend/.env.prod` so that they match exactly.
  - In [backend/.env.prod](backend/.env.prod), make sure you update:
    - `DATABASE_USERNAME=your_secure_prod_username`
    - `DATABASE_PASSWORD=your_secure_prod_password`
    - `DATABASE_NAME=your_prod_database_name`
    - `DATABASE_URL=postgresql://your_secure_prod_username:your_secure_prod_password@postgres:5432/your_prod_database_name?schema=public`
  *(Note that `postgres` is used as the host inside the URL because containers communicate internally using Docker's private network).*

---

## 🔒 Making Your Docker Hub Images Private
By default, pushing to Docker Hub makes your images public unless you explicitly configure the repository as **Private**:

1. Log in to the [Docker Hub Dashboard](https://hub.docker.com/).
2. Click **Create Repository**.
3. Set the Repository Name to match your build tag:
   - Create one repository named `cybersec-backend`.
   - Create another repository named `cybersec-frontend`.
4. In the **Visibility** section of each repository, select **Private**.
5. Click **Create**.
*Only you can push to or pull from `aynuayex/cybersec-backend` and `aynuayex/cybersec-frontend`.*

---

## 🐳 METHOD 1: Deployment via Docker Compose

### 1. Install Docker & Docker Compose on the VPS
Run these commands to install Docker and Docker Compose on the VPS:
```bash
# Update package index
sudo apt-get update -y && sudo apt-get upgrade -y

# Install Docker dependencies
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Docker Compose
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

### Choose Your Build Workflow:

#### WORKFLOW A: Build on Mac & Push to Docker Hub (Default)

1. **Create the directories on the VPS**:
   ```bash
   ssh root@YOUR_CONTABO_VPS_IP "mkdir -p /var/www/cybsec-pmo/backend"
   ```

2. **Copy the configuration files to the VPS**:
   ```bash
   scp ./docker-compose.prod.yml root@YOUR_CONTABO_VPS_IP:/var/www/cybsec-pmo/
   scp ./backend/.env.prod root@YOUR_CONTABO_VPS_IP:/var/www/cybsec-pmo/backend/.env.prod
   ```

3. **Log in to Docker Hub on your Mac**:
   ```bash
   docker login -u aynuayex
   ```

4. **Build and push the Backend image**:
   ```bash
   cd backend
   docker build -t aynuayex/cybersec-backend:latest .
   docker push aynuayex/cybersec-backend:latest
   ```

5. **Build and push the Frontend image** (passing your domain at build time):
   ```bash
   cd ../frontend
   docker build \
     --build-arg NEXT_PUBLIC_API_URL=https://cybsec.addisanalytics.com/api \
     --build-arg NEXT_PUBLIC_APP_URL=https://cybsec.addisanalytics.com \
     -t aynuayex/cybersec-frontend:latest .
   docker push aynuayex/cybersec-frontend:latest
   ```

6. **Log in to Docker on the VPS** so it can pull the private images:
   ```bash
   ssh root@YOUR_CONTABO_VPS_IP "docker login -u aynuayex"
   ```

7. **Start the application on the VPS**:
   Navigate to the directory on your VPS and run:
   ```bash
   cd /var/www/cybsec-pmo
   docker compose -f docker-compose.prod.yml up -d
   ```

---

#### WORKFLOW B: Build directly on the VPS

1. **Clone the code on the VPS**:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL> /var/www/cybsec-pmo
   cd /var/www/cybsec-pmo
   ```

2. **Setup environment variables**:
   Create and customize the environment configurations:
   ```bash
   cp backend/.env.prod backend/.env
   nano backend/.env.prod
   ```

3. **Edit the config**:
   Open `docker-compose.prod.yml` and **uncomment the `build:` sections** for both `backend` and `frontend` services (and comment out Option 2: Pull from Docker Hub).

4. **Compile and start the containers**:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

---

## 🗄️ Database Initialization & Prisma Studio Access

### 1. Database Creation
The Postgres database (`api`) and database users are created **automatically** when the Postgres container starts for the first time, using the environment variables in `docker-compose.prod.yml`.
When the NestJS backend container boots, it automatically runs migrations (`npm run migration:run`) and seeds (`npm run prisma:seed`) using Prisma, meaning all your database tables and initial data will be set up automatically without manual intervention.

### 2. Accessing the Database & Prisma Studio
Since host port `5432` was already taken, we mapped the container database port `5432` to host port **`5433`**.
- To connect standard database tools (DBeaver, TablePlus, pgAdmin), configure them to point to your VPS IP address on port **`5433`**.

- **Running Prisma Studio**:
  If you want to view the database using Prisma Studio:
  1. On the VPS, run the studio command from the backend folder:
     ```bash
     cd /var/www/cybsec-pmo/backend
     npx prisma studio --port 5555
     ```
  2. To view it on your Mac's browser safely without exposing port `5555` publicly, create an **SSH Port Forwarding Tunnel** on your Mac's terminal:
     ```bash
     ssh -L 5555:127.0.0.1:5555 root@YOUR_CONTABO_VPS_IP
     ```
  3. Open your Mac's browser and go to `http://localhost:5555` to view Prisma Studio.

---

## ☸️ METHOD 2: Deployment via Kubernetes (K3s)

### 1. Install K3s on the VPS
```bash
curl -sfL https://get.k3s.io | sh -
```

### 2. Configure Kubernetes for Private Docker Hub Registry
Run this command on the server to create a pull secret (replace `<your-password>` with your Docker Hub password or token):
```bash
kubectl create secret docker-registry dockerhub-registry \
  --docker-username=aynuayex \
  --docker-password="<your-password>" \
  --docker-email="your-email@example.com"
```

### 3. Apply the Manifests
Navigate to your manifest directory on the server and deploy:
```bash
cd k8s/
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
```

---

## 🛡️ Step 4: Configure Nginx & SSL (Certbot) on Host VPS

### 4.1 Create the configuration file
On the VPS, create Nginx site config:
```bash
sudo nano /etc/nginx/sites-available/cybsec.addisanalytics.com
```
Copy and paste the contents of [nginx.conf](nginx/nginx.conf).

### 4.2 Enable and reload Nginx
```bash
sudo ln -s /etc/nginx/sites-available/cybsec.addisanalytics.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.3 Secure with SSL using Certbot
Run Certbot to request certificates and automatically configure SSL redirection on Nginx:
```bash
sudo certbot --nginx -d cybsec.addisanalytics.com -d www.cybsec.addisanalytics.com
```

---

## 🔄 Step 5: How to Persist Applications & Survive Reboots

### 5.1 Docker/Docker Compose Persistence
Enable Docker service to run at system boot:
```bash
sudo systemctl enable docker
sudo systemctl enable containerd
```

### 5.2 Kubernetes K3s Persistence
Enable K3s service to run at system boot:
```bash
sudo systemctl enable k3s
```
