/**
 * CLI Command Handlers
 * Subcommands for direct CLI invocation (e.g., by OpenClaw skills).
 * Each handler outputs JSON to stdout and exits with 0 (success) or 1 (error).
 */

import { KrogerService } from './services/kroger.service.js';
import { loadConfig } from './config.js';
import type { Product, ProductItem } from './api/types.js';

// ─── Shared helpers (mirrored from mcp/tools.ts) ───

function pickPreferredItem(product: Product): ProductItem | undefined {
  const items = product.items ?? [];
  if (items.length === 0) return undefined;

  const isInStock = (sl: string | undefined) => sl === 'HIGH' || sl === 'LOW';

  return (
    items.find((item) => isInStock(item.inventory?.stockLevel)) ??
    items.find((item) => item.inventory?.stockLevel !== undefined) ??
    items[0]
  );
}

function stockLevelToInStock(stockLevel: string | undefined): boolean | undefined {
  if (stockLevel === 'HIGH' || stockLevel === 'LOW') return true;
  if (stockLevel === 'TEMPORARILY_OUT_OF_STOCK') return false;
  return undefined;
}

function stockLevelToAvailability(
  stockLevel: string | undefined
): 'in_stock' | 'out_of_stock' | 'unknown' {
  if (stockLevel === 'HIGH' || stockLevel === 'LOW') return 'in_stock';
  if (stockLevel === 'TEMPORARILY_OUT_OF_STOCK') return 'out_of_stock';
  return 'unknown';
}

// ─── Arg parsing helpers ───

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function parseFlagInt(args: string[], flag: string): number | undefined {
  const val = parseFlag(args, flag);
  if (val === undefined) return undefined;
  const n = parseInt(val, 10);
  if (isNaN(n)) {
    throw new Error(`Invalid value for ${flag}: ${val}`);
  }
  return n;
}

function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

function createService(): KrogerService {
  const config = loadConfig();
  return new KrogerService(config);
}

// ─── Command handlers ───

async function storesCommand(args: string[]): Promise<void> {
  const zipCode = args[0];
  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    fail('Usage: pantry-agent stores <zip> [--limit N]');
  }
  const limit = parseFlagInt(args, '--limit');

  const kroger = createService();
  const response = await kroger.findStoresPage({ zipCode, limit: limit ?? 5 });
  const stores = response.data;

  const formatted = stores.map((s) => ({
    locationId: s.locationId,
    name: s.name,
    chain: s.chain,
    address: `${s.address.addressLine1}, ${s.address.city}, ${s.address.state} ${s.address.zipCode}`,
    phone: s.phone,
  }));

  const pagination = response.meta?.pagination;
  output({
    count: formatted.length,
    has_more: pagination ? pagination.start + pagination.limit < pagination.total : false,
    stores: formatted,
  });
}

async function storeCommand(args: string[]): Promise<void> {
  const locationId = args[0];
  if (!locationId) {
    fail('Usage: pantry-agent store <locationId>');
  }

  const kroger = createService();
  const store = await kroger.getStore(locationId);

  output({
    locationId: store.locationId,
    name: store.name,
    chain: store.chain,
    address: store.address,
    phone: store.phone,
    hours: store.hours,
    departments: store.departments?.map((d) => d.name),
  });
}

async function searchCommand(args: string[]): Promise<void> {
  const term = args[0];
  const storeId = parseFlag(args, '--store');
  if (!term || !storeId) {
    fail('Usage: pantry-agent search "<term>" --store <locationId> [--limit N] [--brand X]');
  }

  const limit = parseFlagInt(args, '--limit') ?? 10;
  const brand = parseFlag(args, '--brand');

  const kroger = createService();
  const response = await kroger.searchProductsPage({
    term,
    locationId: storeId,
    limit,
    brand: brand ?? undefined,
  });

  const products = response.data.map((p) => {
    const selectedItem = pickPreferredItem(p);
    const stockLevel = selectedItem?.inventory?.stockLevel;
    return {
      productId: p.productId,
      upc: p.upc,
      name: p.description,
      brand: p.brand,
      price: selectedItem?.price?.regular,
      inStock: stockLevelToInStock(stockLevel),
      stockLevel,
      availability: stockLevelToAvailability(stockLevel),
      aisle: p.aisleLocations?.[0]?.description,
    };
  });

  const pagination = response.meta?.pagination;
  output({
    count: products.length,
    has_more: pagination ? pagination.start + pagination.limit < pagination.total : false,
    products,
  });
}

async function productCommand(args: string[]): Promise<void> {
  const productId = args[0];
  const storeId = parseFlag(args, '--store');
  if (!productId || !storeId) {
    fail('Usage: pantry-agent product <productId> --store <locationId>');
  }

  const kroger = createService();
  const product = await kroger.getProduct(productId, storeId);
  const selectedItem = pickPreferredItem(product);

  output({
    productId: product.productId,
    upc: product.upc,
    name: product.description,
    brand: product.brand,
    categories: product.categories,
    price: selectedItem?.price,
    size: selectedItem?.size,
    inStock: selectedItem?.inventory?.stockLevel,
    fulfillment: selectedItem?.fulfillment,
    aisle: product.aisleLocations?.[0],
  });
}

async function cartCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  if (subcommand !== 'add') {
    fail('Usage: pantry-agent cart add <upc> [--qty N] [--modality PICKUP|DELIVERY]');
  }

  const upc = args[1];
  if (!upc || !/^\d{13}$/.test(upc)) {
    fail('Usage: pantry-agent cart add <upc> [--qty N] [--modality PICKUP|DELIVERY]\nUPC must be 13 digits.');
  }

  const qty = parseFlagInt(args, '--qty') ?? 1;
  const modality = parseFlag(args, '--modality') as 'PICKUP' | 'DELIVERY' | undefined;
  if (modality && modality !== 'PICKUP' && modality !== 'DELIVERY') {
    fail('--modality must be PICKUP or DELIVERY');
  }

  const kroger = createService();
  await kroger.addToCart({
    items: [{ upc, quantity: qty, modality }],
  });

  output({
    success: true,
    itemCount: qty,
    message: `Successfully added ${qty} item(s) to your Kroger cart.`,
  });
}

// ─── Router ───

export async function runCommand(command: string, args: string[]): Promise<void> {
  try {
    switch (command) {
      case 'stores':
        await storesCommand(args);
        break;
      case 'store':
        await storeCommand(args);
        break;
      case 'search':
        await searchCommand(args);
        break;
      case 'product':
        await productCommand(args);
        break;
      case 'cart':
        await cartCommand(args);
        break;
      default:
        fail(`Unknown command: ${command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('AUTH_REQUIRED:')) {
      fail('Authentication required. Run `npx @blanxlait/pantry-agent auth` first, then retry.');
    }
    fail(message);
  }
}
