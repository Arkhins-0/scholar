/**
 * Verifies the S3-compatible object storage configuration in .env:
 * lists buckets, and (if S3_BUCKET is set) writes, reads and deletes a probe object.
 *
 * Usage: node --env-file=.env scripts/storage-check.mjs
 */
import {
  S3Client,
  ListBucketsCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
  forcePathStyle: true,
});

try {
  const r = await s3.send(new ListBucketsCommand({}));
  console.log("Buckets:", (r.Buckets ?? []).map((b) => b.Name));
} catch (e) {
  console.log("ListBuckets failed:", e.name, e.message, e.$metadata?.httpStatusCode);
}

const bucket = process.env.S3_BUCKET;
if (!bucket) {
  console.log("S3_BUCKET not set — skipping read/write probe.");
  process.exit(0);
}

if (process.argv.includes("--create")) {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created bucket ${bucket}`);
  } catch (e) {
    console.log("CreateBucket:", e.name, e.message);
  }
}

const key = `_probe/${Date.now()}.txt`;
await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "ok", ContentType: "text/plain" }));
const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
console.log("Round-trip:", await got.Body.transformToString());
await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log(`Storage OK (bucket ${bucket})`);
