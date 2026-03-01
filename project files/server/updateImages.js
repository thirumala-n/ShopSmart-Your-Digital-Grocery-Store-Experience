require('dotenv').config();
require('./config/db');

const Product = require('./models/Product');
const Category = require('./models/Category');

async function updateImages() {
  try {
    console.log('Connecting to database...');

    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    const products = await Product.find({}).populate('category', 'name');
    console.log(`Found ${products.length} products to update`);

    let updated = 0;
    for (const product of products) {
      const categoryName = product.category?.name || '';
      let imageUrl = '/images/placeholder-generic.svg';

      if (categoryName.toLowerCase().includes('frozen')) {
        imageUrl = '/images/placeholder-frozen.svg';
      } else if (categoryName.toLowerCase().includes('dairy')) {
        imageUrl = '/images/placeholder-dairy.svg';
      } else if (categoryName.toLowerCase().includes('beverages')) {
        imageUrl = '/images/placeholder-beverages.svg';
      }

      await Product.findByIdAndUpdate(product._id, {
        image: imageUrl,
        images: [imageUrl, imageUrl]
      });
      updated++;
    }

    console.log(`Successfully updated ${updated} products with local images`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating images:', error);
    process.exit(1);
  }
}

updateImages();