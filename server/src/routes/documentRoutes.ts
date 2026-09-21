import { Router } from 'express';
import {
  uploadDocument,
  submitTextDocument,
  getMyDocuments,
  getDocumentById,
  viewDocument,
  downloadOriginalDocument,
  downloadCleanedDocument,
  deleteDocument,
} from '../controllers/documentController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = Router();

// Upload document with multer file handling
router.post('/upload', protect, upload.single('document'), uploadDocument);

// Submit pasted/raw text
router.post('/text', protect, submitTextDocument);

// Get all documents for authenticated user
router.get('/my-documents', protect, getMyDocuments);
router.get('/', protect, getMyDocuments);

// View document (inline stream or json)
router.get('/:id/view', protect, viewDocument);

// Download original document
router.get('/:id/download-original', protect, downloadOriginalDocument);
router.get('/:id/original', protect, downloadOriginalDocument);

// Download cleaned document
router.get('/:id/download-cleaned', protect, downloadCleanedDocument);
router.get('/:id/cleaned', protect, downloadCleanedDocument);

// Backward-compatible download route
router.get('/:id/download', protect, downloadCleanedDocument);

// Get single document metadata
router.get('/:id', protect, getDocumentById);

// Delete document
router.delete('/:id', protect, deleteDocument);

export default router;
