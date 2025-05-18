#!/bin/bash

# Update system packages
dnf update -y

# Install Node.js and npm & git
dnf install -y nodejs npm git

# Install and configure Apache
dnf install -y httpd
systemctl start httpd
systemctl enable httpd


# Clone the repository
cd /opt
git clone https://github.com/gh0stfrk/cloud.git
cd /opt/cloud/ec2-demo/website

# Install dependencies
npm install
node ec2_report.js

# Set up cron job to update the report every 5 minutes
echo "*/5 * * * * root /usr/bin/node /opt/cloud/ec2-demo/website/ec2_report.js" > /etc/cron.d/ec2-report

# Set proper permissions
chown -R apache:apache /var/www/html
chmod 755 /var/www/html

echo "Setup completed successfully!"