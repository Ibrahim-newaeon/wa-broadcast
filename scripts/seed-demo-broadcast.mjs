// Dev utility: seed a completed demo broadcast with recipients across every
// delivery status plus a few button-click events, so the campaign analytics
// view has data to render. Prints the broadcast id.
// Usage (in the app container): node scripts/seed-demo-broadcast.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const template = await prisma.template.upsert({
  where: { name_language: { name: "eid_promo", language: "ar" } },
  create: { name: "eid_promo", language: "ar", category: "MARKETING", variableCount: 1, status: "APPROVED" },
  update: {},
});

const stamp = Date.now().toString(36);
const list = await prisma.contactList.create({ data: { name: `Demo VIP customers (${stamp})` } });

const broadcast = await prisma.broadcast.create({
  data: {
    templateId: template.id, listId: list.id, status: "COMPLETED",
    totalCount: 10, sentCount: 9, failedCount: 1,
    startedAt: new Date(), completedAt: new Date(),
  },
});

const statuses = ["SENT", "DELIVERED", "READ", "READ", "DELIVERED", "READ", "FAILED", "DELIVERED", "READ", "SENT"];
const clickLabels = ["Shop now", "Track order"];

for (let i = 0; i < statuses.length; i++) {
  const phone = `9665${stamp}${String(i).padStart(2, "0")}`.slice(0, 15);
  const contact = await prisma.contact.create({ data: { phone, name: `Demo Contact ${i + 1}`, attributes: {} } });
  const wamid = `wamid.demo.${broadcast.id}.${i}`;
  const rec = await prisma.broadcastRecipient.create({
    data: {
      broadcastId: broadcast.id, contactId: contact.id, status: statuses[i], wamid,
      error: statuses[i] === "FAILED" ? "(131049) outside 24h window" : null,
    },
  });
  // Some READ recipients tapped a button.
  if (statuses[i] === "READ" && i % 2 === 0) {
    await prisma.messageEvent.create({
      data: { recipientId: rec.id, wamid, type: "click", payload: { label: clickLabels[(i / 2) % 2], from: phone } },
    });
  }
}

console.log("Demo broadcast id:", broadcast.id);
await prisma.$disconnect();
