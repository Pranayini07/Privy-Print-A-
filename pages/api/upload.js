import { IncomingForm } from 'formidable';
import { saveDocuments, cleanupExpired } from '../../lib/storage';

export const config = {
    api: {
        bodyParser: false, // Disabling Next.js body parser to let formidable handle it
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Trigger cleanup occasionally
    if (Math.random() < 0.1) cleanupExpired();

    const form = new IncomingForm({
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    try {
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        // Formidable v3 returns arrays for fields and files usually
        const duration = parseInt(Array.isArray(fields.duration) ? fields.duration[0] : fields.duration) || 5;
        
        // Handle multiple files - formidable returns 'files' field for multiple uploads
        let uploadedFiles = [];
        if (files.files) {
            uploadedFiles = Array.isArray(files.files) ? files.files : [files.files];
        } else if (files.file) {
            // Fallback for single file upload (backward compatibility)
            uploadedFiles = Array.isArray(files.file) ? files.file : [files.file];
        }

        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Validate file count (optional limit)
        if (uploadedFiles.length > 20) {
            return res.status(400).json({ error: 'Maximum 20 files allowed per upload' });
        }

        // Save all files with one code
        const doc = saveDocuments(uploadedFiles, { duration });

        return res.status(200).json({
            code: doc.code,
            expiresAt: doc.expiresAt,
            files: doc.files,
            fileCount: doc.files.length
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Upload failed' });
    }
}
