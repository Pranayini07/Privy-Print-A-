import fs from 'fs';
import { getDocument } from '../../../lib/storage';

export default function handler(req, res) {
    const { code, file, fileIndex } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Code required' });
    }

    // Determine retrieval method
    let index = null;
    if (fileIndex !== undefined) {
        index = parseInt(fileIndex);
    }

    // Initial get to check existence
    const doc = getDocument(code);

    if (!doc) {
        return res.status(404).json({ error: 'Document not found or expired' });
    }

    // Logic to find the file object
    let targetFile = null;

    if (doc.files) {
        if (index !== null && index >= 0 && index < doc.files.length) {
            targetFile = doc.files[index];
        } else if (file) {
            // Lookup by original name
            targetFile = doc.files.find(f => f.originalName === file);
        } else if (doc.files.length === 1) {
            // Default to first if only one
            targetFile = doc.files[0];
        } else {
            // Default to first if no specific file requested from multi-file doc (shouldn't happen with correct frontend)
            targetFile = doc.files[0];
        }
    } else if (doc.filename) {
        // Legacy single file
        targetFile = {
            filename: doc.filename,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            index: 0
        };
    }

    if (!targetFile) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Securely resolve full path via storage logic
    const safeDoc = getDocument(code, targetFile.index !== undefined ? targetFile.index : 0);

    let fileToServe = null;
    if (safeDoc && safeDoc.file) {
        fileToServe = safeDoc.file;
    } else if (safeDoc && safeDoc.fullPath) {
        fileToServe = {
            fullPath: safeDoc.fullPath,
            originalName: safeDoc.originalName,
            mimeType: safeDoc.mimeType
        };
    }

    if (!fileToServe || !fileToServe.fullPath) {
        return res.status(404).json({ error: 'File resource unavailable' });
    }

    if (!fs.existsSync(fileToServe.fullPath)) {
        return res.status(410).json({ error: 'File deleted' });
    }

    // Serve stream with updated Security Headers for Printing
    res.setHeader('Content-Type', fileToServe.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${fileToServe.originalName}"`);

    // Updated CSP: allow-same-origin (for JS access) and allow-modals (for print dialog)
    // Removed allow-downloads (default blocked by sandbox)
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; sandbox allow-same-origin allow-modals allow-scripts");
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const fileStream = fs.createReadStream(fileToServe.fullPath);
    fileStream.pipe(res);
}
