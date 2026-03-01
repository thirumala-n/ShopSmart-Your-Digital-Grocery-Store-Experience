/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const { connectDB, mongoose } = require('../src/config/db');
const env = require('../src/config/env');
const Category = require('../src/models/Category');
const Brand = require('../src/models/Brand');
const Product = require('../src/models/Product');
const User = require('../src/models/User');
const Coupon = require('../src/models/Coupon');
const Banner = require('../src/models/Banner');
const DeliverySlot = require('../src/models/DeliverySlot');

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const makeRng = (seed = 42) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const rng = makeRng(20260221);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

const ROOT_CATEGORIES = [
  'Fruits and Vegetables',
  'Dairy and Eggs',
  'Bakery',
  'Snacks and Beverages',
  'Staples and Grains',
  'Breakfast and Cereals',
  'Oils and Ghee',
  'Spices and Masalas',
  'Frozen Foods',
  'Meat and Seafood',
  'Personal Care',
  'Household Cleaning',
  'Baby Products',
  'Pet Supplies',
  'Health and Wellness'
];

const SUBS = {
  'Fruits and Vegetables': ['Fresh Fruits', 'Leafy Greens', 'Exotic Vegetables'],
  'Dairy and Eggs': ['Milk', 'Cheese and Butter', 'Eggs'],
  Bakery: ['Bread', 'Cakes', 'Cookies'],
  'Snacks and Beverages': ['Chips', 'Juices', 'Soft Drinks'],
  'Staples and Grains': ['Rice', 'Atta and Flour', 'Pulses'],
  'Breakfast and Cereals': ['Corn Flakes', 'Muesli', 'Oats'],
  'Oils and Ghee': ['Sunflower Oil', 'Mustard Oil', 'Cow Ghee'],
  'Spices and Masalas': ['Whole Spices', 'Ground Spices', 'Blended Masalas'],
  'Frozen Foods': ['Frozen Vegetables', 'Frozen Snacks', 'Ice Cream'],
  'Meat and Seafood': ['Chicken', 'Fish', 'Prawns'],
  'Personal Care': ['Skin Care', 'Hair Care', 'Oral Care'],
  'Household Cleaning': ['Detergents', 'Dishwash', 'Floor Cleaners'],
  'Baby Products': ['Baby Food', 'Diapers', 'Baby Skin Care'],
  'Pet Supplies': ['Dog Food', 'Cat Food', 'Pet Hygiene'],
  'Health and Wellness': ['Protein and Supplements', 'Herbal Products', 'Vitamins']
};

const BRANDS = [
  'Amul',
  'Nestle',
  'Britannia',
  'ITC',
  "Haldiram's",
  'Dabur',
  'Patanjali',
  'Tata',
  'Mother Dairy',
  'Parle',
  'Maaza',
  'Kissan',
  'Fortune',
  'Saffola',
  'Godrej',
  'Surf Excel',
  'Ariel',
  'Dove',
  'Colgate',
  'Pedigree',
  'Himalaya',
  'Borges',
  'Del Monte',
  'Yoga Bar',
  'Raw Pressery'
];

const WEIGHTS = ['250g', '500g', '1kg', '2kg', '5kg', '750ml', '1L', '2L', '12 pcs', '24 pcs'];

const PRODUCT_TOKENS = ['Premium', 'Fresh', 'Classic', 'Daily', 'Smart', 'Select', 'Farm', 'Natural', 'Gold', 'Value'];

const buildPrice = () => randInt(30, 1200);

const buildMrp = (price) => {
  const withDiscount = rng() < 0.3;
  if (!withDiscount) return price;
  const pct = randInt(5, 50);
  return Number((price / (1 - pct / 100)).toFixed(2));
};

const upsertAdminUsers = async () => {
  const passwordHash = await bcrypt.hash('admin123', env.bcryptSaltRounds);
  await User.updateOne(
    { email: 'admin@gmail.com' },
    {
      $set: {
        name: 'Admin',
        phone: '+15550000123',
        role: 'admin',
        accountStatus: 'ACTIVE',
        passwordHash
      }
    },
    { upsert: true }
  );
};

const upsertSellerUser = async () => {
  const passwordHash = await bcrypt.hash('Seller@12345', env.bcryptSaltRounds);
  await User.updateOne(
    { email: 'seller.test@grocery.local' },
    {
      $set: {
        name: 'Test Seller',
        phone: '+15550002000',
        role: 'seller',
        accountStatus: 'ACTIVE',
        passwordHash
      }
    },
    { upsert: true }
  );
};

const seedCategories = async () => {
  const rootMap = new Map();
  for (let i = 0; i < ROOT_CATEGORIES.length; i += 1) {
    const name = ROOT_CATEGORIES[i];
    const slug = slugify(name);
    const result = await Category.findOneAndUpdate(
      { slug },
      { $set: { name, slug, level: 0, parentCategoryId: null, displayOrder: i + 1, isActive: true } },
      { new: true, upsert: true }
    );
    rootMap.set(name, result);
  }

  for (const [rootName, subNames] of Object.entries(SUBS)) {
    const root = rootMap.get(rootName);
    for (let i = 0; i < subNames.length; i += 1) {
      const subName = subNames[i];
      const slug = `${slugify(rootName)}-${slugify(subName)}`;
      await Category.findOneAndUpdate(
        { slug },
        {
          $set: {
            name: subName,
            slug,
            level: 1,
            parentCategoryId: root._id,
            displayOrder: i + 1,
            isActive: true
          }
        },
        { new: true, upsert: true }
      );
    }
  }
};

const seedBrands = async () => {
  for (const name of BRANDS) {
    await Brand.updateOne(
      { slug: slugify(name) },
      {
        $set: {
          name,
          slug: slugify(name),
          logoUrl: `https://placehold.co/240x120?text=${encodeURIComponent(name)}`,
          isFeatured: rng() < 0.2,
          isActive: true
        }
      },
      { upsert: true }
    );
  }
};

const makeVariants = (skuPrefix) => {
  const count = randInt(2, 4);
  const selected = new Set();
  const variants = [];
  while (selected.size < count) selected.add(pick(WEIGHTS));
  for (const [index, weight] of [...selected].entries()) {
    const price = buildPrice();
    const MRP = buildMrp(price);
    variants.push({
      variantId: new mongoose.Types.ObjectId(),
      weight,
      price,
      MRP,
      stock: randInt(0, 500),
      skuSuffix: `${skuPrefix}-${index + 1}`
    });
  }
  return variants;
};

const seedProducts = async () => {
  const seller = await User.findOne({ role: 'seller', email: 'seller.test@grocery.local' }).select('_id').lean();
  const roots = await Category.find({ level: 0 }).lean();
  const subs = await Category.find({ level: 1 }).lean();
  const subByParent = new Map();
  for (const sub of subs) {
    const key = String(sub.parentCategoryId);
    if (!subByParent.has(key)) subByParent.set(key, []);
    subByParent.get(key).push(sub);
  }

  const target = 1000;
  for (let i = 1; i <= target; i += 1) {
    const root = roots[(i - 1) % roots.length];
    const sub = pick(subByParent.get(String(root._id)));
    const brand = BRANDS[(i - 1) % BRANDS.length];
    const token = PRODUCT_TOKENS[(i - 1) % PRODUCT_TOKENS.length];
    const name = `${brand} ${token} ${sub.name} ${i}`;
    const slug = slugify(name);
    const SKU = `SKU-${String(i).padStart(5, '0')}`;
    const variants = makeVariants(SKU);

    await Product.updateOne(
      { slug },
      {
        $set: {
          name,
          slug,
          SKU,
          brand,
          categoryId: root._id,
          subCategoryId: sub._id,
          sellerId: seller._id,
          variants,
          rating: Number((3 + rng() * 2).toFixed(1)),
          totalReviews: randInt(0, 2000),
          salesCount: randInt(0, 10000),
          images: [
            `https://placehold.co/800x800?text=${encodeURIComponent(name)}`,
            `https://placehold.co/800x800?text=${encodeURIComponent(`${name} 2`)}`
          ],
          description: `High quality ${sub.name.toLowerCase()} from ${brand}, packed for freshness and daily use.`,
          tags: [brand, sub.name, root.name],
          isFeatured: rng() < 0.15,
          isActive: true,
          adminApproved: true,
          lowStockThreshold: 10
        }
      },
      { upsert: true }
    );
  }
};

const seedCoupons = async () => {
  const now = new Date();
  const validFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const coupons = [
    { code: 'SAVE50', discountType: 'FLAT', discountValue: 50, minOrderValue: 499 },
    { code: 'SAVE100', discountType: 'FLAT', discountValue: 100, minOrderValue: 899 },
    { code: 'NEWUSER15', discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 150, minOrderValue: 499, segment: 'NEW_USERS' },
    { code: 'BASKET10', discountType: 'PERCENTAGE', discountValue: 10, maxDiscount: 300, minOrderValue: 999 },
    { code: 'FRESH20', discountType: 'PERCENTAGE', discountValue: 20, maxDiscount: 200, minOrderValue: 699 },
    { code: 'WEEKEND5', discountType: 'PERCENTAGE', discountValue: 5, maxDiscount: 100, minOrderValue: 299 },
    { code: 'GROCERY75', discountType: 'FLAT', discountValue: 75, minOrderValue: 699 },
    { code: 'HEALTH12', discountType: 'PERCENTAGE', discountValue: 12, maxDiscount: 180, minOrderValue: 599 },
    { code: 'BRAND25', discountType: 'PERCENTAGE', discountValue: 25, maxDiscount: 250, minOrderValue: 1199 },
    { code: 'DAILY30', discountType: 'FLAT', discountValue: 30, minOrderValue: 349 }
  ];

  for (const item of coupons) {
    await Coupon.updateOne(
      { code: item.code },
      {
        $set: {
          code: item.code,
          discountType: item.discountType,
          discountValue: item.discountValue,
          maxDiscount: item.maxDiscount || 0,
          minOrderValue: item.minOrderValue,
          totalUsageLimit: 10000,
          perUserLimit: 2,
          validFrom,
          expiryDate,
          applicableCategories: [],
          applicableUserSegment: item.segment || 'ALL',
          specificUserIds: [],
          isActive: true
        }
      },
      { upsert: true }
    );
  }
};

const seedBanners = async () => {
  const now = new Date();
  const banners = [
    ['Fresh Harvest Festival', 'Farm-fresh picks delivered in minutes', 'Shop Fresh'],
    ['Mega Grocery Savings', 'Flat discounts across everyday essentials', 'View Deals'],
    ['Healthy Living Sale', 'Boost wellness with curated nutrition picks', 'Explore Now'],
    ['Family Value Packs', 'Stock up and save on bulk packs', 'Buy Bundles'],
    ['Weekend Party Specials', 'Snacks, beverages and desserts at big discounts', 'Order Today']
  ];

  for (let i = 0; i < banners.length; i += 1) {
    const [title, subtitle, ctaText] = banners[i];
    await Banner.updateOne(
      { title },
      {
        $set: {
          title,
          subtitle,
          imageUrl: `https://placehold.co/1600x450?text=${encodeURIComponent(title)}`,
          ctaText,
          ctaLink: '/offers',
          displayOrder: i + 1,
          isActive: true,
          validFrom: now,
          validTo: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)
        }
      },
      { upsert: true }
    );
  }
};

const seedDeliverySlots = async () => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const windows = ['9am-1pm', '2pm-6pm'];
  for (let d = 0; d < 7; d += 1) {
    const date = new Date(base);
    date.setDate(date.getDate() + d);
    for (const timeWindow of windows) {
      await DeliverySlot.updateOne(
        { date, timeWindow },
        { $set: { date, timeWindow, capacity: 50, booked: 0, isActive: true } },
        { upsert: true }
      );
    }
  }
};

const run = async () => {
  await connectDB();
  await seedCategories();
  await seedBrands();
  await upsertAdminUsers();
  await upsertSellerUser();
  await seedProducts();
  await seedCoupons();
  await seedBanners();
  await seedDeliverySlots();
  console.log('Marketplace seed completed successfully');
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Marketplace seed failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
