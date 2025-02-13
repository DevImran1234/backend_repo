import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}, 
  maxRetriesPerRequest: null, 
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => {
    console.error("Redis reconnecting due to error:", err);
    return true;
  },
  enableAutoPipelining: true,
  connectTimeout: 10000,
});

redis.on("connect", () => {
  console.log("✅ Connected to Redis successfully");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

export { redis };
