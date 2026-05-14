const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });

  // Copy SSL config as active nginx.conf
  console.log('Applying SSL nginx config...');
  await ssh.execCommand('cp nginx-proxy/nginx-ssl.conf nginx-proxy/nginx.conf', { cwd: '/opt/tmfood' });

  // Restart proxy
  console.log('Restarting nginx-proxy...');
  const restart = await ssh.execCommand('docker-compose restart nginx-proxy', { cwd: '/opt/tmfood' });
  console.log(restart.stderr);

  await new Promise(r => setTimeout(r, 2000));

  // Check status
  console.log('\nContainer status:');
  const ps = await ssh.execCommand('docker-compose ps', { cwd: '/opt/tmfood' });
  console.log(ps.stdout);

  // Check proxy logs
  console.log('Proxy logs:');
  const logs = await ssh.execCommand('docker-compose logs --tail=5 nginx-proxy', { cwd: '/opt/tmfood' });
  console.log(logs.stdout);
  if (logs.stderr) console.error(logs.stderr);

  ssh.dispose();
}
run();
