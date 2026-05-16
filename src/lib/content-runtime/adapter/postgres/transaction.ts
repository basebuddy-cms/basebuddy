import type { ContentDatabaseClient } from "@/lib/content-runtime/mapped-content-runtime-support";

type TransactionClient = Pick<ContentDatabaseClient, "query">;

export const withContentAdapterTransaction = async <T>(
  client: TransactionClient,
  work: () => Promise<T>,
): Promise<T> => {
  await client.query("begin");

  try {
    const result = await work();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};
