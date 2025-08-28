const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Target size in bytes (0.1MB = 100KB)
const TARGET_SIZE = 100 * 1024;

// Default maximum dimensions (width or height) - set to 0 to disable resizing
let MAX_DIMENSION = 1920;

// Parse command line arguments for width, height, and target format
const args = process.argv.slice(2);
let targetWidth = null;
let targetHeight = null;
let targetFormat = null;

args.forEach(arg => {
  if (arg.startsWith('w=')) {
    targetWidth = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('h=')) {
    targetHeight = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('t=')) {
    targetFormat = arg.split('=')[1].toLowerCase();
  }
});

// If specific width/height provided, use those instead of MAX_DIMENSION
if (targetWidth || targetHeight) {
  MAX_DIMENSION = 0; // Disable MAX_DIMENSION when specific dimensions provided
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error reading file size for ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Get image dimensions
 */
async function getImageDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error(`Error reading image dimensions for ${filePath}:`, error.message);
    return { width: 0, height: 0 };
  }
}

/**
 * Estimate quality based on compression ratio needed
 */
function estimateQuality(sizeRatio) {
  // Size ratio is target_size / original_size
  // Higher ratio = less compression needed = higher quality

  if (sizeRatio >= 0.8) {
    return Math.round(85 + (sizeRatio - 0.8) * 50); // 85-95%
  } else if (sizeRatio >= 0.5) {
    return Math.round(70 + (sizeRatio - 0.5) * 50); // 70-85%
  } else if (sizeRatio >= 0.3) {
    return Math.round(50 + (sizeRatio - 0.3) * 100); // 50-70%
  } else {
    return Math.round(30 + sizeRatio * 66.7); // 30-50%
  }
}

/**
 * Compress image with estimated quality based on size ratio
 */
async function compressWithRatio(filePath, originalSize) {
  try {
    // Get original dimensions
    const originalDimensions = await getImageDimensions(filePath);
    console.log(`  Original dimensions: ${originalDimensions.width}x${originalDimensions.height}`);
    
    const sizeRatio = TARGET_SIZE / originalSize;
    let estimatedQuality = estimateQuality(sizeRatio);

    // Ensure quality is within valid range
    estimatedQuality = Math.max(10, Math.min(95, estimatedQuality));

    console.log(`  Estimated quality: ${estimatedQuality}% (ratio: ${sizeRatio.toFixed(3)})`);

    // Create sharp instance
    let sharpInstance = sharp(filePath);
    
    // Resize if specific dimensions provided
    let willResize = false;
    if (targetWidth || targetHeight) {
      // If only one dimension provided, calculate the other to maintain aspect ratio
      let resizeOptions = {};
      
      if (targetWidth && targetHeight) {
        // Both dimensions provided
        resizeOptions.width = targetWidth;
        resizeOptions.height = targetHeight;
        resizeOptions.fit = 'fill'; // This will stretch to fill, you might want 'inside' instead
      } else if (targetWidth) {
        // Only width provided
        resizeOptions.width = targetWidth;
        resizeOptions.fit = 'inside';
        resizeOptions.withoutEnlargement = true;
      } else if (targetHeight) {
        // Only height provided
        resizeOptions.height = targetHeight;
        resizeOptions.fit = 'inside';
        resizeOptions.withoutEnlargement = true;
      }
      
      sharpInstance = sharpInstance.resize(resizeOptions);
      willResize = true;
    } else if (MAX_DIMENSION > 0) {
      // Use MAX_DIMENSION if no specific dimensions provided
      sharpInstance = sharpInstance.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      });
      willResize = true;
    }
    
    // Determine output format and options
    let formatOptions = { quality: estimatedQuality };
    let outputFormat = 'jpeg'; // Default format
    
    if (targetFormat) {
      outputFormat = targetFormat;
    }
    
    // Special handling for different formats
    if (outputFormat === 'png') {
      // PNG doesn't use quality parameter
      formatOptions = { compressionLevel: Math.floor((100 - estimatedQuality) / 10) };
    }
    
    // First attempt with estimated quality
    let compressedBuffer;
    switch (outputFormat) {
      case 'png':
        compressedBuffer = await sharpInstance.png(formatOptions).toBuffer();
        break;
      case 'webp':
        compressedBuffer = await sharpInstance.webp(formatOptions).toBuffer();
        break;
      case 'tiff':
        compressedBuffer = await sharpInstance.tiff(formatOptions).toBuffer();
        break;
      default: // jpeg
        compressedBuffer = await sharpInstance.jpeg(formatOptions).toBuffer();
    }

    // Fine-tune if needed - be more aggressive with quality reduction
    let attempts = 0;
    let quality = estimatedQuality;
    let formatOpts = { ...formatOptions };

    while (compressedBuffer.length > TARGET_SIZE && quality > 10 && attempts < 5) {
      quality -= 10; // More aggressive reduction
      // Create new sharp instance for each attempt
      sharpInstance = sharp(filePath);
      
      // Apply resize if needed
      if (targetWidth || targetHeight) {
        let resizeOptions = {};
        
        if (targetWidth && targetHeight) {
          resizeOptions.width = targetWidth;
          resizeOptions.height = targetHeight;
          resizeOptions.fit = 'fill';
        } else if (targetWidth) {
          resizeOptions.width = targetWidth;
          resizeOptions.fit = 'inside';
          resizeOptions.withoutEnlargement = true;
        } else if (targetHeight) {
          resizeOptions.height = targetHeight;
          resizeOptions.fit = 'inside';
          resizeOptions.withoutEnlargement = true;
        }
        
        sharpInstance = sharpInstance.resize(resizeOptions);
      } else if (MAX_DIMENSION > 0) {
        sharpInstance = sharpInstance.resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Update format options
      if (outputFormat === 'png') {
        formatOpts = { compressionLevel: Math.floor((100 - quality) / 10) };
      } else {
        formatOpts = { quality: quality };
      }
      
      // Compress with updated options
      switch (outputFormat) {
        case 'png':
          compressedBuffer = await sharpInstance.png(formatOpts).toBuffer();
          break;
        case 'webp':
          compressedBuffer = await sharpInstance.webp(formatOpts).toBuffer();
          break;
        case 'tiff':
          compressedBuffer = await sharpInstance.tiff(formatOpts).toBuffer();
          break;
        default: // jpeg
          compressedBuffer = await sharpInstance.jpeg(formatOpts).toBuffer();
      }
      
      attempts++;
      console.log(`  Attempt ${attempts + 1}: quality ${quality}%, size ${formatSize(compressedBuffer.length)}`);
    }

    // If still too large but we hit minimum quality, just use what we have
    if (compressedBuffer.length > TARGET_SIZE) {
      console.log(`  Warning: Could not compress below target size with quality ${quality}%`);
    }
    
    // Show new dimensions if resized
    if (willResize) {
      const newMetadata = await sharp(compressedBuffer).metadata();
      console.log(`  New dimensions: ${newMetadata.width}x${newMetadata.height}`);
    }

    // Determine new file path with correct extension
    let newFilePath = filePath;
    if (targetFormat) {
      const ext = path.extname(filePath);
      newFilePath = filePath.slice(0, -ext.length) + '.' + targetFormat;
    }

    // Write the compressed image to the new file path
    fs.writeFileSync(newFilePath, compressedBuffer);

    // If format changed, delete the original file
    if (filePath !== newFilePath) {
      fs.unlinkSync(filePath);
    }

    return compressedBuffer.length;
  } catch (error) {
    console.error(`  Error compressing ${filePath}:`, error.message);
    return originalSize;
  }
}

/**
 * Format bytes to KB for display
 */
function formatSize(bytes) {
  return (bytes / 1024).toFixed(1) + "KB";
}

/**
 * Main compression function
 */
async function compressImages() {
  try {
    console.log("🖼️  Image Compressor Tool");
    console.log("📁 Scanning current directory for supported image files (webp, png, tiff)...");

    // Show resize info
    if (targetWidth || targetHeight) {
      if (targetWidth && targetHeight) {
        console.log(`📏 Resize enabled: Images will be resized to exactly ${targetWidth}x${targetHeight}px\n`);
      } else if (targetWidth) {
        console.log(`📏 Resize enabled: Images will be scaled to width ${targetWidth}px (height adjusted to maintain aspect ratio)\n`);
      } else if (targetHeight) {
        console.log(`📏 Resize enabled: Images will be scaled to height ${targetHeight}px (width adjusted to maintain aspect ratio)\n`);
      }
    } else if (MAX_DIMENSION > 0) {
      console.log(`📏 Resize enabled: Images will be scaled to max ${MAX_DIMENSION}px on the longest side\n`);
    } else {
      console.log("📏 Resize disabled: Images will maintain their original dimensions\n");
    }

    // Read current directory
    const files = fs.readdirSync(".");

    // Filter image files (excluding jpg/jpeg as requested)
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      // Support webp and other formats but exclude jpg/jpeg
      return ext === ".webp" || ext === ".png" || ext === ".tiff" || ext === ".tif";
    });

    if (imageFiles.length === 0) {
      console.log("❌ No supported image files found in current directory");
      return;
    }

    console.log(`📋 Found ${imageFiles.length} supported image files`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const file of imageFiles) {
      const originalSize = getFileSize(file);

      if (originalSize === 0) {
        console.log(`❌ Skipping ${file} - could not read file size`);
        continue;
      }

      // Check if we should process this file:
      // 1. If it's over the target size, always process
      // 2. If a target format is specified and differs from current format, process
      // 3. If specific dimensions are provided, process
      // 4. If MAX_DIMENSION is set, process
      const ext = path.extname(file).toLowerCase().slice(1); // Remove the dot
      const needsFormatConversion = targetFormat && targetFormat !== ext;
      const needsResize = targetWidth || targetHeight || MAX_DIMENSION > 0;
      
      if (originalSize <= TARGET_SIZE && !needsFormatConversion && !needsResize) {
        console.log(`⏭️  Skipping ${file} (${formatSize(originalSize)}) - already under 100KB and no resize/format conversion needed`);
        skippedCount++;
        continue;
      }

      console.log(`🔄 Processing ${file} (${formatSize(originalSize)})...`);

      const newSize = await compressWithRatio(file, originalSize);

      if (newSize < originalSize) {
        const savedSize = originalSize - newSize;
        const savedPercent = ((savedSize / originalSize) * 100).toFixed(1);
        console.log(`✅ Compressed to ${formatSize(newSize)} (saved ${formatSize(savedSize)}, ${savedPercent}%)\n`);
        processedCount++;
      } else {
        console.log(`❌ Failed to compress ${file}\n`);
      }
    }

    console.log("🎉 Compression complete!");
    console.log(`📊 Summary: ${processedCount} files compressed, ${skippedCount} files skipped`);
  } catch (error) {
    console.error("❌ Error during compression:", error.message);
  }
}

// Run the compression tool
compressImages();