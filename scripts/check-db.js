const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });
  
  console.log('Checking postgres auth...');
  const res = await ssh.execCommand('docker exec zaui-food-postgres psql -U postgres -d zaui_food -c "SELECT 1;"', { cwd: '/opt/tmfood' });
  console.log('STDOUT:', res.stdout);
  console.log('STDERR:', res.stderr);
  
  console.log('Checking backend logs...');
  const logs = await ssh.execCommand('docker-compose logs --tail=20 backend', { cwd: '/opt/tmfood' });
  console.log(logs.stdout);
  
  ssh.dispose();
}
run();
