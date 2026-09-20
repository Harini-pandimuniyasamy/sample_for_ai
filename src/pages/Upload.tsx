import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  FileText,
  UploadCloud,
  Type,
  Trash2,
  CopyCheck,
} from 'lucide-react';
import { useDocument } from '../context/DocumentContext';
import { useAuth } from '../context/AuthContext';
import { DocumentChamber } from '../components/DocumentChamber';
import { Button } from '../components/Button';
import { ProgressStepper } from '../components/ProgressStepper';

const SAMPLE_TEXT_CONTENT = `CONFIDENTIAL  QUARTERLY  AUDIT   REP0RT  --  2O26
DocuClean  Enterpr1se   Soluti0ns   Group

1.  EXECUTIVE   SUMMARY
Dur1ng  the  prev1ous   operat1onal  quarter ,  our   mult1-reg1onal
fac1lities  encountered   substant1al  bottlenecks  in  the   ingest1on
of   uncategor1zed   analog   cop1es . Scanned   mater1als   frequently
exh1bited   art1facts   such  as :
-  scanner   speckle   no1se  and  skewed   b0rders
-  errat1c   hard   breaks  in
the  middle  of   statut0ry  c1tations
-  degraded   contrast   lead1ng  to  OCR   m1sreadings   like  'rn'   read  as  'm'

2.  QUANTITAT1VE   ANALYS1S
T0tal  scanned   pages:  12,480   docurnents
Average   clar1ty   index:  61.4%   (Sub-opt1mal)
Corrective   act1on   requ1red:  Immed1ate   AI  restorat1on`;

export const Upload: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { uploadedFile, uploadError, setUploadedFile, removeUploadedFile } = useDocument();

  // Authentication guard: if not authenticated, redirect to sign in immediately
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin', { state: { from: '/upload' }, replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [localValidationMessage, setLocalValidationMessage] = useState<string | null>(null);

  if (!isAuthenticated) {
    return null;
  }

  const handleFileAccepted = (file: File) => {
    setLocalValidationMessage(null);
    setUploadedFile(file);
  };

  const handleNext = () => {
    if (uploadMode === 'text') {
      if (!pastedText.trim()) {
        setLocalValidationMessage('Please type or paste some text before proceeding.');
        return;
      }
      const safeTitle = (documentTitle.trim() || 'Pasted_Document_2026').replace(/\.[^/.]+$/, '');
      const blob = new Blob([pastedText], { type: 'text/plain;charset=utf-8' });
      const textFile = new File([blob], `${safeTitle}.txt`, {
        type: 'text/plain',
        lastModified: Date.now(),
      });
      setLocalValidationMessage(null);
      setUploadedFile(textFile);
      navigate('/choose-options');
      return;
    }

    if (!uploadedFile) {
      setLocalValidationMessage('Please introduce a document into the chamber first.');
      return;
    }
    setLocalValidationMessage(null);
    navigate('/choose-options');
  };

  const loadSampleDocument = () => {
    const sampleContent = 'DOCUCLEAN SAMPLE DOCUMENT - QUARTERLY AUDIT 2026';
    const blob = new Blob([sampleContent], { type: 'application/pdf' });
    const sampleFile = new File([blob], 'Quarterly_Audit_Report_2026.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });
    setLocalValidationMessage(null);
    setUploadedFile(sampleFile);
  };

  const loadSampleText = () => {
    setPastedText(SAMPLE_TEXT_CONTENT);
    setDocumentTitle('Quarterly_Audit_Report_2026');
    setLocalValidationMessage(null);
  };

  const clearText = () => {
    setPastedText('');
    setDocumentTitle('');
    setLocalValidationMessage(null);
  };

  const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
  const charCount = pastedText.length;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pt-2 pb-12 animate-in fade-in duration-300">
      {/* Progress Stepper */}
      <ProgressStepper />

      {/* Page Title & Intro */}
      <div className="text-center max-w-xl mx-auto space-y-2 mb-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8ED] border border-[#6B315E]/20 text-[#3C8D87] text-xs font-mono font-bold uppercase tracking-wider shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#3C8D87] animate-pulse" />
          Document Entry Chamber
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C2830] tracking-tight font-heading">
          Ingest Document Into Machine
        </h1>
        <p className="text-sm text-[#6F6670]">
          Upload a document file or paste uncleaned text directly. Docu-Bot and optical sensors will scan and restore your content in real time.
        </p>
      </div>

      {/* Upload Mode Selector Tabs: File Upload vs Text */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-2xl bg-[#EADCC8]/60 border border-[#6B315E]/15 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setUploadMode('file');
              setLocalValidationMessage(null);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              uploadMode === 'file'
                ? 'bg-[#FFF8ED] text-[#6B315E] shadow-sm'
                : 'text-[#6F6670] hover:text-[#24162F]'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Document File</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode('text');
              setLocalValidationMessage(null);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              uploadMode === 'text'
                ? 'bg-[#FFF8ED] text-[#6B315E] shadow-sm'
                : 'text-[#6F6670] hover:text-[#24162F]'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text</span>
          </button>
        </div>
      </div>

      {uploadMode === 'file' ? (
        <>
          {/* 3D Scanning Chamber */}
          <DocumentChamber
            onFileAccepted={handleFileAccepted}
            isStagedFile={!!uploadedFile}
            fileName={uploadedFile?.name}
            fileSize={uploadedFile?.formattedSize}
            onClear={removeUploadedFile}
            onValidationError={setLocalValidationMessage}
          />

          {/* Sample Document Demo Ingestion */}
          {!uploadedFile && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-[#FFF8ED]/85 border border-[#6B315E]/20 text-xs text-[#2C2830] gap-3 max-w-xl mx-auto w-full shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C65D45] flex-shrink-0" />
                <span>Don&apos;t have a file ready? Materialize our sample audit report into the chamber.</span>
              </div>
              <button
                type="button"
                onClick={loadSampleDocument}
                className="secondary-btn px-4 py-2 rounded-xl font-bold text-xs flex-shrink-0 cursor-pointer shadow-xs hover:bg-[#FFF8ED]"
              >
                Materialize Sample
              </button>
            </div>
          )}
        </>
      ) : (
        /* Text Paste/Type Input Area */
        <div className="max-w-xl mx-auto w-full space-y-4">
          <div className="p-6 rounded-3xl bg-[#FFF8ED]/95 backdrop-blur-md border border-[#6B315E]/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EADCC8] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#24162F] to-[#6B315E] text-[#FFF8ED] flex items-center justify-center">
                  <Type className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#24162F] font-heading">
                    Type or Paste Document Text
                  </h2>
                  <p className="text-[11px] text-[#6F6670]">
                    Accepts text with OCR errors, erratic spacing, or line breaks
                  </p>
                </div>
              </div>

              {pastedText && (
                <button
                  type="button"
                  onClick={clearText}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#C65D45] hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Document Title Input */}
            <div>
              <label className="block text-xs font-bold text-[#24162F] mb-1 font-heading">
                Document Title (Optional)
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="e.g. Executive Summary 2026"
                className="w-full px-4 py-2.5 rounded-xl border border-[#EADCC8] bg-white text-xs sm:text-sm text-[#24162F] placeholder-[#978D91] focus:outline-none focus:border-[#6B315E] focus:ring-2 focus:ring-[#6B315E]/20"
              />
            </div>

            {/* Textarea Area */}
            <div>
              <label className="block text-xs font-bold text-[#24162F] mb-1 font-heading">
                Content to Clean
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  if (localValidationMessage) setLocalValidationMessage(null);
                }}
                rows={10}
                placeholder="Paste or type raw uncleaned text here... You can paste large multi-paragraph documents, OCR transcripts, or tables."
                className="w-full px-4 py-3 rounded-2xl border border-[#EADCC8] bg-white text-xs sm:text-sm text-[#2C2830] font-mono leading-relaxed placeholder-[#978D91] focus:outline-none focus:border-[#6B315E] focus:ring-2 focus:ring-[#6B315E]/20 resize-y min-h-[220px]"
              />
            </div>

            {/* Stats Bar and Quick Sample Loader */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#6F6670]">
              <div className="flex items-center gap-3 font-mono">
                <span><strong>{wordCount}</strong> words</span>
                <span>•</span>
                <span><strong>{charCount}</strong> characters</span>
              </div>

              <button
                type="button"
                onClick={loadSampleText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EADCC8]/60 hover:bg-[#EADCC8] text-[#6B315E] font-bold text-[11px] cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C65D45]" />
                <span>Paste Sample OCR Text</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Validation Error Banner */}
      {(localValidationMessage || uploadError) && (
        <div className="p-3.5 rounded-2xl bg-[#FFF8ED] border border-[#E98268]/60 flex items-center justify-center gap-2.5 text-[#C65D45] text-xs sm:text-sm font-bold shadow-xs animate-in fade-in duration-200 max-w-xl mx-auto w-full text-center">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#C65D45]" />
          <span>{localValidationMessage || uploadError}</span>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#EADCC8] max-w-xl mx-auto w-full">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="secondary-btn w-full sm:w-auto h-11 px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <Button
          onClick={handleNext}
          rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
          size="md"
          className="w-full sm:w-auto h-11"
        >
          Next: Choose Options
        </Button>
      </div>
    </div>
  );
};
