import { forceExpireDocument } from '../../../lib/storage';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Code required' });
    }

    try {
        const result = forceExpireDocument(code);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        return res.status(200).json({
            success: true,
            message: 'Document expired successfully',
            code: result.doc.code
        });
    } catch (error) {
        console.error('Force expire error:', error);
        return res.status(500).json({ error: 'Internal server error during expiration' });
    }
}


