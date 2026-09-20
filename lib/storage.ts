import { S3Client } from "@aws-sdk/client-s3";

/** Coze 对象存储（S3 兼容）；未配置时调用方应降级处理 */
export const s3Client =
  process.env.COZE_STORAGE_URL && process.env.COZE_STORAGE_AK
    ? new S3Client({
        endpoint: process.env.COZE_STORAGE_URL,
        region: "us-east-1",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.COZE_STORAGE_AK || "",
          secretAccessKey: process.env.COZE_STORAGE_SK || "",
        },
      })
    : null;

export const BUCKET_NAME = process.env.COZE_STORAGE_BUCKET || "";
