import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Document as DocxDoc, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

const uploadsBase = path.resolve(process.cwd(), 'server/uploads');
const originalDir = path.join(uploadsBase, 'original');
const cleanedDir = path.join(uploadsBase, 'cleaned');

if (!fs.existsSync(originalDir)) {
  fs.mkdirSync(originalDir, { recursive: true });
}
if (!fs.existsSync(cleanedDir)) {
  fs.mkdirSync(cleanedDir, { recursive: true });
}

/**
 * Builds a valid, non-empty binary PDF using PDFKit.
 */
function createPdfFromCleanedText(title: string, cleanedText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 54,
      size: 'A4',
      info: {
        Title: `${title} — Cleaned Document`,
        Author: 'DocuClean AI',
        Subject: 'Restored & Formatted Document',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Document Header
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1E293B').text(title, { align: 'left' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(
      `DocuClean AI Cleaned Document — Verified Quality Restoration • ${new Date().toLocaleDateString()}`
    );
    doc.moveDown(0.8);

    // Separator rule
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(54, doc.y).lineTo(541, doc.y).stroke();
    doc.moveDown(1);

    // Document Body
    doc.font('Helvetica').fontSize(10.5).fillColor('#0F172A');

    const paragraphs = cleanedText.split(/\n\s*\n/);
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i].trim();
      if (!p) continue;

      // Check if paragraph looks like a section header
      if (/^[0-9]+\.\s+[A-Z\s]+$/.test(p) || /^[A-Z\s]{4,}$/.test(p)) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1E293B').text(p);
        doc.font('Helvetica').fontSize(10.5).fillColor('#0F172A');
        doc.moveDown(0.3);
      } else {
        doc.text(p, {
          align: 'left',
          lineGap: 3.5,
          paragraphGap: 6,
        });
      }
    }

    doc.end();
  });
}

/**
 * Builds a valid, non-empty binary DOCX using docx.js.
 */
async function createDocxFromCleanedText(title: string, cleanedText: string): Promise<Buffer> {
  const lines = cleanedText.split('\n');
  const paragraphs: Paragraph[] = [];

  // Title header
  paragraphs.push(
    new Paragraph({
      text: `${title} — Cleaned Document`,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  // Subtitle
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `DocuClean AI Restored Output • Verified Pristine • ${new Date().toLocaleDateString()}`,
          italics: true,
          color: '64748B',
          size: 18, // 9pt
        }),
      ],
      spacing: { after: 300 },
    })
  );

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      continue;
    }

    // Check for Section Headings
    if (/^[0-9]+\.\s+[A-Z\s]+$/.test(trimmed) || (/^[A-Z\s]{4,}$/.test(trimmed) && trimmed.length < 50)) {
      paragraphs.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (/^[-*•]\s+/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(trimmed.replace(/^[-*•]\s+/, ''))],
          spacing: { after: 80 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(trimmed)],
          spacing: { after: 140 },
        })
      );
    }
  }

  const doc = new DocxDoc({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * Creates and writes a cleaned file to the server filesystem.
 * Enforces Empty File Protection: guarantees file size > 0 and content is present.
 */
export async function saveCleanedFile(
  baseName: string,
  extension: string,
  cleanedText: string,
  title: string
): Promise<{ cleanedFileName: string; cleanedFilePath: string; cleanedFileSize: number; cleanedFileType: string }> {
  if (!cleanedText || cleanedText.trim().length === 0) {
    throw new Error('Cannot save cleaned file: cleaned text is empty.');
  }

  const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'document';
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;

  let targetExt = ext;
  // If extension is unsupported for writing, default to .txt
  if (!['.pdf', '.docx', '.doc', '.txt'].includes(targetExt)) {
    targetExt = '.txt';
  }

  const cleanedFileName = `${sanitized}_cleaned_${uniqueId}${targetExt === '.doc' ? '.docx' : targetExt}`;
  const cleanedFilePath = path.join(cleanedDir, cleanedFileName);

  let cleanedFileType = 'text/plain';

  if (targetExt === '.pdf') {
    cleanedFileType = 'application/pdf';
    const pdfBuf = await createPdfFromCleanedText(title, cleanedText);
    fs.writeFileSync(cleanedFilePath, pdfBuf);
  } else if (targetExt === '.docx' || targetExt === '.doc') {
    cleanedFileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const docxBuf = await createDocxFromCleanedText(title, cleanedText);
    fs.writeFileSync(cleanedFilePath, docxBuf);
  } else {
    cleanedFileType = 'text/plain';
    fs.writeFileSync(cleanedFilePath, cleanedText, 'utf8');
  }

  // EMPTY FILE PROTECTION: Verify file was created and is non-empty
  if (!fs.existsSync(cleanedFilePath)) {
    throw new Error(`Cleaned file failed to save at: ${cleanedFilePath}`);
  }

  const stats = fs.statSync(cleanedFilePath);
  if (stats.size === 0) {
    try {
      fs.unlinkSync(cleanedFilePath);
    } catch {
      // ignore
    }
    throw new Error('Critical error: Generated cleaned document has size 0 bytes.');
  }

  return {
    cleanedFileName,
    cleanedFilePath,
    cleanedFileSize: stats.size,
    cleanedFileType,
  };
}

/**
 * Removes original and cleaned files from filesystem.
 */
export function removeDocumentFiles(originalPath?: string, cleanedPath?: string): void {
  if (originalPath && fs.existsSync(originalPath)) {
    try {
      fs.unlinkSync(originalPath);
    } catch (e) {
      console.error('Error deleting original file:', e);
    }
  }
  if (cleanedPath && fs.existsSync(cleanedPath)) {
    try {
      fs.unlinkSync(cleanedPath);
    } catch (e) {
      console.error('Error deleting cleaned file:', e);
    }
  }
}
