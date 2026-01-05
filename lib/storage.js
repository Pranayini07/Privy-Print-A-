import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// Determine if running on Vercel or local
const IS_VERCEL = process.env.VERCEL === '1';

// Use /tmp for serverless environments (read-only filesystem otherwise)
// Note: /tmp is ephemeral and not shared across lambdas consistently, but works for simple demos
const BASE_DIR = IS_VERCEL ? os.tmpdir() : process.cwd();

const DATA_DIR = IS_VERCEL ? path.join(BASE_DIR, 'privy_data') : path.join(BASE_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ documents: [] }, null, 2));

function readDb() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            // Re-init if missing (ephemeral storage lost)
            fs.writeFileSync(DB_FILE, JSON.stringify({ documents: [] }, null, 2));
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { documents: [] };
    }
}

function writeDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Legacy function for backward compatibility
export function saveDocument(file, metadata) {
    return saveDocuments([file], metadata);
}

// New function to save multiple files with one code
export function saveDocuments(files, metadata) {
    const code = generateCode();
    const db = readDb();
    const uploadedAt = Date.now();
    const expiresAt = Date.now() + (metadata.duration * 60 * 1000);

    const fileRecords = [];

    // Process each file
    files.forEach((file, index) => {
        // Extension
        const ext = path.extname(file.originalFilename || file.name);
        // Use code-index format to ensure unique filenames
        const filename = `${code}-${index}${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);

        // Copy/Move file to uploads dir
        const sourcePath = file.filepath || file.path;

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source file not found: ${sourcePath}`);
        }

        fs.copyFileSync(sourcePath, filepath);

        // Verify file was copied successfully
        if (!fs.existsSync(filepath)) {
            throw new Error(`Failed to save file: ${filepath}`);
        }

        // Clean up temp file if needed
        try { fs.unlinkSync(sourcePath); } catch (e) {
            // Ignore errors when cleaning up temp file
        }

        fileRecords.push({
            filename, // stored filename
            originalName: file.originalFilename || file.name,
            mimeType: file.mimetype || file.type,
            index
        });
    });

    const doc = {
        code,
        files: fileRecords,
        uploadedAt,
        expiresAt,
        status: 'active'
    };

    db.documents.push(doc);
    writeDb(db);

    return doc;
}

export function getDocument(code, fileIndex = null) {
    const db = readDb();
    const doc = db.documents.find(d => d.code === code);

    if (!doc) return null;

    // Check expiry
    if (Date.now() > doc.expiresAt) {
        doc.status = 'expired';
        writeDb(db);
        return null;
    }

    // Handle legacy single-file documents
    if (doc.filename && !doc.files) {
        return {
            ...doc,
            files: [{
                filename: doc.filename,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                index: 0
            }],
            fullPath: path.join(UPLOADS_DIR, doc.filename),
            fileIndex: 0
        };
    }

    // Handle multi-file documents
    if (doc.files && doc.files.length > 0) {
        // If fileIndex specified, return specific file
        if (fileIndex !== null && fileIndex >= 0 && fileIndex < doc.files.length) {
            const file = doc.files[fileIndex];
            const fullPath = path.join(UPLOADS_DIR, file.filename);

            // Verify file exists before returning
            if (!fs.existsSync(fullPath)) {
                console.error(`File not found: ${fullPath} for code ${code}, fileIndex ${fileIndex}`);
                return null;
            }

            return {
                ...doc,
                file: {
                    ...file,
                    fullPath: fullPath
                },
                fullPath: fullPath,
                fileIndex: fileIndex
            };
        }

        // Return all files info
        return {
            ...doc,
            files: doc.files.map(f => ({
                ...f,
                fullPath: path.join(UPLOADS_DIR, f.filename)
            }))
        };
    }

    return null;
}

export function generateCode() {
    // Generate 6 digit random number
    // Ensure uniqueness could be added but for hackathon collision is low
    return crypto.randomInt(100000, 999999).toString();
}

export function cleanupExpired() {
    const db = readDb();
    const now = Date.now();
    let changed = false;

    db.documents.forEach(doc => {
        if (doc.status === 'active' && now > doc.expiresAt) {
            doc.status = 'expired';
            // Delete all files associated with expired document
            const filesToDelete = doc.files || (doc.filename ? [{ filename: doc.filename }] : []);

            filesToDelete.forEach(file => {
                try {
                    const p = path.join(UPLOADS_DIR, file.filename);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                } catch (e) { console.error(e); }
            });

            changed = true;
        }
    });

    if (changed) writeDb(db);
}

export function forceExpireDocument(code) {
    const db = readDb();
    const doc = db.documents.find(d => d.code === code);

    if (!doc) {
        return { success: false, error: 'Document not found' };
    }

    if (doc.status === 'expired') {
        return { success: false, error: 'Document already expired' };
    }

    // Force expire by setting expiry to past
    doc.status = 'expired';
    doc.expiresAt = Date.now() - 1000;

    // Delete all files associated with this code
    const filesToDelete = doc.files || (doc.filename ? [{ filename: doc.filename }] : []);

    filesToDelete.forEach(file => {
        try {
            const p = path.join(UPLOADS_DIR, file.filename);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {
            console.error('Error deleting file:', e);
        }
    });

    writeDb(db);
    return { success: true, doc };
}
