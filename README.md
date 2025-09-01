# CATE - Image Compressor Tool

A Node.js CLI tool for compressing images to a target size (100KB) while maintaining quality. CATE processes WebP, PNG, and TIFF images, automatically skipping JPG/JPEG files.

## Features

- 🎯 Compresses images to a target size of 100KB
- 📐 Resize images with optional width/height parameters
- 🖼️ Supports WebP, PNG, and TIFF formats (excludes JPG/JPEG)
- 📁 Input/Output directory structure for organized processing
- 🔄 Automatic format conversion
- 📊 Progress tracking and statistics

## Prerequisites

- Node.js (version 12 or higher)
- npm (comes with Node.js)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/cate.git
   cd cate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Place your images in the `input` directory
2. Run the compression tool:
   ```bash
   node compress.js
   ```

### Options

You can customize the compression with the following command-line arguments:

- `w=<width>` - Set target width (e.g., `w=800`)
- `h=<height>` - Set target height (e.g., `h=600`)
- `t=<format>` - Convert to target format (e.g., `t=webp`)

Examples:
```bash
# Compress with default settings
node compress.js

# Resize to specific width
node compress.js w=1024

# Resize to specific height
node compress.js h=768

# Resize to exact dimensions
node compress.js w=1024 h=768

# Convert to WebP format
node compress.js t=webp

# Resize and convert format
node compress.js w=800 t=png
```

### How It Works

1. The tool scans the `input` directory for supported image files
2. Images already under 100KB are skipped unless resize/format conversion is requested
3. For each image over 100KB:
   - Estimates required compression quality based on current file size
   - Resizes if specified dimensions are provided
   - Compresses the image with adaptive quality reduction
   - Saves compressed images to the `output` directory

## Directory Structure

```
cate/
├── input/     # Place images to compress here
├── output/    # Compressed images will be saved here
├── compress.js
└── package.json
```

## Technical Details

- Uses the [sharp](https://github.com/lovell/sharp) library for image processing
- Implements adaptive quality compression based on target size ratio
- Supports multiple compression attempts with decreasing quality if needed
- Maintains aspect ratio when resizing with single dimension parameters

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the [sharp](https://github.com/lovell/sharp) library for excellent image processing capabilities