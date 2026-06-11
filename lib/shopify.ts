import https from "node:https";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function startOrdersBulkOperation() {
  const mutation = `
    mutation {
      bulkOperationRunQuery(
        query: """
        {
          orders(query: "created_at:>=2025-01-01") {
            edges {
              node {
                id
                name
                createdAt
                currencyCode
                subtotalLineItemsQuantity
                shippingAddress { countryCodeV2 }
                lineItems {
                  edges {
                    node {
                      sku
                      title
                      quantity
                      discountedTotalSet { shopMoney { amount currencyCode } }
                    }
                  }
                }
                refunds {
                  id
                  createdAt
                  processedAt
                  note
                  totalRefundedSet { shopMoney { amount currencyCode } }
                }
                returns {
                  edges {
                    node {
                      id
                      status
                    }
                  }
                }
              }
            }
          }
        }
        """
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
  `;
  return shopifyGraphql<{
    bulkOperationRunQuery: {
      bulkOperation?: { id: string; status: string };
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(mutation);
}

export async function currentBulkOperation() {
  return shopifyGraphql<{
    currentBulkOperation?: {
      id: string;
      status: string;
      errorCode?: string;
      objectCount: string;
      rootObjectCount: string;
      url?: string;
      partialDataUrl?: string;
      createdAt: string;
      completedAt?: string;
    };
  }>(`
    query {
      currentBulkOperation {
        id
        status
        errorCode
        objectCount
        rootObjectCount
        url
        partialDataUrl
        createdAt
        completedAt
      }
    }
  `);
}

async function shopifyGraphql<T>(query: string): Promise<ShopifyGraphqlResponse<T>> {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shop || !token) {
    return { errors: [{ message: "Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN" }] };
  }
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
      });
      return response.json() as Promise<ShopifyGraphqlResponse<T>>;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown Shopify request error";
      await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    }
  }
  try {
    return await shopifyHttpsRequest<T>(shop, token, query);
  } catch (error) {
    const fallbackError = error instanceof Error ? error.message : "Unknown Shopify fallback error";
    return { errors: [{ message: `Shopify request failed after retries: ${lastError}; fallback failed: ${fallbackError}` }] };
  }
}

function shopifyHttpsRequest<T>(shop: string, token: string, query: string): Promise<ShopifyGraphqlResponse<T>> {
  const body = JSON.stringify({ query });
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: shop,
      path: `/admin/api/${API_VERSION}/graphql.json`,
      method: "POST",
      family: 4,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Shopify-Access-Token": token,
      },
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        text += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(text) as ShopifyGraphqlResponse<T>);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(30_000, () => request.destroy(new Error("Shopify HTTPS request timed out")));
    request.write(body);
    request.end();
  });
}
