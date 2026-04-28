import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";

async function main() {
  const email = "admin@tmfood.vn";
  const password = "admin";
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findFirst({ where: { email, role: UserRole.ADMIN } });
  if (existing) {
    console.log("Admin user already exists");
    return;
  }

  await prisma.user.create({
    data: {
      name: "Super Admin",
      email,
      passwordHash,
      role: UserRole.ADMIN,
      phone: "0000000000",
    },
  });

  console.log("Admin user created successfully: admin@tmfood.vn / admin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
