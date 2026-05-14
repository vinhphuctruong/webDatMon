import fs from 'fs';
import path from 'path';
import { NodeSSH } from 'node-ssh';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ssh = new NodeSSH();
const zipPath = path.join(__dirname, '../deploy.zip');

async function createZip() {
  console.log('Creating zip archive...');
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer() + ' total bytes'));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    archive.glob('**/*', {
      cwd: path.join(__dirname, '..'),
      ignore: [
        'node_modules/**',
        '**/node_modules/**',
        '**/.git/**',
        'miniapp-*/www/**',
        'miniapp-*/dist/**',
        'admin-portal/dist/**',
        'deploy.zip'
      ]
    });

    archive.finalize();
  });
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
    // Install unzip if not present
    await ssh.execCommand('apt-get update && apt-get install -y unzip', { cwd: '/opt/tmfood' });
    await ssh.execCommand('unzip -o deploy.zip', { cwd: '/opt/tmfood' });

    console.log('Running docker-compose build...');
    const buildRes = await ssh.execCommand('docker compose build', { cwd: '/opt/tmfood' });
    console.log(buildRes.stdout);
    if (buildRes.stderr) console.error(buildRes.stderr);

    console.log('Running docker-compose up...');
    const upRes = await ssh.execCommand('docker compose up -d', { cwd: '/opt/tmfood' });
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
