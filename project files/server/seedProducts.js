const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const Category = require('./models/Category');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const RESET_FLAG = process.argv.includes('--reset');

const CATEGORY_DATA = {
  Fruits: {
    description: 'Fresh seasonal fruits',
    perishable: true,
    variantProfile: [
      { weight: '500g', multiplier: 1 },
      { weight: '1kg', multiplier: 1.9 },
      { weight: '2kg', multiplier: 3.7 }
    ]
  },
  Vegetables: {
    description: 'Farm fresh vegetables',
    perishable: true,
    variantProfile: [
      { weight: '500g', multiplier: 1 },
      { weight: '1kg', multiplier: 1.85 },
      { weight: '2kg', multiplier: 3.5 }
    ]
  },
  Dairy: {
    description: 'Milk and dairy essentials',
    perishable: true,
    variantProfile: [
      { weight: '500ml', multiplier: 1 },
      { weight: '1L', multiplier: 1.9 },
      { weight: '2L', multiplier: 3.7 }
    ]
  },
  Bakery: {
    description: 'Fresh breads and bakery items',
    perishable: true,
    variantProfile: [
      { weight: '200g', multiplier: 1 },
      { weight: '400g', multiplier: 1.9 },
      { weight: '800g', multiplier: 3.6 }
    ]
  },
  Snacks: {
    description: 'Crispy and savory snacks',
    perishable: false,
    variantProfile: [
      { weight: '50g', multiplier: 1 },
      { weight: '100g', multiplier: 1.8 },
      { weight: '200g', multiplier: 3.4 }
    ]
  },
  Beverages: {
    description: 'Tea, coffee, juices and soft drinks',
    perishable: false,
    variantProfile: [
      { weight: '250ml', multiplier: 1 },
      { weight: '500ml', multiplier: 1.8 },
      { weight: '1L', multiplier: 3.3 }
    ]
  },
  Staples: {
    description: 'Grains, pulses, oils and daily staples',
    perishable: false,
    variantProfile: [
      { weight: '1kg', multiplier: 1 },
      { weight: '5kg', multiplier: 4.75 },
      { weight: '10kg', multiplier: 9.25 }
    ]
  },
  'Personal Care': {
    description: 'Personal care and hygiene essentials',
    perishable: false,
    variantProfile: [
      { weight: '100g', multiplier: 1 },
      { weight: '200g', multiplier: 1.85 },
      { weight: '400g', multiplier: 3.5 }
    ]
  },
  Household: {
    description: 'Home cleaning and utility products',
    perishable: false,
    variantProfile: [
      { weight: '500ml', multiplier: 1 },
      { weight: '1L', multiplier: 1.9 },
      { weight: '2L', multiplier: 3.7 }
    ]
  },
  'Frozen Foods': {
    description: 'Frozen and ready-to-cook food',
    perishable: false,
    frozen: true,
    variantProfile: [
      { weight: '400g', multiplier: 1 },
      { weight: '750g', multiplier: 1.8 },
      { weight: '1.2kg', multiplier: 2.8 }
    ]
  }
};

const PRODUCT_BLUEPRINTS = {
  Fruits: [
    { name: 'Alphonso Mangoes', brand: 'FreshKart', price: 249, organic: true, tags: ['mango', 'summer', 'premium'] },
    { name: 'Banana Robusta', brand: 'Fresho', price: 45, tags: ['banana', 'daily-fruit'] },
    { name: 'Washington Apples', brand: 'Farmley Fresh', price: 189, tags: ['apple', 'imported'] },
    { name: 'Pomegranate Premium', brand: 'Namdhari', price: 169, organic: true, tags: ['pomegranate', 'antioxidant'] },
    { name: 'Papaya Red Lady', brand: 'Fresho', price: 59, tags: ['papaya', 'ripe'] },
    { name: 'Guava Allahabadi', brand: 'GreenBasket', price: 79, organic: true, tags: ['guava', 'fiber-rich'] },
    { name: 'Kinnow Oranges', brand: 'FreshKart', price: 99, tags: ['orange', 'citrus'] },
    { name: 'Seedless Grapes Green', brand: 'Namdhari', price: 139, tags: ['grapes', 'seedless'] },
    { name: 'Tender Coconut', brand: 'CocoFarm', price: 69, tags: ['coconut', 'hydration'] },
    { name: 'Muskmelon Farm Fresh', brand: 'Fresho', price: 85, tags: ['melon', 'seasonal'] },
    { name: 'Dragon Fruit Premium', brand: 'Namdhari', price: 199, tags: ['dragon-fruit', 'premium'] },
    { name: 'Pineapple Queen', brand: 'FreshKart', price: 92, tags: ['pineapple', 'tropical'] }
  ],
  Vegetables: [
    { name: 'Onion Red', brand: 'Fresho', price: 39, tags: ['onion', 'kitchen-essential'] },
    { name: 'Tomato Hybrid', brand: 'Fresho', price: 34, tags: ['tomato', 'cooking'] },
    { name: 'Potato Fresh', brand: 'Fresho', price: 32, tags: ['potato', 'everyday'] },
    { name: 'Cauliflower', brand: 'GreenBasket', price: 59, tags: ['cauliflower', 'fresh'] },
    { name: 'Broccoli', brand: 'Namdhari', price: 129, organic: true, tags: ['broccoli', 'healthy'] },
    { name: 'Spinach Palak', brand: 'Fresho', price: 35, organic: true, tags: ['spinach', 'leafy'] },
    { name: 'Carrot Orange', brand: 'Fresho', price: 52, tags: ['carrot', 'salad'] },
    { name: 'Capsicum Green', brand: 'GreenBasket', price: 76, tags: ['capsicum', 'stir-fry'] },
    { name: 'Cucumber English', brand: 'Fresho', price: 49, tags: ['cucumber', 'salad'] },
    { name: 'Bottle Gourd Lauki', brand: 'Fresho', price: 44, tags: ['lauki', 'home-style'] },
    { name: 'Beetroot Fresh', brand: 'Fresho', price: 58, tags: ['beetroot', 'root-vegetable'] },
    { name: 'Mushroom Button', brand: 'Namdhari', price: 119, tags: ['mushroom', 'fresh'] }
  ],
  Dairy: [
    { name: 'Amul Gold Milk', brand: 'Amul', price: 36, tags: ['milk', 'full-cream'] },
    { name: 'Mother Dairy Toned Milk', brand: 'Mother Dairy', price: 32, tags: ['milk', 'toned'] },
    { name: 'Amul Masti Dahi', brand: 'Amul', price: 42, tags: ['curd', 'fresh'] },
    { name: 'Nestle A+ Curd', brand: 'Nestle', price: 55, tags: ['curd', 'probiotic'] },
    { name: 'Amul Butter Pasteurised', brand: 'Amul', price: 58, tags: ['butter', 'spread'] },
    { name: 'Britannia Cheese Slices', brand: 'Britannia', price: 120, tags: ['cheese', 'sandwich'] },
    { name: 'Amul Paneer Fresh', brand: 'Amul', price: 95, tags: ['paneer', 'protein'] },
    { name: 'Nestle Milkmaid Condensed Milk', brand: 'Nestle', price: 145, tags: ['condensed-milk', 'dessert'] },
    { name: 'Epigamia Greek Yogurt', brand: 'Epigamia', price: 85, tags: ['yogurt', 'high-protein'] },
    { name: 'Kwality Walls Vanilla Ice Cream', brand: 'Kwality Walls', price: 160, tags: ['ice-cream', 'dessert'] },
    { name: 'Amul Taaza Milk', brand: 'Amul', price: 30, tags: ['milk', 'taaza'] },
    { name: 'Nestle Everyday Dairy Whitener', brand: 'Nestle', price: 220, tags: ['dairy-whitener', 'tea-coffee'] }
  ],
  Bakery: [
    { name: 'Britannia Whole Wheat Bread', brand: 'Britannia', price: 45, tags: ['bread', 'wheat'] },
    { name: 'Harvest Gold White Bread', brand: 'Harvest Gold', price: 42, tags: ['bread', 'white-bread'] },
    { name: 'English Oven Brown Bread', brand: 'English Oven', price: 55, tags: ['bread', 'brown-bread'] },
    { name: 'Britannia Rusk', brand: 'Britannia', price: 60, tags: ['rusk', 'tea-time'] },
    { name: 'Modern Burger Buns', brand: 'Modern', price: 38, tags: ['buns', 'burger'] },
    { name: 'Britannia Pav', brand: 'Britannia', price: 34, tags: ['pav', 'snack'] },
    { name: "The Baker's Dozen Multigrain Loaf", brand: "The Baker's Dozen", price: 110, tags: ['multigrain', 'artisan'] },
    { name: 'Bonn Milk Bread', brand: 'Bonn', price: 48, tags: ['bread', 'milk-bread'] },
    { name: 'Britannia Cake Slices', brand: 'Britannia', price: 72, tags: ['cake', 'snacking'] },
    { name: 'Sunfeast Farmlite Digestive Biscuits', brand: 'Sunfeast', price: 68, tags: ['digestive', 'biscuit'] },
    { name: 'Britannia Fruit Cake', brand: 'Britannia', price: 85, tags: ['cake', 'fruit-cake'] },
    { name: 'English Oven Garlic Bread', brand: 'English Oven', price: 95, tags: ['garlic-bread', 'ready-to-toast'] }
  ],
  Snacks: [
    { name: "Lay's Magic Masala Chips", brand: "Lay's", price: 20, tags: ['chips', 'masala'] },
    { name: 'Kurkure Masala Munch', brand: 'Kurkure', price: 20, tags: ['namkeen', 'corn-snack'] },
    { name: 'Haldiram Aloo Bhujia', brand: 'Haldiram', price: 55, tags: ['bhujia', 'snack'] },
    { name: 'Bingo Mad Angles', brand: 'Bingo', price: 25, tags: ['chips', 'angles'] },
    { name: 'Too Yumm Veggie Sticks', brand: 'Too Yumm', price: 35, tags: ['veggie-snack', 'baked'] },
    { name: 'Balaji Wafers Salted', brand: 'Balaji', price: 30, tags: ['wafers', 'salted'] },
    { name: 'Uncle Chipps Spicy Treat', brand: 'Uncle Chipps', price: 25, tags: ['chips', 'spicy'] },
    { name: 'Parle Monaco', brand: 'Parle', price: 30, tags: ['cracker', 'tea-time'] },
    { name: 'Bikaji Bhujia', brand: 'Bikaji', price: 70, tags: ['bhujia', 'rajasthani'] },
    { name: 'Pringles Original', brand: 'Pringles', price: 120, tags: ['chips', 'imported'] },
    { name: 'Haldiram Moong Dal', brand: 'Haldiram', price: 85, tags: ['moong-dal', 'snack'] },
    { name: 'Too Yumm Foxnuts Pudina', brand: 'Too Yumm', price: 90, tags: ['makhana', 'roasted'] }
  ],
  Beverages: [
    { name: 'Tata Tea Gold', brand: 'Tata', price: 160, tags: ['tea', 'leaf-tea'] },
    { name: 'Red Label Tea', brand: 'Brooke Bond', price: 145, tags: ['tea', 'daily'] },
    { name: 'Nescafe Classic Coffee', brand: 'Nescafe', price: 180, tags: ['coffee', 'instant'] },
    { name: 'Bru Instant Coffee', brand: 'Bru', price: 165, tags: ['coffee', 'instant'] },
    { name: 'Real Mixed Fruit Juice', brand: 'Real', price: 110, tags: ['juice', 'tetra-pack'] },
    { name: 'Tropicana Orange Juice', brand: 'Tropicana', price: 125, tags: ['juice', 'orange'] },
    { name: 'Paper Boat Aamras', brand: 'Paper Boat', price: 40, tags: ['aamras', 'traditional'] },
    { name: 'Bisleri Mineral Water', brand: 'Bisleri', price: 20, tags: ['water', 'drinking-water'] },
    { name: 'Coca Cola Soft Drink', brand: 'Coca Cola', price: 40, tags: ['soft-drink', 'cola'] },
    { name: 'Sprite Lemon Drink', brand: 'Sprite', price: 40, tags: ['soft-drink', 'lemon'] },
    { name: 'Bournvita Health Drink', brand: 'Cadbury', price: 280, tags: ['health-drink', 'chocolate'] },
    { name: 'Horlicks Classic Malt', brand: 'Horlicks', price: 260, tags: ['health-drink', 'malt'] }
  ],
  Staples: [
    { name: 'Aashirvaad Atta', brand: 'Aashirvaad', price: 265, tags: ['atta', 'whole-wheat'] },
    { name: 'Fortune Chakki Fresh Atta', brand: 'Fortune', price: 250, tags: ['atta', 'chakki'] },
    { name: 'India Gate Basmati Rice', brand: 'India Gate', price: 340, tags: ['rice', 'basmati'] },
    { name: 'Daawat Rozana Rice', brand: 'Daawat', price: 290, tags: ['rice', 'daily-use'] },
    { name: 'Tata Sampann Toor Dal', brand: 'Tata Sampann', price: 175, tags: ['dal', 'toor'] },
    { name: 'Tata Sampann Chana Dal', brand: 'Tata Sampann', price: 135, tags: ['dal', 'chana'] },
    { name: 'Fortune Sunflower Oil', brand: 'Fortune', price: 185, tags: ['oil', 'sunflower'] },
    { name: 'Saffola Gold Oil', brand: 'Saffola', price: 230, tags: ['oil', 'blended'] },
    { name: 'Tata Salt Iodized', brand: 'Tata', price: 32, tags: ['salt', 'iodized'] },
    { name: 'Organic Tattva Rajma', brand: 'Organic Tattva', price: 220, organic: true, tags: ['rajma', 'organic'] },
    { name: 'Aashirvaad Select Sharbati Atta', brand: 'Aashirvaad', price: 390, tags: ['atta', 'premium'] },
    { name: 'Fortune Mustard Oil Kachi Ghani', brand: 'Fortune', price: 210, tags: ['oil', 'mustard'] }
  ],
  'Personal Care': [
    { name: 'Dove Cream Beauty Bathing Bar', brand: 'Dove', price: 45, tags: ['soap', 'beauty'] },
    { name: 'Lux Jasmine Soap', brand: 'Lux', price: 35, tags: ['soap', 'fragrance'] },
    { name: 'Pears Pure and Gentle Soap', brand: 'Pears', price: 55, tags: ['soap', 'glycerine'] },
    { name: 'Colgate Strong Teeth Toothpaste', brand: 'Colgate', price: 62, tags: ['toothpaste', 'oral-care'] },
    { name: 'Pepsodent Germicheck Toothpaste', brand: 'Pepsodent', price: 58, tags: ['toothpaste', 'oral-care'] },
    { name: 'Clinic Plus Shampoo', brand: 'Clinic Plus', price: 70, tags: ['shampoo', 'hair-care'] },
    { name: 'Head & Shoulders Cool Menthol Shampoo', brand: 'Head & Shoulders', price: 145, tags: ['shampoo', 'anti-dandruff'] },
    { name: 'Patanjali Aloe Vera Gel', brand: 'Patanjali', price: 95, organic: true, tags: ['aloe-vera', 'skin-care'] },
    { name: 'Nivea Body Lotion', brand: 'Nivea', price: 180, tags: ['lotion', 'moisturizer'] },
    { name: 'Dettol Handwash Liquid', brand: 'Dettol', price: 99, tags: ['handwash', 'hygiene'] },
    { name: 'Pears Body Wash', brand: 'Pears', price: 165, tags: ['body-wash', 'gentle-care'] },
    { name: 'Dabur Red Toothpaste', brand: 'Dabur', price: 88, tags: ['toothpaste', 'ayurvedic'] }
  ],
  Household: [
    { name: 'Surf Excel Easy Wash Detergent Powder', brand: 'Surf Excel', price: 210, tags: ['detergent', 'laundry'] },
    { name: 'Ariel Matic Liquid Detergent', brand: 'Ariel', price: 320, tags: ['detergent', 'front-load'] },
    { name: 'Vim Dishwash Bar', brand: 'Vim', price: 25, tags: ['dishwash', 'kitchen-cleaning'] },
    { name: 'Harpic Toilet Cleaner', brand: 'Harpic', price: 95, tags: ['toilet-cleaner', 'bathroom'] },
    { name: 'Lizol Floor Cleaner', brand: 'Lizol', price: 135, tags: ['floor-cleaner', 'disinfectant'] },
    { name: 'Colin Glass Cleaner', brand: 'Colin', price: 95, tags: ['glass-cleaner', 'housekeeping'] },
    { name: 'Good Knight Mosquito Refill', brand: 'Good Knight', price: 84, tags: ['mosquito', 'home-care'] },
    { name: 'Origami Toilet Tissue', brand: 'Origami', price: 120, tags: ['tissue', 'bathroom'] },
    { name: 'Scotch Brite Scrub Pad', brand: 'Scotch Brite', price: 45, tags: ['scrubber', 'kitchen'] },
    { name: 'Godrej Aer Room Freshener', brand: 'Godrej', price: 140, tags: ['freshener', 'air-care'] },
    { name: 'Gala Garbage Bags', brand: 'Gala', price: 110, tags: ['garbage-bags', 'home-utility'] },
    { name: 'Exo Dishwash Liquid', brand: 'Exo', price: 115, tags: ['dishwash', 'liquid-cleaner'] }
  ],
  'Frozen Foods': [
    { name: 'McCain French Fries', brand: 'McCain', price: 130, tags: ['frozen', 'fries'] },
    { name: 'Yummiez Chicken Nuggets', brand: 'Godrej Yummiez', price: 210, isVeg: false, tags: ['frozen', 'chicken'] },
    { name: 'Safal Green Peas Frozen', brand: 'Safal', price: 115, tags: ['frozen', 'peas'] },
    { name: 'Safal Sweet Corn Frozen', brand: 'Safal', price: 120, tags: ['frozen', 'sweet-corn'] },
    { name: 'ITC Master Chef Veg Burger Patty', brand: 'ITC Master Chef', price: 165, tags: ['frozen', 'burger-patty'] },
    { name: 'Godrej Yummiez Chicken Sausage', brand: 'Godrej Yummiez', price: 240, isVeg: false, tags: ['frozen', 'sausage'] },
    { name: 'Amul Frozen Green Peas', brand: 'Amul', price: 125, tags: ['frozen', 'peas'] },
    { name: 'Winkies Frozen Paratha', brand: 'Winkies', price: 180, tags: ['frozen', 'paratha'] },
    { name: 'Natureland Frozen Mixed Berries', brand: 'Natureland', price: 350, tags: ['frozen', 'berries'] },
    { name: "Venky's Chicken Seekh Kebab", brand: "Venky's", price: 280, isVeg: false, tags: ['frozen', 'kebab'] },
    { name: 'ITC Master Chef Chicken Momos', brand: 'ITC Master Chef', price: 299, isVeg: false, tags: ['frozen', 'momos'] },
    { name: 'McCain Smiles', brand: 'McCain', price: 170, tags: ['frozen', 'potato-snack'] }
  ]
};

const buildImageUrl = (categoryName) => {
  const category = String(categoryName || '').toLowerCase();
  if (category.includes('produce') || category.includes('fruits') || category.includes('vegetables')) {
    return '/images/placeholder-produce.svg';
  } else if (category.includes('dairy') || category.includes('milk') || category.includes('cheese')) {
    return '/images/placeholder-dairy.svg';
  } else if (category.includes('beverages') || category.includes('drinks')) {
    return '/images/placeholder-beverages.svg';
  } else if (category.includes('frozen')) {
    return '/images/placeholder-frozen.svg';
  } else {
    return '/images/placeholder-generic.svg';
  }
};

const getProductImages = (entry, categoryName, serial) => {
  // Use deterministic Unsplash source queries so every product gets its own image
  const query = encodeURIComponent(`${entry.name || ''} ${categoryName || ''}`.trim() || 'grocery product');
  const primary = `https://source.unsplash.com/600x600/?${query}&sig=${serial}`;
  const secondary = `https://source.unsplash.com/600x600/?${query}&sig=${serial + 1000}`;
  return [primary, secondary];
};

const getFutureDate = (seed, minDays, maxDays) => {
  const span = maxDays - minDays + 1;
  const days = minDays + (seed % span);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const getVariants = (categoryName, basePrice, seed) => {
  const profile = CATEGORY_DATA[categoryName].variantProfile;
  const count = 2 + (seed % 3);
  const selected = profile.slice(0, count);
  return selected.map((item, idx) => ({
    weight: item.weight,
    price: Math.max(20, Math.round(basePrice * item.multiplier)),
    stock: 20 + ((seed * 11 + idx * 7) % 180)
  }));
};

const buildSeedProducts = (categoryMap) => {
  const products = [];
  let serial = 0;

  for (const [categoryName, entries] of Object.entries(PRODUCT_BLUEPRINTS)) {
    const categoryConfig = CATEGORY_DATA[categoryName];
    const categoryId = categoryMap.get(categoryName);

    for (const entry of entries) {
      serial += 1;
      const discount = (serial * 3) % 26;
      const rating = Number((3.5 + ((serial * 13) % 14) / 10).toFixed(1));
      const sold = (serial * 67) % 2001;
      const views = Math.min(10000, sold * 3 + (serial * 17));
      const variants = getVariants(categoryName, entry.price, serial);
      const totalStock = variants.reduce((sum, item) => sum + item.stock, 0);
      const isPerishable = !!categoryConfig.perishable;
      const expiryDate = categoryConfig.frozen
        ? getFutureDate(serial, 90, 180)
        : isPerishable
          ? getFutureDate(serial, 3, 10)
          : getFutureDate(serial, 90, 365);
      const [image1, image2] = getProductImages(entry, categoryName, serial);
      const tags = Array.from(
        new Set([
          categoryName.toLowerCase().replace(/\s+/g, '-'),
          entry.brand.toLowerCase().replace(/\s+/g, '-'),
          ...(entry.tags || [])
        ])
      );

      products.push({
        name: entry.name,
        description: `${entry.name} by ${entry.brand}. Quality checked grocery item for daily household use.`,
        category: categoryId,
        brand: entry.brand,
        price: variants[0].price,
        discount,
        discountPercentage: discount,
        rating,
        ratingAverage: rating,
        stock: totalStock,
        variants,
        isPerishable,
        expiryDate,
        isVeg: entry.isVeg !== false,
        isOrganic: !!entry.organic,
        tags,
        images: [image1, image2],
        image: image1,
        sold,
        soldCount: sold,
        views,
        viewsCount: views,
        isAvailable: totalStock > 0,
        createdAt: new Date()
      });
    }
  }

  return products;
};

const ensureCategories = async () => {
  const categoryMap = new Map();
  for (const [name, config] of Object.entries(CATEGORY_DATA)) {
    const category = await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, description: config.description } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoryMap.set(name, category._id);
  }
  return categoryMap;
};

const seed = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(mongoUri);

  try {
    const categoryMap = await ensureCategories();
    const products = buildSeedProducts(categoryMap);

    if (RESET_FLAG) {
      await Product.deleteMany({});
    }

    const existing = await Product.find({ name: { $in: products.map((item) => item.name) } })
      .select('name')
      .lean();
    const existingNames = new Set(existing.map((item) => item.name));
    const toInsert = products.filter((item) => !existingNames.has(item.name));

    if (toInsert.length > 0) {
      await Product.insertMany(toInsert, { ordered: false });
    }

    process.stdout.write(
      `Seed complete. Inserted ${toInsert.length} product(s). Skipped ${products.length - toInsert.length} existing product(s).\n`
    );
  } finally {
    await mongoose.connection.close();
  }
};

seed().catch(async (error) => {
  process.stderr.write(`Seeding failed: ${error.message}\n`);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
