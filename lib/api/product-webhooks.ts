// 🎯 Configuration of products and their webhooks
export interface ProductWebhooks {
  [productName: string]: {
    page_id: string;
    name: string;
    webhooks: {
      all: string;
      video: string;
      image: string;
    };
  };
}

export const PRODUCT_WEBHOOKS: ProductWebhooks = {
  replika: {
    page_id: '553223604546344',
    name: 'Replika',
    webhooks: {
      all: 'https://hook.us2.make.com/o3mat9a4q1v186mdhi7xu1sjamublb28',
      video: 'https://hook.us2.make.com/o3mat9a4q1v186mdhi7xu1sjamublb28',
      image: 'https://hook.us2.make.com/o3mat9a4q1v186mdhi7xu1sjamublb28',
    },
  },
  // 📝 Add other products here...
  // betterme: {
  //   page_id: "123456789",
  //   name: "BetterMe",
  //   webhooks: {
  //     all: "...",
  //     video: "...",
  //     image: "..."
  //   }
  // }
};

/**
 * 🔍 Determines product by Meta Ad Library URL
 */
export function detectProductFromUrl(url: string): {
  productKey: string | null;
  productName: string | null;
  pageId: string | null;
} {
  try {
    // Extract page_id from URL
    const urlObj = new URL(url);
    const pageId =
      urlObj.searchParams.get('view_all_page_id') ||
      urlObj.searchParams.get('page_id') ||
      urlObj.pathname.match(/page\/(\d+)/)?.[1];

    if (!pageId) {
      return { productKey: null, productName: null, pageId: null };
    }

    // Find product by page_id
    for (const [key, config] of Object.entries(PRODUCT_WEBHOOKS)) {
      if (config.page_id === pageId) {
        return {
          productKey: key,
          productName: config.name,
          pageId: pageId,
        };
      }
    }

    return { productKey: null, productName: null, pageId };
  } catch (error) {
    console.error('Error parsing URL:', error);
    return { productKey: null, productName: null, pageId: null };
  }
}

/**
 * 🎯 Gets webhook URL for product and creative type
 */
export function getWebhookUrl(
  productKey: string,
  creativeType: 'all' | 'video' | 'image'
): string | null {
  const product = PRODUCT_WEBHOOKS[productKey];
  if (!product) return null;
  return product.webhooks[creativeType];
}
