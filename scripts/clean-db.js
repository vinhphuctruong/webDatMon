const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '116.118.22.122',
    username: 'root',
    password: 'X#pC1IX@e8s2!d',
    port: 22
  });

  // Delete all data except admin user and platform wallets
  const sql = `
    DELETE FROM "WalletTransaction";
    DELETE FROM "WalletPayout";
    DELETE FROM "SePayTopupRequest";
    DELETE FROM "OrderPayment";
    DELETE FROM "DriverReview";
    DELETE FROM "ProductReview";
    DELETE FROM "Review";
    DELETE FROM "VoucherUsage";
    DELETE FROM "VoucherClaim";
    DELETE FROM "Voucher";
    DELETE FROM "HeroBanner";
    DELETE FROM "DispatchAttempt";
    DELETE FROM "OrderDispatch";
    DELETE FROM "OrderItem";
    DELETE FROM "Order";
    DELETE FROM "CartItem";
    DELETE FROM "Option";
    DELETE FROM "OptionGroup";
    DELETE FROM "ProductCategory";
    DELETE FROM "Product";
    DELETE FROM "Category";
    DELETE FROM "RefreshToken";
    DELETE FROM "DriverApplication";
    DELETE FROM "StoreApplication";
    DELETE FROM "DriverProfile";
    DELETE FROM "Address";
    DELETE FROM "Wallet";
    DELETE FROM "Store";
    DELETE FROM "User" WHERE role != 'ADMIN';
  `;

  console.log('Xóa toàn bộ dữ liệu ảo (giữ lại tài khoản Admin)...');
  const res = await ssh.execCommand(
    `docker exec zaui-food-postgres psql -U postgres -d zaui_food -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    { cwd: '/opt/tmfood' }
  );
  console.log('STDOUT:', res.stdout);
  if (res.stderr) console.log('STDERR:', res.stderr);

  // Re-create platform wallets for admin
  const walletSql = `
    INSERT INTO "Wallet" (id, "ownerType", type, "scopeKey", "availableBalance", "holdBalance", currency, "isActive", "createdAt", "updatedAt")
    VALUES 
      (gen_random_uuid(), 'PLATFORM', 'PLATFORM_ESCROW', 'PLATFORM:PLATFORM_ESCROW', 0, 0, 'VND', true, NOW(), NOW()),
      (gen_random_uuid(), 'PLATFORM', 'PLATFORM_REVENUE', 'PLATFORM:PLATFORM_REVENUE', 0, 0, 'VND', true, NOW(), NOW())
    ON CONFLICT ("scopeKey") DO NOTHING;
  `;

  console.log('\nTạo lại ví Platform...');
  const walletRes = await ssh.execCommand(
    `docker exec zaui-food-postgres psql -U postgres -d zaui_food -c "${walletSql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    { cwd: '/opt/tmfood' }
  );
  console.log('STDOUT:', walletRes.stdout);

  // Verify
  console.log('\nKiểm tra dữ liệu còn lại:');
  const verify = await ssh.execCommand(
    'docker exec zaui-food-postgres psql -U postgres -d zaui_food -c "SELECT role, email FROM \\"User\\"; SELECT type FROM \\"Wallet\\";"',
    { cwd: '/opt/tmfood' }
  );
  console.log(verify.stdout);

  ssh.dispose();
}
run();
