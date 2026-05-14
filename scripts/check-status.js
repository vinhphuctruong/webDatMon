const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });

  // Wait for backend to start
  await new Promise(r => setTimeout(r, 3000));

  console.log('Backend logs:');
  const logs = await ssh.execCommand('docker-compose logs --tail=10 backend', { cwd: '/opt/tmfood' });
  console.log(logs.stdout);
  
  console.log('\nAll containers:');
  const ps = await ssh.execCommand('docker-compose ps', { cwd: '/opt/tmfood' });
  console.log(ps.stdout);

  ssh.dispose();
}
run();
