const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const DOMAINS = [
  'api.116.118.22.122.nip.io',
  'admin.116.118.22.122.nip.io',
];

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });

  // Step 1: Copy init config and restart proxy
  console.log('=== Step 1: Switch to HTTP-only nginx config ===');
  await ssh.execCommand('cp nginx-proxy/nginx-init.conf nginx-proxy/nginx.conf', { cwd: '/opt/tmfood' });
  
  // Restart proxy with new config
  const restart = await ssh.execCommand('docker-compose restart nginx-proxy', { cwd: '/opt/tmfood' });
  console.log('Restart:', restart.stderr);
  await new Promise(r => setTimeout(r, 3000));

  // Test ACME path is working
  console.log('\nTesting ACME path...');
  await ssh.execCommand('mkdir -p /tmp/certbot-test');
  
  // Test with curl from inside the proxy container
  const testWrite = await ssh.execCommand(
    'docker exec zaui-food-proxy sh -c "mkdir -p /var/www/certbot/.well-known/acme-challenge && echo OK > /var/www/certbot/.well-known/acme-challenge/test"',
    { cwd: '/opt/tmfood' }
  );
  console.log('Write test file:', testWrite.stderr || 'OK');

  const testRead = await ssh.execCommand(
    'curl -s http://localhost/.well-known/acme-challenge/test',
    { cwd: '/opt/tmfood' }
  );
  console.log('Read test:', testRead.stdout);

  // Step 2: Request certificates
  console.log('\n=== Step 2: Requesting SSL certificates ===');
  const domainArgs = DOMAINS.map(d => `-d ${d}`).join(' ');
  const certCmd = `docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email truongphuc05112004@gmail.com --agree-tos --no-eff-email --force-renewal ${domainArgs}`;
  console.log('Running:', certCmd);
  const certRes = await ssh.execCommand(certCmd, { cwd: '/opt/tmfood' });
  console.log('STDOUT:', certRes.stdout);
  console.log('STDERR:', certRes.stderr);

  const success = (certRes.stderr + certRes.stdout).includes('Successfully received certificate');

  if (success) {
    console.log('\n=== Step 3: Switching to SSL nginx config ===');
    await ssh.execCommand('cp nginx-proxy/nginx-ssl.conf nginx-proxy/nginx.conf', { cwd: '/opt/tmfood' });
    await ssh.execCommand('docker-compose restart nginx-proxy', { cwd: '/opt/tmfood' });
    await new Promise(r => setTimeout(r, 2000));

    const ps = await ssh.execCommand('docker-compose ps', { cwd: '/opt/tmfood' });
    console.log(ps.stdout);
    console.log('\n✅ HTTPS setup complete!');
    console.log('API:   https://api.116.118.22.122.nip.io/api/v1');
    console.log('Admin: https://admin.116.118.22.122.nip.io');
  } else {
    console.log('\n❌ Certificate failed. See output above.');
  }

  ssh.dispose();
}
run();
