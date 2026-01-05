import { getDocument } from '../../../lib/storage';

export default function handler(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Code required' });
    }

    const doc = getDocument(code);

    if (!doc) {
        return res.status(404).json({ error: 'Document not found or expired' });
    }

    // Map storage format to what frontend expects
    const files = (doc.files || []).map(f => ({
        name: f.originalName,
        size: 0, // Storage doesn't track size currently, ok to omit or mock
        type: f.mimeType,
        index: f.index
    }));

    return res.status(200).json({
        files,
        expiresAt: doc.expiresAt
    });
}
