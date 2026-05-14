const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');


const ssh = new NodeSSH();
const zipPath = path.join(__dirname, '../deploy.zip');

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function createZip() {
  console.log('Creating archive using tar...');
  const { stdout, stderr } = await execAsync('tar -a -c -f deploy.zip --exclude=node_modules --exclude=.git --exclude=dist --exclude=www *');
  if (stderr) console.error(stderr);
  console.log('Tar completed.');
}

async function deploy() {
  try {
    await createZip();
    console.log('Archive created successfully.');

    console.log('Connecting to server...');
    await ssh.connect({
      host: '116.118.22.122',
      username: 'root',
      password: 'X#pC1IX@e8s2!d',
      port: 22
    });
    console.log('Connected to server.');

    console.log('Creating target directory...');
    await ssh.execCommand('mkdir -p /opt/tmfood');

    console.log('Uploading archive...');
    await ssh.putFile(zipPath, '/opt/tmfood/deploy.zip');
    console.log('Upload complete.');

    console.log('Extracting archive...');
    await ssh.execCommand('apt-get update && apt-get install -y unzip curl', { cwd: '/opt/tmfood' });
    await ssh.execCommand('unzip -o deploy.zip', { cwd: '/opt/tmfood' });
    await ssh.execCommand('rm -f backend/src/services/queue.ts', { cwd: '/opt/tmfood' });

    console.log('Checking and installing Docker if needed...');
    await ssh.execCommand('command -v docker || (apt-get update && apt-get install -y docker.io docker-compose)');
    
    console.log('Running docker-compose build...');
    const buildRes = await ssh.execCommand('docker-compose build', { cwd: '/opt/tmfood' });
    console.log(buildRes.stdout);
    if (buildRes.stderr) console.error(buildRes.stderr);

    console.log('Running docker-compose up...');
    const upRes = await ssh.execCommand('docker-compose up -d --remove-orphans', { cwd: '/opt/tmfood' });
    console.log(upRes.stdout);
    if (upRes.stderr) console.error(upRes.stderr);

    console.log('Deployment completed successfully!');
    
    // Clean up
    fs.unlinkSync(zipPath);
  } catch (error) {
    console.error('Deployment failed:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
