import fs from 'fs';
import { getDocument } from '../../../lib/storage';

export default function handler(req, res) {
    const { code, fileIndex } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Code required' });
    }

    // Parse fileIndex if provided (for multi-file documents)
    const index = fileIndex !== undefined ? parseInt(fileIndex) : null;
    
    const doc = getDocument(code, index);

    if (!doc) {
        return res.status(404).json({ error: 'Document not found or expired' });
    }

    // Handle multi-file response - return list if no fileIndex specified
    if (doc.files && !doc.file && index === null) {
        return res.status(200).json({
            code: doc.code,
            files: doc.files.map(f => ({
                filename: f.originalName,
                mimeType: f.mimeType,
                index: f.index
            })),
            expiresAt: doc.expiresAt
        });
    }

    // Get the file to serve (either from doc.file or legacy doc structure)
    let fileToServe;
    
    if (doc.file) {
        // Multi-file document - use doc.file
        fileToServe = {
            filename: doc.file.filename,
            originalName: doc.file.originalName,
            mimeType: doc.file.mimeType,
            fullPath: doc.file.fullPath || doc.fullPath
        };
    } else if (doc.filename) {
        // Legacy single-file document
        fileToServe = {
            filename: doc.filename,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            fullPath: doc.fullPath
        };
    } else {
        return res.status(404).json({ error: 'File not found' });
    }

    // Verify file path exists
    if (!fileToServe.fullPath) {
        console.error(`No fullPath found for code ${code}, fileIndex ${index}`);
        return res.status(410).json({ error: 'File path not found' });
    }

    if (!fs.existsSync(fileToServe.fullPath)) {
        console.error(`File not found on disk: ${fileToServe.fullPath} for code ${code}`);
        return res.status(410).json({ error: 'File deleted or not found' });
    }

    // Set headers
    res.setHeader('Content-Type', fileToServe.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${fileToServe.originalName}"`);

    // Security Headers
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const fileStream = fs.createReadStream(fileToServe.fullPath);
    fileStream.pipe(res);
}
