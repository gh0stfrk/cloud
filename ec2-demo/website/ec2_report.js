const AWS = require('aws-sdk');
const fs = require('fs');
const { exec } = require('child_process');
const moment = require('moment');

// Configure AWS SDK
AWS.config.update({ region: 'us-east-1' });
const ec2 = new AWS.EC2();

// Define the Apache web server directory
const APACHE_HTML_DIR = '/var/www/html/';

async function getEC2Instances() {
    try {
        const data = await ec2.describeInstances().promise();
        return data.Reservations.flatMap(reservation => 
            reservation.Instances.map(instance => ({
                InstanceId: instance.InstanceId,
                InstanceType: instance.InstanceType,
                State: instance.State.Name,
                PublicIP: instance.PublicIpAddress,
                PrivateIP: instance.PrivateIpAddress,
                LaunchTime: instance.LaunchTime,
                Tags: instance.Tags
            }))
        );
    } catch (error) {
        console.error('Error fetching EC2 instances:', error);
        throw error;
    }
}

async function getSystemUsers() {
    return new Promise((resolve, reject) => {
        exec('getent passwd', (error, stdout, stderr) => {
            if (error) {
                console.error('Error getting system users:', error);
                reject(error);
                return;
            }
            const users = stdout.split('\n')
                .filter(line => line.length > 0)
                .map(line => {
                    const [username, , uid, gid, info, homeDir, shell] = line.split(':');
                    return { username, uid, gid, info, homeDir, shell };
                });
            resolve(users);
        });
    });
}

async function getHostname() {
    return new Promise((resolve, reject) => {
        exec('hostname -f', (error, stdout, stderr) => {
            if (error) {
                console.error('Error getting hostname:', error);
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

async function generateHTML(instances, users, hostname) {
    const currentTime = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>EC2 and Users Report - ${hostname}</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            table { 
                border-collapse: collapse; 
                width: 100%; 
                margin-bottom: 20px;
                background-color: white;
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 12px 8px; 
                text-align: left; 
            }
            th { 
                background-color: #4CAF50; 
                color: white;
            }
            tr:nth-child(even) { 
                background-color: #f2f2f2; 
            }
            .section { 
                margin-bottom: 30px; 
            }
            .header {
                color: #333;
                border-bottom: 2px solid #4CAF50;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }
            .footer {
                margin-top: 30px;
                padding-top: 10px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 0.9em;
            }
            .hostname {
                color: #4CAF50;
                font-size: 1.2em;
                margin-bottom: 10px;
            }
            .auto-refresh {
                color: #666;
                font-size: 0.8em;
                text-align: right;
            }
        </style>
        <meta http-equiv="refresh" content="300">
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="hostname">Server: ${hostname}</div>
                <h1>EC2 Instances and Users Report</h1>
                <p>Generated on: ${currentTime} UTC</p>
                <p class="auto-refresh">This page auto-refreshes every 5 minutes</p>
            </div>
            
            <div class="section">
                <h2>EC2 Instances</h2>
                <table>
                    <tr>
                        <th>Instance ID</th>
                        <th>Type</th>
                        <th>State</th>
                        <th>Public IP</th>
                        <th>Private IP</th>
                        <th>Launch Time</th>
                        <th>Tags</th>
                    </tr>
                    ${instances.map(instance => `
                        <tr>
                            <td>${instance.InstanceId}</td>
                            <td>${instance.InstanceType}</td>
                            <td>${instance.State}</td>
                            <td>${instance.PublicIP || 'N/A'}</td>
                            <td>${instance.PrivateIP || 'N/A'}</td>
                            <td>${moment(instance.LaunchTime).utc().format('YYYY-MM-DD HH:mm:ss')}</td>
                            <td>${instance.Tags ? instance.Tags.map(tag => `${tag.Key}: ${tag.Value}`).join('<br>') : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <div class="section">
                <h2>System Users</h2>
                <table>
                    <tr>
                        <th>Username</th>
                        <th>UID</th>
                        <th>GID</th>
                        <th>Info</th>
                        <th>Home Directory</th>
                        <th>Shell</th>
                    </tr>
                    ${users.map(user => `
                        <tr>
                            <td>${user.username}</td>
                            <td>${user.uid}</td>
                            <td>${user.gid}</td>
                            <td>${user.info || 'N/A'}</td>
                            <td>${user.homeDir}</td>
                            <td>${user.shell}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="footer">
                <p>Generated by: ${process.env.USER || 'gh0stfrk'}</p>
                <p>Server Time: ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Write to Apache's web directory
    fs.writeFileSync(`${APACHE_HTML_DIR}index.html`, html);
    console.log('Report generated successfully in Apache web directory');
}

async function main() {
    try {
        const instances = await getEC2Instances();
        const users = await getSystemUsers();
        const hostname = await getHostname();
        await generateHTML(instances, users, hostname);
    } catch (error) {
        console.error('Error generating report:', error);
    }
}

main();