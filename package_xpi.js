/**
 * SafeSearch Firefox .xpi Packaging Script
 * 
 * Creates a valid, zero-dependency .xpi (ZIP) package from dist/firefox
 * with all extension files located directly at the root of the archive.
 * 
 * Usage: node package_xpi.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT_DIR = __dirname;
const DIST_FIREFOX_DIR = path.join(ROOT_DIR, 'dist', 'firefox');
const OUTPUT_XPI_ROOT = path.join(ROOT_DIR, 'safesearch-firefox.xpi');
const OUTPUT_ZIP_ROOT = path.join(ROOT_DIR, 'safesearch-firefox.zip');
const OUTPUT_XPI_DIST = path.join(ROOT_DIR, 'dist', 'safesearch-firefox.xpi');
const OUTPUT_ZIP_DIST = path.join(ROOT_DIR, 'dist', 'safesearch-firefox.zip');

// Precomputed CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
}

function calcCRC32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getAllFiles(dir, baseDir = dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, baseDir));
        } else if (entry.isFile()) {
            const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            results.push({ fullPath, relPath });
        }
    }
    return results;
}

function createXpi(sourceDir, outputPaths) {
    console.log(`📦 Packaging Firefox Extension from: ${sourceDir}`);

    if (!fs.existsSync(sourceDir)) {
        console.error(`❌ Error: Source directory does not exist: ${sourceDir}`);
        process.exit(1);
    }

    const files = getAllFiles(sourceDir);
    console.log(`Found ${files.length} files to package:\n`);

    const fileEntries = [];
    const localChunks = [];
    let currentOffset = 0;

    for (const file of files) {
        const uncompressedData = fs.readFileSync(file.fullPath);
        const crc = calcCRC32(uncompressedData);
        const nameBuf = Buffer.from(file.relPath, 'utf8');

        // Attempt Deflate compression
        const deflated = zlib.deflateRawSync(uncompressedData, { level: 9 });
        let method = 8; // Deflate
        let compressedData = deflated;

        // If deflation doesn't save space, store uncompressed
        if (deflated.length >= uncompressedData.length) {
            method = 0; // Store
            compressedData = uncompressedData;
        }

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
        localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
        localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
        localHeader.writeUInt16LE(method, 8);     // Compression method
        localHeader.writeUInt16LE(0, 10);         // Last mod file time
        localHeader.writeUInt16LE(0, 12);         // Last mod file date
        localHeader.writeUInt32LE(crc, 14);       // CRC-32
        localHeader.writeUInt32LE(compressedData.length, 18); // Compressed size
        localHeader.writeUInt32LE(uncompressedData.length, 22); // Uncompressed size
        localHeader.writeUInt16LE(nameBuf.length, 26); // File name length
        localHeader.writeUInt16LE(0, 28);         // Extra field length

        localChunks.push(localHeader, nameBuf, compressedData);

        fileEntries.push({
            relPath: file.relPath,
            nameBuf: nameBuf,
            crc: crc,
            method: method,
            compressedSize: compressedData.length,
            uncompressedSize: uncompressedData.length,
            localHeaderOffset: currentOffset
        });

        currentOffset += 30 + nameBuf.length + compressedData.length;
        console.log(`  + ${file.relPath} (${uncompressedData.length} bytes -> ${compressedData.length} bytes)`);
    }

    // Central Directory
    const centralChunks = [];
    const cdStartOffset = currentOffset;

    for (const entry of fileEntries) {
        const cdHeader = Buffer.alloc(46);
        cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
        cdHeader.writeUInt16LE(20, 4);         // Version made by
        cdHeader.writeUInt16LE(20, 6);         // Version needed to extract
        cdHeader.writeUInt16LE(0, 8);          // General purpose bit flag
        cdHeader.writeUInt16LE(entry.method, 10); // Compression method
        cdHeader.writeUInt16LE(0, 12);         // Last mod file time
        cdHeader.writeUInt16LE(0, 14);         // Last mod file date
        cdHeader.writeUInt32LE(entry.crc, 16); // CRC-32
        cdHeader.writeUInt32LE(entry.compressedSize, 20); // Compressed size
        cdHeader.writeUInt32LE(entry.uncompressedSize, 24); // Uncompressed size
        cdHeader.writeUInt16LE(entry.nameBuf.length, 28); // File name length
        cdHeader.writeUInt16LE(0, 30);         // Extra field length
        cdHeader.writeUInt16LE(0, 32);         // File comment length
        cdHeader.writeUInt16LE(0, 34);         // Disk number start
        cdHeader.writeUInt16LE(0, 36);         // Internal file attributes
        cdHeader.writeUInt32LE(0, 38);         // External file attributes
        cdHeader.writeUInt32LE(entry.localHeaderOffset, 42); // Relative offset of local header

        centralChunks.push(cdHeader, entry.nameBuf);
        currentOffset += 46 + entry.nameBuf.length;
    }

    const cdSize = currentOffset - cdStartOffset;

    // End of Central Directory Record
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);         // End of central directory signature
    eocd.writeUInt16LE(0, 4);                  // Number of this disk
    eocd.writeUInt16LE(0, 6);                  // Disk where central directory starts
    eocd.writeUInt16LE(fileEntries.length, 8); // Number of central directory records on this disk
    eocd.writeUInt16LE(fileEntries.length, 10);// Total number of central directory records
    eocd.writeUInt32LE(cdSize, 12);            // Size of central directory
    eocd.writeUInt32LE(cdStartOffset, 16);     // Offset of start of central directory
    eocd.writeUInt16LE(0, 20);                 // Comment length

    const finalBuffer = Buffer.concat([...localChunks, ...centralChunks, eocd]);

    for (const outPath of outputPaths) {
        const outDir = path.dirname(outPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, finalBuffer);
        console.log(`\n💾 Saved package to: ${outPath} (${finalBuffer.length} bytes)`);
    }

    console.log('\n🎉 Firefox .xpi packaging completed successfully!');
}

createXpi(DIST_FIREFOX_DIR, [OUTPUT_XPI_ROOT, OUTPUT_ZIP_ROOT, OUTPUT_XPI_DIST, OUTPUT_ZIP_DIST]);
