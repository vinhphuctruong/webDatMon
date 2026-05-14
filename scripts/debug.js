const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });
  
  console.log('Connected, installing docker...');
  const res = await ssh.execCommand('curl -fsSL https://get.docker.com | sh');
  console.log('STDOUT:', res.stdout);
  console.log('STDERR:', res.stderr);
  ssh.dispose();
}
run();
