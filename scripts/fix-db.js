const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });

  // Mark the failed migration as resolved
  console.log('1. Marking failed migration as rolled back...');
  const mark = await ssh.execCommand(
    'docker exec -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/zaui_food?schema=public zaui-food-backend npx prisma migrate resolve --rolled-back 20260509093000_multi_role_cancel_dispatch',
    { cwd: '/opt/tmfood' }
  );
  console.log('STDOUT:', mark.stdout);
  console.log('STDERR:', mark.stderr);

  // Use db push to sync schema directly
  console.log('\n2. Running prisma db push to sync schema...');
  const push = await ssh.execCommand(
    'docker exec -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/zaui_food?schema=public zaui-food-backend npx prisma db push --accept-data-loss',
    { cwd: '/opt/tmfood' }
  );
  console.log('STDOUT:', push.stdout);
  console.log('STDERR:', push.stderr);

  // Restart backend
  console.log('\n3. Restarting backend...');
  const restart = await ssh.execCommand('docker-compose restart backend', { cwd: '/opt/tmfood' });
  console.log('STDERR:', restart.stderr);

  // Wait a moment then check logs
  await new Promise(r => setTimeout(r, 5000));
  console.log('\n4. Backend logs after restart:');
  const logs = await ssh.execCommand('docker-compose logs --tail=15 backend', { cwd: '/opt/tmfood' });
  console.log(logs.stdout);
  if (logs.stderr) console.error(logs.stderr);

  ssh.dispose();
}
run();
