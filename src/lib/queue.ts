import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

export interface SendJob {
  broadcastId: string;
  clientId?: string;
  recipientId: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
  headerFormat?: string | null;   // IMAGE | DOCUMENT | VIDEO (media-header templates)
  headerMediaUrl?: string | null; // media link for the header component
  couponCode?: string | null;     // code for a COPY_CODE (coupon) button
  carouselCards?: { format: string; mediaUrl: string }[] | null; // carousel card media
}

export const SEND_QUEUE = "wa-send";

export const sendQueue = new Queue<SendJob>(SEND_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
