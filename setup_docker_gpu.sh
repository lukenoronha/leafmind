#!/usr/bin/env bash
set -e

# setup_docker_gpu.sh - Automate Docker and NVIDIA Container Toolkit setup on Ubuntu 24.04 LTS

echo "======================================================================"
echo "LeafMind GPU Docker Setup Script"
echo "======================================================================"

# Ensure running on Ubuntu
if [ ! -f /etc/os-release ] || ! grep -q "Ubuntu" /etc/os-release; then
    echo "[!] This script is designed for Ubuntu. Please verify commands for your distribution."
    exit 1
fi

# 1. Update package list
echo "[*] Updating apt package repository..."
sudo apt-get update

# 2. Check and Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo "[*] Docker not found. Installing Docker Engine..."
    
    sudo apt-get install -y ca-certificates curl gnupg
    
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    echo "[+] Docker Engine installed successfully."
else
    echo "[+] Docker is already installed: $(docker --version)"
fi

# 3. Configure current user for Docker access (avoiding sudo for docker commands)
if ! groups $USER | grep -q "\bdocker\b"; then
    echo "[*] Adding user '$USER' to the 'docker' group..."
    sudo usermod -aG docker "$USER"
    echo "[!] You will need to log out and log back in, or run 'newgrp docker' in your terminal for this change to take effect."
fi

# 4. Check and Install NVIDIA Container Toolkit if missing
if ! command -v nvidia-ctk &> /dev/null; then
    echo "[*] NVIDIA Container Toolkit not found. Setting up official repository..."
    
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
      sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
      sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
      
    sudo apt-get update
    echo "[*] Installing nvidia-container-toolkit..."
    sudo apt-get install -y nvidia-container-toolkit
    
    echo "[+] NVIDIA Container Toolkit installed successfully."
else
    echo "[+] NVIDIA Container Toolkit is already installed."
fi

# 5. Configure NVIDIA runtime for Docker
echo "[*] Configuring Docker runtime with nvidia-ctk..."
sudo nvidia-ctk runtime configure --runtime=docker

# 6. Restart Docker daemon to load changes
echo "[*] Restarting Docker service..."
sudo systemctl restart docker

echo "======================================================================"
echo "[+] Configuration Complete!"
echo "======================================================================"
echo "Please perform the following steps to start your GPU-enabled app:"
echo "1. Refresh your shell group membership by running:"
echo "   newgrp docker"
echo "2. Start the application with Docker Compose:"
echo "   docker compose up --build"
echo "======================================================================"
