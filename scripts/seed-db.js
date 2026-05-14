const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });

  // Run the seed script inside the backend container
  console.log('Running database seed...');
  const seed = await ssh.execCommand(
    'docker exec -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/zaui_food?schema=public zaui-food-backend npx prisma db seed',
    { cwd: '/opt/tmfood' }
  );
  console.log('STDOUT:', seed.stdout);
  console.log('STDERR:', seed.stderr);

  ssh.dispose();
}
run();
