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
POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-secret123}
POSTGRES_DB: ${DATABASE_NAME:-cybersec}
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

## 🔒 Docker Hub Private Repository Workaround (1 Free Private Limit)
Docker Hub only allows **one free private repository** per account. Because we have two separate images (frontend and backend), we will use the **single private repository tag-based workaround**:

1. Log in to the [Docker Hub Dashboard](https://hub.docker.com/).
2. Create **one** repository named **`cybersec-pmo`**.
3. In the **Visibility** section, select **Private**.
4. Click **Create**.
- We will push the backend image as: `aynuayex/cybersec-pmo:backend`
- We will push the frontend image as: `aynuayex/cybersec-pmo:frontend`
*This allows you to store both images completely privately in your single free repository!*

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
   docker build -t aynuayex/cybersec-pmo:backend .
   docker push aynuayex/cybersec-pmo:backend
   ```

5. **Build and push the Frontend image** (passing your domain at build time):
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
curl -sfL https://get.k3s.io | sh -s - --disable traefik
```

### 2. Configure Kubernetes for Private Docker Hub Registry
Run this command on the server to create a pull secret (replace `<your-password>` with your Docker Hub password or token):
```bash
sudo kubectl create secret docker-registry dockerhub-registry \
  --docker-username=aynuayex \
  --docker-password="<your-password>" \
  --docker-email="your-email@example.com"
```

### 3. Apply the Manifests
To deploy to Kubernetes (K3s), you should create and configure the deployment files directly on the server (this keeps sensitive credentials out of Git):

1. **Create the manifest directory on the server**:
   ```bash
   mkdir -p /var/www/cybsec-pmo/k8s
   cd /var/www/cybsec-pmo/k8s/
   ```
2. **Create and write each configuration file** on the server using `nano`:
   ```bash
   nano postgres-deployment.yaml
   nano redis-deployment.yaml
   nano backend-deployment.yaml  # <-- Make sure to replace placeholders with your actual production credentials here!
   nano frontend-deployment.yaml
   ```
3. **Deploy all manifests to the cluster**:
   ```bash
   sudo kubectl apply -f postgres-deployment.yaml
   sudo kubectl apply -f redis-deployment.yaml
   sudo kubectl apply -f backend-deployment.yaml
   sudo kubectl apply -f frontend-deployment.yaml
   ```

### 4. Transitioning from Docker Compose to Kubernetes (K3s)
If you have already deployed using Docker Compose and want to switch to Kubernetes (K3s) on the same VPS, follow this sequence:

1. **Tear down Docker Compose containers & free up ports**:
   ```bash
   cd /var/www/cybsec-pmo
   sudo docker compose -f docker-compose.prod.yml down
   ```
2. **Start & Enable K3s service**:
   ```bash
   sudo systemctl enable k3s
   sudo systemctl start k3s
   
   # Verify Kubernetes is active:
   sudo kubectl get nodes
   # (You should see your server status as Ready)
   ```
3. **Apply the Kubernetes Manifests**:
   *(Note: Make sure to configure the production credentials in the manifest directly on the server first!)*
   ```bash
   cd k8s/
   
   # 1. Edit the manifest on the server to input real credentials
   sudo nano backend-deployment.yaml
   
   # 2. Apply all configurations
   sudo kubectl apply -f postgres-deployment.yaml
   sudo kubectl apply -f redis-deployment.yaml
   sudo kubectl apply -f backend-deployment.yaml
   sudo kubectl apply -f frontend-deployment.yaml
   
   # Verify Pod status (it may take a minute to pull the images and initialize the PostgreSQL database):
   sudo kubectl get pods
   # (Wait until all pods show STATUS: Running and READY: 1/1)
   ```
4. **Switch Nginx Routing Mode**:
   Open `/etc/nginx/sites-available/cybsec.conf` on the VPS and:
   * Comment out all ports under **Option A** (ports `3010` and `6010`).
   * Uncomment all ports under **Option B** (ports `30300` and `30601` for NodePorts).
   * Test and reload Nginx:
     ```bash
     sudo nginx -t
     sudo systemctl reload nginx
     ```

---

## 🛡️ Step 4: Configure Nginx & SSL (Certbot) on Host VPS

### 4.1 Create the configuration file
On the VPS, create Nginx site config:
```bash
sudo nano /etc/nginx/sites-available/cybsec.conf
```
Copy and paste the contents of [nginx.conf](nginx/nginx.conf).

### 4.2 Enable and reload Nginx
```bash
sudo ln -s /etc/nginx/sites-available/cybsec.conf /etc/nginx/sites-enabled/
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

---

## 🔒 Step 6: Handling Secrets in Kubernetes (K3s)

For security, the manifest files committed to Git (such as `k8s/backend-deployment.yaml`) contain **placeholders** for sensitive variables (like `ENTRA_CLIENT_SECRET`, `MAIL_PASSWORD`, and `BREAK_GLASS_EMERGENCY_SECRET`) to prevent leaks.

When deploying to your Kubernetes cluster on the VPS:

1. **Pull the latest code** to your VPS.
2. **Open the deployment manifest on the server**:
   ```bash
   nano /var/www/cybsec-pmo/k8s/backend-deployment.yaml
   ```
3. Locate the placeholders and **replace them with your actual values**:
   * `ENTRA_CLIENT_SECRET`: Put your real Active Directory application secret.
   * `MAIL_PASSWORD`: Put your Gmail App Password.
   * `BREAK_GLASS_EMERGENCY_SECRET`: Put your emergency access secret.
4. **Save the file** (`Ctrl + O`, then `Enter`, then `Ctrl + X`).
5. **Apply the configuration**:
   ```bash
   sudo kubectl apply -f /var/www/cybsec-pmo/k8s/backend-deployment.yaml
   ```
