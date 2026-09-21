import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/authMiddleware';
import { Document } from '../models/Document';
import { extractTextFromDocument } from '../services/textExtractionService';
import { cleanDocumentText } from '../services/documentCleaningService';
import { saveCleanedFile, removeDocumentFiles } from '../services/documentStorageService';

/**
 * Maps extension to standard MIME types
 */
function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    case '.txt':
      return 'text/plain';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * @desc    Upload & process document
 * @route   POST /api/documents/upload
 * @access  Private
 */
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  let initialDocRecord: any = null;

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized, please log in.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please provide a document file to upload.' });
      return;
    }

    const file = req.file;
    const originalFileName = file.originalname;
    const originalFilePath = file.path;
    const originalFileType = file.mimetype || getMimeType(path.extname(originalFileName));
    const originalFileSize = file.size;
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext);

    // EMPTY FILE VALIDATION: Uploaded file must not be 0 bytes
    if (originalFileSize === 0) {
      try {
        fs.unlinkSync(originalFilePath);
      } catch {
        // ignore
      }
      res.status(400).json({
        success: false,
        message: 'The uploaded file is empty (0 bytes). Please upload a valid document containing text.',
      });
      return;
    }

    // Parse options if provided
    let options: string[] = ['remove-spaces', 'fix-line-breaks', 'correct-ocr', 'normalize-headings', 'remove-noise'];
    if (req.body.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        // use default
      }
    }

    // Create initial document record in MongoDB with status 'processing'
    initialDocRecord = await Document.create({
      userId: req.user._id,
      originalFileName,
      originalFilePath,
      originalFileType,
      originalFileSize,
      fileType: originalFileType,
      fileSize: originalFileSize,
      inputType: 'file',
      status: 'processing',
      options,
    });

    // 1. Extract raw textual content from the uploaded document
    let rawText = '';
    try {
      rawText = await extractTextFromDocument(originalFilePath, originalFileName);
    } catch (extractErr: any) {
      console.error('Text extraction failed:', extractErr.message);
      initialDocRecord.status = 'failed';
      initialDocRecord.errorMessage = `Extraction failed: ${extractErr.message}`;
      await initialDocRecord.save();

      res.status(422).json({
        success: false,
        message: `Failed to extract text from document: ${extractErr.message}`,
        documentId: initialDocRecord._id,
      });
      return;
    }

    // EMPTY CONTENT CHECK: Check whether extracted text is empty or only whitespace
    if (!rawText || rawText.trim().length === 0) {
      const errMsg =
        ext.toLowerCase() === '.pdf'
          ? 'No readable text could be extracted from this PDF (it may be an image-only scanned document without an OCR text layer).'
          : 'Extracted content is empty. The uploaded file does not contain readable text.';

      initialDocRecord.status = 'failed';
      initialDocRecord.errorMessage = errMsg;
      await initialDocRecord.save();

      res.status(400).json({
        success: false,
        message: errMsg,
        documentId: initialDocRecord._id,
      });
      return;
    }

    // 2. Perform AI cleaning preserving complete content and structure
    const cleaningResult = await cleanDocumentText(rawText, options);

    if (!cleaningResult.cleanedText || cleaningResult.cleanedText.trim().length === 0) {
      initialDocRecord.status = 'failed';
      initialDocRecord.errorMessage = 'Document cleaning resulted in empty content unexpectedly.';
      await initialDocRecord.save();

      res.status(500).json({
        success: false,
        message: 'Document cleaning resulted in empty content unexpectedly.',
        documentId: initialDocRecord._id,
      });
      return;
    }

    // 3. Save physical cleaned file to disk (supports real PDF, DOCX, TXT)
    const { cleanedFileName, cleanedFilePath, cleanedFileSize, cleanedFileType } = await saveCleanedFile(
      baseName,
      ext || '.txt',
      cleaningResult.cleanedText,
      baseName
    );

    // 4. Update the SAME document record in MongoDB
    initialDocRecord.cleanedFileName = cleanedFileName;
    initialDocRecord.cleanedFilePath = cleanedFilePath;
    initialDocRecord.cleanedFileType = cleanedFileType;
    initialDocRecord.cleanedFileSize = cleanedFileSize;
    initialDocRecord.originalText = rawText;
    initialDocRecord.cleanedText = cleaningResult.cleanedText;
    initialDocRecord.metrics = cleaningResult.metrics;
    initialDocRecord.status = 'completed';
    initialDocRecord.fileSize = cleanedFileSize;
    initialDocRecord.fileType = cleanedFileType;
    await initialDocRecord.save();

    console.log(`[DocumentController] Successfully cleaned document ${initialDocRecord._id} (${cleanedFileName}, ${cleanedFileSize} bytes)`);

    res.status(201).json({
      success: true,
      message: 'Document uploaded and cleaned successfully',
      document: initialDocRecord,
    });
  } catch (error: any) {
    console.error('Upload document error:', error);
    if (initialDocRecord) {
      initialDocRecord.status = 'failed';
      initialDocRecord.errorMessage = error.message || 'Internal processing error';
      await initialDocRecord.save().catch(() => {});
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error processing document upload',
    });
  }
};

/**
 * @desc    Submit raw or pasted text for cleaning
 * @route   POST /api/documents/text
 * @access  Private
 */
export const submitTextDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { text, title, options: rawOptions } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ success: false, message: 'Please enter or paste document text' });
      return;
    }

    const documentTitle = title?.trim() || `Pasted_Text_${Date.now()}`;
    const baseName = documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const originalFileName = `${baseName}.txt`;

    let options: string[] = ['remove-spaces', 'fix-line-breaks', 'correct-ocr', 'normalize-headings', 'remove-noise'];
    if (rawOptions) {
      try {
        options = typeof rawOptions === 'string' ? JSON.parse(rawOptions) : rawOptions;
      } catch {
        // default
      }
    }

    // 1. Clean the text using AI pipeline
    const cleaningResult = await cleanDocumentText(text, options);

    // 2. Save original text to disk in server/uploads/original/
    const uploadsBase = path.resolve(process.cwd(), 'server/uploads');
    const originalDir = path.join(uploadsBase, 'original');
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true });
    }
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const originalFilePath = path.join(originalDir, `${baseName}_orig_${uniqueSuffix}.txt`);
    fs.writeFileSync(originalFilePath, text, 'utf8');

    // 3. Save physical cleaned text file to disk in server/uploads/cleaned/
    const { cleanedFileName, cleanedFilePath, cleanedFileSize, cleanedFileType } = await saveCleanedFile(
      baseName,
      '.txt',
      cleaningResult.cleanedText,
      documentTitle
    );

    // 4. Save metadata in MongoDB
    const document = await Document.create({
      userId: req.user._id,
      originalFileName,
      originalFilePath,
      originalFileType: 'text/plain',
      originalFileSize: Buffer.byteLength(text, 'utf8'),
      cleanedFileName,
      cleanedFilePath,
      cleanedFileType,
      cleanedFileSize,
      fileType: 'text/plain',
      fileSize: cleanedFileSize,
      inputType: 'text',
      status: 'completed',
      originalText: text,
      cleanedText: cleaningResult.cleanedText,
      options,
      metrics: cleaningResult.metrics,
    });

    res.status(201).json({
      success: true,
      message: 'Text submitted and cleaned successfully',
      document,
    });
  } catch (error: any) {
    console.error('Submit text document error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing text document',
    });
  }
};

/**
 * @desc    Get all documents for the authenticated user
 * @route   GET /api/documents/my-documents
 * @access  Private
 */
export const getMyDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    // Query MongoDB strictly by authenticated user's ID, sorted newest first
    const documents = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error: any) {
    console.error('Get my documents error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving document history',
    });
  }
};

/**
 * @desc    View document
 * @route   GET /api/documents/:id/view
 * @access  Private
 */
export const viewDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    // Verify ownership
    if (document.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to access this document' });
      return;
    }

    // Determine target file: prefer cleaned, fallback to original
    let targetPath = document.cleanedFilePath || document.originalFilePath;

    // Check if JSON explicitly requested
    const acceptHeader = req.headers.accept || '';
    const wantsJson = req.query.format === 'json' || (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html'));

    if (wantsJson) {
      res.json({
        success: true,
        document,
      });
      return;
    }

    // If file doesn't exist on disk, regenerate cleaned file if text is present
    if (!fs.existsSync(targetPath)) {
      if (document.cleanedText) {
        const ext = path.extname(document.cleanedFileName) || '.txt';
        const base = path.basename(document.cleanedFileName, ext);
        const regenerated = await saveCleanedFile(base, ext, document.cleanedText, document.originalFileName);
        document.cleanedFilePath = regenerated.cleanedFilePath;
        await document.save();
        targetPath = regenerated.cleanedFilePath;
      } else {
        res.status(404).json({ success: false, message: 'Physical document file not found on disk' });
        return;
      }
    }

    const contentType = document.cleanedFileType || document.fileType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.cleanedFileName || document.originalFileName)}"`);
    res.sendFile(path.resolve(targetPath));
  } catch (error: any) {
    console.error('View document error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving document',
    });
  }
};

/**
 * @desc    Download original uploaded document
 * @route   GET /api/documents/:id/download-original
 * @access  Private
 */
export const downloadOriginalDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    // Verify ownership
    if (document.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to download this document' });
      return;
    }

    const filePath = document.originalFilePath;

    if (!filePath || !fs.existsSync(filePath)) {
      // If original file was text input and not present, recreate it from originalText
      if (document.originalText) {
        const uploadsBase = path.resolve(process.cwd(), 'server/uploads/original');
        if (!fs.existsSync(uploadsBase)) fs.mkdirSync(uploadsBase, { recursive: true });
        const fallbackPath = path.join(uploadsBase, document.originalFileName);
        fs.writeFileSync(fallbackPath, document.originalText, 'utf8');
        document.originalFilePath = fallbackPath;
        await document.save();
        res.download(fallbackPath, document.originalFileName);
        return;
      }

      res.status(404).json({ success: false, message: 'Original document file not found on server' });
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      res.status(500).json({ success: false, message: 'Original document is empty (0 bytes).' });
      return;
    }

    res.download(filePath, document.originalFileName, (err) => {
      if (err && !res.headersSent) {
        console.error('Original download stream error:', err);
        res.status(500).json({ success: false, message: 'Error streaming original document file' });
      }
    });
  } catch (error: any) {
    console.error('Download original error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error downloading original document',
    });
  }
};

/**
 * @desc    Download cleaned document file
 * @route   GET /api/documents/:id/download-cleaned
 * @route   GET /api/documents/:id/download (backward compatibility)
 * @access  Private
 */
export const downloadCleanedDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    // Ownership verification
    if (document.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to download this document' });
      return;
    }

    let filePath = document.cleanedFilePath;

    // EMPTY FILE & REGENERATION PROTECTION:
    // If file is missing or 0 bytes, reconstruct it from cleanedText so the user never gets an empty or broken download
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      const ext = path.extname(document.cleanedFileName || document.originalFileName) || '.txt';
      const baseName = path.basename(document.cleanedFileName || document.originalFileName, ext);
      const textToSave = document.cleanedText || document.originalText;

      if (!textToSave || textToSave.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Cleaned document has no readable content to download.' });
        return;
      }

      const regenerated = await saveCleanedFile(baseName, ext, textToSave, document.originalFileName);
      document.cleanedFilePath = regenerated.cleanedFilePath;
      document.cleanedFileName = regenerated.cleanedFileName;
      document.cleanedFileSize = regenerated.cleanedFileSize;
      document.cleanedFileType = regenerated.cleanedFileType;
      await document.save();

      filePath = regenerated.cleanedFilePath;
    }

    // If user requested a specific format (pdf, docx, txt) different from existing file
    const requestedFormat = (req.query.format as string)?.toLowerCase();
    const validFormats = ['pdf', 'docx', 'doc', 'txt'];
    if (requestedFormat && validFormats.includes(requestedFormat)) {
      const targetExt = requestedFormat === 'doc' ? '.docx' : `.${requestedFormat}`;
      const currentExt = path.extname(filePath).toLowerCase();
      if (currentExt !== targetExt) {
        const textToExport = document.cleanedText || document.originalText;
        if (textToExport && textToExport.trim().length > 0) {
          const baseName = path.basename(document.originalFileName, path.extname(document.originalFileName));
          const converted = await saveCleanedFile(baseName, targetExt, textToExport, document.originalFileName);
          filePath = converted.cleanedFilePath;
        }
      }
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      res.status(500).json({ success: false, message: 'Generated cleaned document is unexpectedly empty.' });
      return;
    }

    const fileExt = path.extname(filePath);
    const baseOriginal = path.basename(document.originalFileName, path.extname(document.originalFileName));
    const fileName = `${baseOriginal}_cleaned${fileExt}`;
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Content-Type', getMimeType(fileExt));
    res.download(filePath, fileName, (err) => {
      if (err && !res.headersSent) {
        console.error('Cleaned download stream error:', err);
        res.status(500).json({ success: false, message: 'Error streaming cleaned document file' });
      }
    });
  } catch (error: any) {
    console.error('Download cleaned error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error downloading cleaned document',
    });
  }
};

/**
 * @desc    Get single document details by ID
 * @route   GET /api/documents/:id
 * @access  Private
 */
export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    // Verify ownership
    if (document.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to access this document' });
      return;
    }

    res.json({
      success: true,
      document,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving document',
    });
  }
};

/**
 * @desc    Delete document from MongoDB and server filesystem
 * @route   DELETE /api/documents/:id
 * @access  Private
 */
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    // Ownership check
    if (document.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
      return;
    }

    // Delete associated physical files
    removeDocumentFiles(document.originalFilePath, document.cleanedFilePath);

    // Delete MongoDB document record
    await Document.findByIdAndDelete(req.params.id);

    console.log(`[DocumentController] Deleted document ${req.params.id} for user ${req.user._id}`);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting document',
    });
  }
};
