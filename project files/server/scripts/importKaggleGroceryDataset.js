/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connectDB, mongoose } = require('../src/config/db');
const Category = require('../src/models/Category');
const Brand = require('../src/models/Brand');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();

const toKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const hash8 = (value) => crypto.createHash('md5').update(String(value || '')).digest('hex').slice(0, 8).toUpperCase();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = { datasetPath: '', csvPath: '', dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--path' || a === '-p') out.datasetPath = args[i + 1] || '';
    if (a === '--file' || a === '-f') out.csvPath = args[i + 1] || '';
    if (a === '--dry-run') out.dryRun = true;
  }
  return out;
};

const walk = (dir) => {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};

const findCsv = (datasetPath) => {
  const files = walk(datasetPath).filter((p) => p.toLowerCase().endsWith('.csv'));
  if (!files.length) return '';
  files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  return files[0];
};

const parseCsv = (content) => {
  const rows = [];
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return rows;

  const parseLine = (line) => {
    const values = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const nx = line[i + 1];
      if (ch === '"') {
        if (inQuotes && nx === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        values.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    values.push(cur);
    return values.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i += 1) {
    const raw = parseLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j += 1) row[headers[j]] = raw[j] || '';
    rows.push(row);
  }
  return rows;
};

const pickField = (row, headerIndex, candidates) => {
  for (const c of candidates) {
    const key = headerIndex.get(toKey(c));
    if (key && row[key] !== undefined && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
};

const toNumber = (value, fallback) => {
  const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const readTextIfExists = (filePath) => {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
  return '';
};

const toWebishPath = (value) => String(value || '').replace(/\\/g, '/');

const normalizeClassificationRows = (rows, datasetRoot, headerIndex) => {
  const classKey = headerIndex.get(toKey('Class Name (str)'));
  const classIdKey = headerIndex.get(toKey('Class ID (int)'));
  const coarseKey = headerIndex.get(toKey('Coarse Class Name (str)'));
  const iconPathKey = headerIndex.get(toKey('Iconic Image Path (str)'));
  const descPathKey = headerIndex.get(toKey('Product Description Path (str)'));

  return rows
    .map((row) => {
      const className = String(row[classKey] || '').trim();
      if (!className) return null;
      const coarse = String(row[coarseKey] || 'General').trim() || 'General';
      const classId = String(row[classIdKey] || className).trim();
      const iconRel = toWebishPath(String(row[iconPathKey] || '').trim()).replace(/^\//, '');
      const descRel = toWebishPath(String(row[descPathKey] || '').trim()).replace(/^\//, '');
      const descAbs = descRel ? path.join(datasetRoot, descRel) : '';
      const description = readTextIfExists(descAbs) || `${className.replace(/-/g, ' ')} in ${coarse}`;
      return {
        _normalized: true,
        id: `class-${classId}`,
        name: className.replace(/-/g, ' '),
        brand: coarse,
        category: coarse === 'General' ? 'Grocery' : coarse,
        subCategory: className.replace(/-/g, ' '),
        image: iconRel ? `/${iconRel}` : '',
        description,
        size: '1 unit',
        stock: 100,
        price: 99,
        mrp: 119,
        rating: 4.3,
        reviews: 100
      };
    })
    .filter(Boolean);
};

const ensureSeller = async () => {
  const seller = await User.findOne({ role: 'seller' }).select('_id').lean();
  if (seller) return seller._id;
  throw new Error('No seller account found. Seed sellers first (npm run seed:marketplace).');
};

const ensureCategory = async (name, level, parentCategoryId = null, displayOrder = 1) => {
  const safeName = String(name || '').trim();
  if (!safeName) return null;
  const slug = parentCategoryId ? `${slugify(String(parentCategoryId))}-${slugify(safeName)}` : slugify(safeName);
  return Category.findOneAndUpdate(
    { slug, level, parentCategoryId: parentCategoryId || null },
    { $set: { name: safeName, slug, level, parentCategoryId: parentCategoryId || null, isActive: true, displayOrder } },
    { upsert: true, returnDocument: 'after' }
  );
};

const splitCategory = (rawCategory, rawSubCategory) => {
  const c = String(rawCategory || '').trim();
  const s = String(rawSubCategory || '').trim();
  if (c && s) return { root: c, sub: s };
  if (c.includes('>')) {
    const parts = c.split('>').map((x) => x.trim()).filter(Boolean);
    return { root: parts[0] || 'General', sub: parts[1] || parts[0] || 'General' };
  }
  if (c.includes('/')) {
    const parts = c.split('/').map((x) => x.trim()).filter(Boolean);
    return { root: parts[0] || 'General', sub: parts[1] || parts[0] || 'General' };
  }
  return { root: c || 'General', sub: s || c || 'General' };
};

const run = async () => {
  const { datasetPath, csvPath, dryRun } = parseArgs();
  if (!datasetPath && !csvPath) {
    throw new Error('Provide dataset path: --path "<kaggle dataset folder>" or csv file: --file "<file.csv>"');
  }

  const resolvedCsv = csvPath
    ? path.resolve(csvPath)
    : findCsv(path.resolve(datasetPath));

  if (!resolvedCsv || !fs.existsSync(resolvedCsv)) {
    throw new Error('CSV file not found. Pass --file or ensure dataset folder contains .csv files.');
  }

  console.log(`Using CSV: ${resolvedCsv}`);
  const csv = fs.readFileSync(resolvedCsv, 'utf8');
  const rows = parseCsv(csv);
  if (!rows.length) throw new Error('CSV has no rows.');

  const sample = rows[0];
  const headerIndex = new Map(Object.keys(sample).map((h) => [toKey(h), h]));
  const datasetRoot = path.dirname(resolvedCsv);
  const looksLikeClassificationDataset =
    headerIndex.has(toKey('Class Name (str)')) &&
    headerIndex.has(toKey('Class ID (int)')) &&
    headerIndex.has(toKey('Coarse Class Name (str)'));
  const importRows = looksLikeClassificationDataset ? normalizeClassificationRows(rows, datasetRoot, headerIndex) : rows;

  if (!importRows.length) throw new Error('No importable rows found after normalization.');
  if (looksLikeClassificationDataset) {
    console.log(`Detected classification dataset format. Normalized ${importRows.length} class rows into product rows.`);
  }

  const sellerId = dryRun ? null : await ensureSeller();

  const rootCache = new Map();
  const subCache = new Map();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < importRows.length; i += 1) {
    const row = importRows[i];
    const normalized = !!row._normalized;
    const name = normalized
      ? String(row.name || '').trim()
      : pickField(row, headerIndex, ['product_name', 'name', 'title', 'item_name', 'product']);
    if (!name) {
      skipped += 1;
      continue;
    }
    const brand = normalized ? String(row.brand || 'Generic') : pickField(row, headerIndex, ['brand', 'brand_name', 'company']) || 'Generic';
    const categoryRaw = normalized
      ? String(row.category || '')
      : pickField(row, headerIndex, ['category', 'main_category', 'department', 'group']);
    const subCategoryRaw = normalized
      ? String(row.subCategory || '')
      : pickField(row, headerIndex, ['subcategory', 'sub_category', 'subgroup', 'type']);
    const { root, sub } = splitCategory(categoryRaw, subCategoryRaw);

    const imageUrl = normalized
      ? String(row.image || '')
      : pickField(row, headerIndex, ['image', 'image_url', 'img', 'thumbnail', 'photo', 'url']);
    const description = normalized
      ? String(row.description || `${name} from ${brand}`)
      : pickField(row, headerIndex, ['description', 'about', 'details']) || `${name} from ${brand}`;
    const size = normalized
      ? String(row.size || '1 unit')
      : pickField(row, headerIndex, ['size', 'weight', 'unit', 'variant', 'pack_size']) || '1 unit';
    const stock = Math.max(
      0,
      Math.floor(
        normalized ? toNumber(row.stock, 100) : toNumber(pickField(row, headerIndex, ['stock', 'quantity', 'available_qty', 'qty']), 100)
      )
    );
    const price = Math.max(
      1,
      normalized ? toNumber(row.price, 99) : toNumber(pickField(row, headerIndex, ['price', 'selling_price', 'sale_price', 'current_price']), 99)
    );
    const mrp = Math.max(
      price,
      normalized ? toNumber(row.mrp, Math.max(price, 119)) : toNumber(pickField(row, headerIndex, ['mrp', 'list_price', 'original_price', 'regular_price']), price)
    );
    const rating = Math.min(
      5,
      Math.max(0, normalized ? toNumber(row.rating, 4.3) : toNumber(pickField(row, headerIndex, ['rating', 'avg_rating']), 0))
    );
    const totalReviews = Math.max(
      0,
      Math.floor(normalized ? toNumber(row.reviews, 100) : toNumber(pickField(row, headerIndex, ['review_count', 'reviews', 'ratings_count']), 0))
    );
    const keyId = normalized
      ? String(row.id || `${name}|${brand}|${root}|${sub}|${size}`)
      : pickField(row, headerIndex, ['id', 'product_id', 'sku', 'item_id']) || `${name}|${brand}|${root}|${sub}|${size}`;

    const baseSlug = slugify(`${brand}-${name}`);
    const slug = `${baseSlug}-${hash8(keyId).toLowerCase()}`;
    const SKU = `KGL-${hash8(keyId)}`;

    if (dryRun) continue;

    if (!rootCache.has(root)) {
      const rootDoc = await ensureCategory(root, 0, null, rootCache.size + 1);
      rootCache.set(root, rootDoc);
    }
    const rootDoc = rootCache.get(root);
    const subKey = `${rootDoc._id}:${sub}`;
    if (!subCache.has(subKey)) {
      const subDoc = await ensureCategory(sub, 1, rootDoc._id, subCache.size + 1);
      subCache.set(subKey, subDoc);
    }
    const subDoc = subCache.get(subKey);

    await Brand.updateOne(
      { slug: slugify(brand) },
      { $set: { name: brand, slug: slugify(brand), isActive: true } },
      { upsert: true }
    );

    const update = {
      name,
      slug,
      SKU,
      brand,
      categoryId: rootDoc._id,
      subCategoryId: subDoc._id,
      sellerId,
      variants: [
        {
          variantId: new mongoose.Types.ObjectId(),
          weight: size,
          price,
          MRP: mrp,
          stock,
          skuSuffix: `${SKU}-1`
        }
      ],
      rating,
      totalReviews,
      salesCount: 0,
      images: imageUrl ? [imageUrl] : [],
      description,
      tags: [brand, root, sub],
      isFeatured: false,
      isActive: true,
      adminApproved: true,
      adminReviewNote: 'Imported from Kaggle dataset'
    };

    const existing = await Product.findOne({ SKU }).select('_id').lean();
    if (existing) {
      await Product.updateOne({ _id: existing._id }, { $set: update });
      updated += 1;
    } else {
      await Product.create(update);
      created += 1;
    }
  }

  console.log(dryRun ? `Dry run complete. Rows parsed: ${rows.length}, skipped: ${skipped}` : `Import complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
};

(async () => {
  try {
    await connectDB();
    await run();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
})();
