import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Extracts raw textual content from an uploaded document on disk.
 * Supports PDF, DOCX, DOC, and TXT with format-specific parsing.
 */
export async function extractTextFromDocument(
  filePath: string,
  originalFileName: string
): Promise<string> {
  const ext = path.extname(originalFileName).toLowerCase();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist at path: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error('Uploaded document is empty (0 bytes).');
  }

  // 1. Plain Text (.txt)
  if (ext === '.txt') {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    } catch (err: any) {
      throw new Error(`Failed to read TXT document: ${err.message}`);
    }
  }

  // 2. PDF Document (.pdf)
  if (ext === '.pdf') {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: fileBuffer });
      const parsedData = await parser.getText();
      await parser.destroy();

      const extracted = parsedData?.text || '';
      return extracted;
    } catch (err: any) {
      console.warn(`PDFParse extraction failed (${err.message}). Attempting buffer text sweep...`);
      // Fallback: extract string streams from PDF buffer
      const rawBuf = fs.readFileSync(filePath);
      const str = rawBuf.toString('binary');
      const textMatches = str.match(/\((.*?)\)\s*Tj/g);
      if (textMatches && textMatches.length > 0) {
        return textMatches.map((m) => m.replace(/[()]/g, '').replace(/Tj$/, '').trim()).join(' ');
      }
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  }

  // 3. Word Document (.docx)
  if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (result.value) {
        return result.value;
      }
      // If mammoth gave no raw text, try reading buffer directly
      const buffer = fs.readFileSync(filePath);
      const bufResult = await mammoth.extractRawText({ buffer });
      return bufResult.value || '';
    } catch (err: any) {
      throw new Error(`Failed to extract text from DOCX: ${err.message}`);
    }
  }

  // 4. Legacy Word Document (.doc)
  if (ext === '.doc') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (result.value && result.value.trim().length > 0) {
        return result.value;
      }
    } catch {
      // Mammoth can fail on binary OLE .doc files
    }

    // Binary text extraction fallback for OLE DOC
    try {
      const buffer = fs.readFileSync(filePath);
      const asciiStrings: string[] = [];
      let current = '';
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if (byte >= 32 && byte <= 126) {
          current += String.fromCharCode(byte);
        } else if (byte === 10 || byte === 13) {
          if (current.length > 3) asciiStrings.push(current);
          current = '';
        } else {
          if (current.length > 3) asciiStrings.push(current);
          current = '';
        }
      }
      if (current.length > 3) asciiStrings.push(current);
      return asciiStrings.join('\n');
    } catch (err: any) {
      throw new Error(`Failed to parse legacy DOC: ${err.message}`);
    }
  }

  // Default fallback for other text-like files
  return fs.readFileSync(filePath, 'utf8');
}
