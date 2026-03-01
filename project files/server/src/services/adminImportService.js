const catalogAdminService = require('./catalogAdminService');
const importJobRepository = require('../repositories/importJobRepository');
const userRepository = require('../repositories/userRepository');
const { sendEmail } = require('./emailService');

const PRODUCT_CSV_TEMPLATE_HEADERS = [
  'name',
  'slug',
  'SKU',
  'brand',
  'categoryId',
  'subCategoryId',
  'description',
  'weight',
  'price',
  'MRP',
  'stock',
  'isActive',
  'isFeatured',
  'sellerId'
];

const STOCK_CSV_TEMPLATE_HEADERS = ['productId', 'variantId', 'stock'];

const parseCsv = (csvContent) => {
  const lines = String(csvContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((entry) => entry.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((entry) => entry.trim()));
  return { headers, rows };
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
};

const processProductCsvImport = async ({ jobId, csvContent, actor }) => {
  const job = await importJobRepository.findById(jobId);
  if (!job) return;

  job.status = 'RUNNING';
  job.startedAt = new Date();
  await importJobRepository.save(job);

  try {
    const parsed = parseCsv(csvContent);
    const { headers, rows } = parsed;
    const normalizedHeaders = headers.map((header) => header.trim());
    job.totalRows = rows.length;
    await importJobRepository.save(job);

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      try {
        const values = {};
        normalizedHeaders.forEach((header, headerIndex) => {
          values[header] = row[headerIndex];
        });

        if (
          !values.name ||
          !values.slug ||
          !values.SKU ||
          !values.brand ||
          !values.categoryId ||
          !values.subCategoryId ||
          !values.weight
        ) {
          throw new Error('Missing required columns');
        }

        const price = Number(values.price);
        const mrp = Number(values.MRP);
        const stock = Number(values.stock);
        if (!Number.isFinite(price) || !Number.isFinite(mrp) || !Number.isFinite(stock)) {
          throw new Error('Invalid numeric fields');
        }

        const payload = {
          name: values.name,
          slug: values.slug,
          SKU: values.SKU,
          brand: values.brand,
          categoryId: values.categoryId,
          subCategoryId: values.subCategoryId,
          sellerId: values.sellerId || actor.userId,
          description: values.description || '',
          isActive: parseBoolean(values.isActive, true),
          isFeatured: parseBoolean(values.isFeatured, false),
          images: ['https://placehold.co/800x800?text=Product'],
          tags: [values.brand],
          variants: [
            {
              weight: values.weight,
              price,
              MRP: mrp,
              stock,
              skuSuffix: `${values.SKU}-1`
            }
          ]
        };
        await catalogAdminService.upsertProduct(payload, actor);
        job.successRows += 1;
      } catch (error) {
        job.failedRows += 1;
        job.failureReport.push({ rowNumber, reason: error.message || 'Import failed' });
      } finally {
        job.processedRows += 1;
        if (job.processedRows % 10 === 0 || job.processedRows === job.totalRows) {
          await importJobRepository.save(job);
        }
      }
    }

    job.status = 'COMPLETED';
    job.completedAt = new Date();
    await importJobRepository.save(job);
  } catch (error) {
    job.status = 'FAILED';
    job.errorMessage = error.message || 'Import failed';
    job.completedAt = new Date();
    await importJobRepository.save(job);
  }

  const user = await userRepository.findById(actor.userId);
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: `Product CSV import ${job.status.toLowerCase()}`,
      text: `Import job ${job._id} finished with status ${job.status}. Success: ${job.successRows}, Failed: ${job.failedRows}.`
    });
  }
  const finalDoc = await importJobRepository.findById(job._id);
  if (finalDoc) {
    finalDoc.notificationSent = true;
    await importJobRepository.save(finalDoc);
  }
};

const createProductCsvImportJob = async ({ csvContent, actor }) => {
  const job = await importJobRepository.createJob({
    jobType: 'PRODUCT_CSV',
    status: 'PENDING',
    createdBy: actor.userId
  });
  setImmediate(() => {
    processProductCsvImport({ jobId: job._id, csvContent, actor }).catch(() => {});
  });
  return job;
};

const processStockCsvImport = async ({ jobId, csvContent, actor }) => {
  const job = await importJobRepository.findById(jobId);
  if (!job) return;

  job.status = 'RUNNING';
  job.startedAt = new Date();
  await importJobRepository.save(job);

  try {
    const parsed = parseCsv(csvContent);
    const { headers, rows } = parsed;
    const normalizedHeaders = headers.map((header) => header.trim());
    job.totalRows = rows.length;
    await importJobRepository.save(job);

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      try {
        const values = {};
        normalizedHeaders.forEach((header, headerIndex) => {
          values[header] = row[headerIndex];
        });
        if (!values.productId || !values.variantId) {
          throw new Error('Missing productId/variantId');
        }
        const stock = Number(values.stock);
        if (!Number.isFinite(stock) || stock < 0) throw new Error('Invalid stock');
        await catalogAdminService.updateVariantStock({
          productId: values.productId,
          variantId: values.variantId,
          stock,
          performedBy: actor.userId,
          reason: 'ADMIN_BULK_STOCK_UPLOAD'
        });
        job.successRows += 1;
      } catch (error) {
        job.failedRows += 1;
        job.failureReport.push({ rowNumber, reason: error.message || 'Import failed' });
      } finally {
        job.processedRows += 1;
        if (job.processedRows % 10 === 0 || job.processedRows === job.totalRows) {
          await importJobRepository.save(job);
        }
      }
    }
    job.status = 'COMPLETED';
    job.completedAt = new Date();
    await importJobRepository.save(job);
  } catch (error) {
    job.status = 'FAILED';
    job.errorMessage = error.message || 'Import failed';
    job.completedAt = new Date();
    await importJobRepository.save(job);
  }

  const user = await userRepository.findById(actor.userId);
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: `Stock CSV import ${job.status.toLowerCase()}`,
      text: `Import job ${job._id} finished with status ${job.status}. Success: ${job.successRows}, Failed: ${job.failedRows}.`
    });
  }
  const finalDoc = await importJobRepository.findById(job._id);
  if (finalDoc) {
    finalDoc.notificationSent = true;
    await importJobRepository.save(finalDoc);
  }
};

const createStockCsvImportJob = async ({ csvContent, actor }) => {
  const job = await importJobRepository.createJob({
    jobType: 'STOCK_CSV',
    status: 'PENDING',
    createdBy: actor.userId
  });
  setImmediate(() => {
    processStockCsvImport({ jobId: job._id, csvContent, actor }).catch(() => {});
  });
  return job;
};

const getImportJobStatus = (jobId) => importJobRepository.findByIdLean(jobId);

const getProductCsvTemplate = () => `${PRODUCT_CSV_TEMPLATE_HEADERS.join(',')}\n`;
const getStockCsvTemplate = () => `${STOCK_CSV_TEMPLATE_HEADERS.join(',')}\n`;

module.exports = {
  createProductCsvImportJob,
  createStockCsvImportJob,
  getImportJobStatus,
  getProductCsvTemplate,
  getStockCsvTemplate
};
