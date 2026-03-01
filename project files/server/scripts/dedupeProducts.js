/* eslint-disable no-console */
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/grocerydb';

async function run() {
  await mongoose.connect(MONGO_URI);
  const products = mongoose.connection.collection('products');

  const duplicateGroups = await products
    .aggregate([
      {
        $project: {
          _id: 1,
          name: 1,
          norm: { $toLower: { $trim: { input: '$name' } } }
        }
      },
      { $match: { norm: { $ne: '' } } },
      {
        $group: {
          _id: '$norm',
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ])
    .toArray();

  let deleted = 0;
  for (const group of duplicateGroups) {
    const idsToDelete = group.ids.slice(1);
    if (!idsToDelete.length) continue;
    const result = await products.deleteMany({ _id: { $in: idsToDelete } });
    deleted += result.deletedCount;
  }

  console.log(
    JSON.stringify({
      duplicateGroups: duplicateGroups.length,
      deleted
    })
  );
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

