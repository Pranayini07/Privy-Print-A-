import { saveDocuments, forceExpireDocument, getDocument } from '../../lib/storage';
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
    try {
        // Create a dummy file for testing
        const testFilePath = path.join(process.cwd(), 'temp_test_file.txt');
        fs.writeFileSync(testFilePath, 'Debugging content');

        const file = {
            originalFilename: 'temp_test_file.txt',
            filepath: testFilePath,
            name: 'temp_test_file.txt',
            mimetype: 'text/plain'
        };

        // 1. Save Document
        const doc = saveDocuments([file], { duration: 60 });
        const code = doc.code;
        console.log(`[Debug] Created doc: ${code}`);

        // 2. Verify Active
        let check = getDocument(code);
        if (!check || check.status !== 'active') {
            return res.status(500).json({ error: 'Failed to create active document', doc: check });
        }

        // 3. Force Expire
        console.log(`[Debug] Expiring doc: ${code}`);
        const result = forceExpireDocument(code);

        if (!result.success) {
            return res.status(500).json({ error: 'forceExpireDocument returned false', result });
        }

        // 4. Verify Expired connection
        check = getDocument(code);

        // Clean up
        // (files should be deleted by forceExpireDocument)

        return res.status(200).json({
            message: 'Test completed',
            create_code: code,
            expire_result: result,
            final_status: check ? check.status : 'null (expired/deleted)',
            expiresAt: check ? check.expiresAt : null
        });

    } catch (e) {
        return res.status(500).json({ error: e.message, stack: e.stack });
    }
}
