// ============================================
// EXPORT PANEL v260101e - Redesigned with HTML/PDF exports
// Storage and sharing for HKI inscriptions
// Fixed: UTF-8 encoding, fonts, word break indicators
// Added: Link to booklet generator
// ============================================

const ExportPanel = ({
    recognitionResults,
    validations,
    image,
    displayImage,
    preprocessing,
    readingDirection,
    readingOrder,
    wordBoundaries,
    lineBreaks,
    columnBreaks,
    translationEnglish,
    translationArabic,
    currentInscriptionId,
    inscriptionTitle,
    inscriptionSource,
    inscriptionNotes,
    inscriptionComplete,
    transcriptionFormat = 'horizontal-rtl', // Added for vertical layout support
    isCollapsed,
    onToggleCollapse,
    onSaveHki,
    onSaveAsNew,
    onOpenWarehouse,
    onLoadHki,
    visibility = 'draft',
    onVisibilityChange,
    syncStatus = null,
    localSaveTime = null,
    driveSignedIn = false,
    driveUserEmail = null,
    currentFileId = null,
    fileOwner = null,
    onSignIn = null,
    imageRef,
    className = ''
}) => {
    const { useState, useRef } = React;
    
    const [isExporting, setIsExporting] = useState(false);
    const [showExportFormats, setShowExportFormats] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [htmlOptions, setHtmlOptions] = useState({
        showImage: true,
        showAnnotated: false,  // Show numbered boxes on image
        showDetections: true,
        showTranscription: true,
        showTranslation: true
    });
    const fileInputRef = useRef(null);
    
    const hasData = recognitionResults && recognitionResults.length > 0;
    
    // Visibility options
    const visibilityOptions = [
        { value: 'draft', label: '📝 Draft', desc: 'Only you can see this' },
        { value: 'review', label: '👁️ Review', desc: 'Colleagues with keywords can view' },
        { value: 'published', label: '✅ Published', desc: 'Finalized and shared' }
    ];
    
    const currentVisibility = visibilityOptions.find(v => v.value === visibility) || visibilityOptions[0];
    
    // Get sync status
    const getSyncStatusText = () => {
        if (!driveSignedIn) return '☁️ Sign in to Drive to enable sync';
        if (!syncStatus || typeof syncStatus !== 'object') return '☁️ Auto-syncs to Drive';
        if (syncStatus.isOnline === false) return '📴 Offline - will sync when connected';
        if (syncStatus.pending > 0) return '⏳ ' + syncStatus.pending + ' pending sync';
        return '☁️ Auto-syncs to Drive';
    };
    
    const getSyncStatusClass = () => {
        if (!driveSignedIn) return 'text-gray-400';
        if (!syncStatus || typeof syncStatus !== 'object') return 'text-patina';
        if (syncStatus.isOnline === false) return 'text-gray-500';
        if (syncStatus.pending > 0) return 'text-amber-600';
        return 'text-patina';
    };
    
    // Get local save time text
    const getLocalSaveText = () => {
        if (!localSaveTime) return null;
        
        const seconds = Math.floor((new Date() - new Date(localSaveTime)) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 120) return '1 min ago';
        if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
        if (seconds < 7200) return '1 hour ago';
        return Math.floor(seconds / 3600) + ' hours ago';
    };
    
    /**
     * Get ordered transcription text
     */
    const getTranscription = (script = 'translit') => {
        if (!hasData) return '';
        
        const orderedIndices = readingOrder && readingOrder.length > 0 
            ? readingOrder 
            : recognitionResults.map((_, i) => i);
        
        let parts = [];
        let currentWord = [];
        
        orderedIndices.forEach((idx) => {
            const result = recognitionResults[idx];
            if (!result) return;
            
            const char = script === 'arabic' 
                ? '<bdi>' + (result.glyph.arabic || result.glyph.transliteration || result.glyph.name) + '</bdi>'
                : (result.glyph.transliteration || result.glyph.name);
            
            currentWord.push(char);
            
            if (wordBoundaries && wordBoundaries.has(idx)) {
                parts.push(currentWord.join(''));
                currentWord = [];
            }
            
            if (lineBreaks && lineBreaks.has(idx)) {
                if (currentWord.length > 0) {
                    parts.push(currentWord.join(''));
                    currentWord = [];
                }
                parts.push('\n');
            }
        });
        
        if (currentWord.length > 0) {
            parts.push(currentWord.join(''));
        }
        
        return parts.join(' ').replace(/ \n /g, '\n').trim();
    };
    
    /**
     * Get columns for vertical layout
     */
    const getColumns = (script = 'translit') => {
        if (!hasData) return [];
        
        const orderedIndices = readingOrder && readingOrder.length > 0 
            ? readingOrder 
            : recognitionResults.map((_, i) => i);
        
        const columns = [];
        let currentColumn = [];
        
        orderedIndices.forEach((idx, i) => {
            const result = recognitionResults[idx];
            if (!result) return;
            
            const char = script === 'arabic' 
                ? (result.glyph.arabic || result.glyph.transliteration || result.glyph.name)
                : (result.glyph.transliteration || result.glyph.name);
            
            currentColumn.push({
                char,
                hasWordBoundary: wordBoundaries && wordBoundaries.has(idx),
                index: i + 1
            });
            
            // Split column on line break or column break
            if ((lineBreaks && lineBreaks.has(idx)) || (columnBreaks && columnBreaks.has(idx))) {
                columns.push(currentColumn);
                currentColumn = [];
            }
        });
        
        if (currentColumn.length > 0) {
            columns.push(currentColumn);
        }
        
        return columns;
    };
    
    /**
     * Generate annotated image as data URL with numbered boxes
     */
    const generateAnnotatedImageDataUrl = () => {
        return new Promise((resolve) => {
            if (!hasData || !imageRef || !imageRef.current) {
                resolve(null);
                return;
            }
            
            const img = imageRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0);
            
            // Get reading order
            const orderedIndices = readingOrder && readingOrder.length > 0 
                ? readingOrder 
                : recognitionResults.map((_, i) => i);
            
            // Draw boxes with numbers
            orderedIndices.forEach((idx, readingIdx) => {
                const result = recognitionResults[idx];
                if (!result) return;
                
                const pos = result.position;
                const num = readingIdx + 1;
                
                // Box
                ctx.strokeStyle = '#5c4d6e';
                ctx.lineWidth = 2;
                ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
                
                // Number badge
                const badgeSize = Math.min(24, Math.max(16, pos.width * 0.3));
                ctx.fillStyle = '#5c4d6e';
                ctx.beginPath();
                ctx.arc(pos.x + pos.width, pos.y, badgeSize / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Number text
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${badgeSize * 0.6}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(num.toString(), pos.x + pos.width, pos.y);
            });
            
            resolve(canvas.toDataURL('image/png'));
        });
    };
    
    /**
     * Export annotated image
     */
    const exportImage = () => {
        if (!hasData || !imageRef || !imageRef.current) return;
        
        try {
            const img = imageRef.current;
            const canvas = document.createElement('canvas');
            
            // Add space for transcription below image
            const transcription = getTranscription();
            const padding = 20;
            const textHeight = transcription ? 80 : 0;
            
            canvas.width = img.naturalWidth + padding * 2;
            canvas.height = img.naturalHeight + padding * 2 + textHeight;
            const ctx = canvas.getContext('2d');
            
            // Background
            ctx.fillStyle = '#f5f3f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw image
            ctx.drawImage(img, padding, padding);
            
            // Draw detection boxes
            recognitionResults.forEach((result, index) => {
                const pos = result.position;
                const validation = validations ? validations[index] : null;
                
                // Colors based on validation
                if (validation && validation.isCorrect) {
                    ctx.strokeStyle = '#6b8e7f';
                    ctx.fillStyle = 'rgba(107, 142, 127, 0.2)';
                } else if (validation && !validation.isCorrect) {
                    ctx.strokeStyle = '#a0674f';
                    ctx.fillStyle = 'rgba(160, 103, 79, 0.2)';
                } else {
                    ctx.strokeStyle = '#5c4d6e';
                    ctx.fillStyle = 'rgba(92, 77, 110, 0.15)';
                }
                
                ctx.lineWidth = 2;
                ctx.fillRect(pos.x + padding, pos.y + padding, pos.width, pos.height);
                ctx.strokeRect(pos.x + padding, pos.y + padding, pos.width, pos.height);
                
                // Glyph label
                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = 'bold 12px Arial, sans-serif';
                ctx.fillText(result.glyph.transliteration || result.glyph.name, pos.x + padding, pos.y + padding - 3);
            });
            
            // Draw transcription below image
            if (transcription) {
                ctx.fillStyle = '#333';
                const textY = img.naturalHeight + padding * 2 + 20;
                
                // Title
                ctx.font = 'bold 14px Arial, sans-serif';
                ctx.fillText(inscriptionTitle || inscriptionSource || currentInscriptionId || 'Inscription', padding, textY);
                
                // Transcription - use serif for better Unicode support
                ctx.font = '18px Georgia, "Times New Roman", serif';
                ctx.fillText(transcription.replace(/\n/g, ' | '), padding, textY + 25);
                
                // Translation if available
                if (translationEnglish) {
                    ctx.font = 'italic 14px Arial, sans-serif';
                    ctx.fillStyle = '#666';
                    ctx.fillText('"' + translationEnglish.substring(0, 80) + (translationEnglish.length > 80 ? '...' : '') + '"', padding, textY + 50);
                }
            }
            
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = (inscriptionTitle || inscriptionSource || currentInscriptionId || 'inscription').replace(/\s+/g, '-') + '.png';
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (error) {
            console.error('Image export error:', error);
            alert('❌ Export failed: ' + error.message);
        }
    };
    
    /**
     * Generate HTML report content
     */
    const generateHtmlContent = async (forPrint = false) => {
        const transcriptTranslit = getTranscription('translit');
        const transcriptArabic = getTranscription('arabic');
        const columns = getColumns('translit');
        const arabicColumns = getColumns('arabic');
        const isVertical = transcriptionFormat && transcriptionFormat.startsWith('vertical');
        const isRtl = transcriptionFormat && (transcriptionFormat.includes('rtl') || transcriptionFormat === 'vertical-rtl');
        const dateStr = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        // Get annotated image if option is selected
        let annotatedImageSrc = null;
        if (htmlOptions.showAnnotated) {
            annotatedImageSrc = await generateAnnotatedImageDataUrl();
        }
        
        // Get reading order for numbered detections
        const orderedIndices = readingOrder && readingOrder.length > 0 
            ? readingOrder 
            : recognitionResults.map((_, i) => i);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${inscriptionTitle || inscriptionSource || currentInscriptionId || 'Hakli Inscription'}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: Georgia, 'Times New Roman', serif;
            max-width: 800px; 
            margin: 0 auto; 
            padding: 40px 20px;
            background: ${forPrint ? '#fff' : '#f9f7f4'};
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #8b7d6b;
        }
        .header h1 {
            font-size: 24px;
            color: #5c4d6e;
            margin-bottom: 8px;
        }
        .header .subtitle { color: #666; font-size: 14px; }
        .header .date { color: #999; font-size: 12px; margin-top: 5px; }
        .section { margin: 25px 0; }
        .section-title {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #8b7d6b;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .image-container { text-align: center; margin: 20px 0; }
        .image-container img {
            max-width: 100%;
            height: auto;
            border: 3px solid #e8e4df;
            border-radius: 4px;
        }
        .transcription {
            font-family: 'Gentium Plus', 'Charis SIL', 'DejaVu Sans', 'Lucida Sans Unicode', 'Arial Unicode MS', Georgia, serif;
            font-size: 22px;
            padding: 20px;
            background: #fff;
            border-left: 4px solid #5c4d6e;
            margin: 15px 0;
        }
        .transcription.arabic {
            font-family: 'Traditional Arabic', 'Arabic Typesetting', serif;
            direction: rtl;
            text-align: right;
            font-size: 26px;
        }
        /* Vertical column layout */
        .vertical-transcription {
            display: flex;
            gap: 30px;
            padding: 20px;
            background: #fff;
            border: 1px solid #e8e4df;
            border-radius: 4px;
            overflow-x: auto;
            direction: ${isRtl ? 'rtl' : 'ltr'};
        }
        .vertical-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0 15px;
            border-right: 1px solid #e8e4df;
            direction: ltr;
        }
        .vertical-column:last-child { border-right: none; }
        .vertical-glyph {
            font-family: 'Gentium Plus', 'Charis SIL', 'DejaVu Sans', Georgia, serif;
            font-size: 22px;
            line-height: 2;
            position: relative;
        }
        .vertical-glyph.arabic {
            font-family: 'Traditional Arabic', 'Arabic Typesetting', serif;
            font-size: 26px;
        }
        .vertical-glyph.word-end {
            padding-bottom: 12px;
            margin-bottom: 12px;
            border-bottom: 3px solid #8b7d6b;
        }
        .vertical-glyph.word-end::after {
            content: '·';
            display: block;
            text-align: center;
            color: #8b7d6b;
            font-size: 14px;
            margin-top: 4px;
        }
        .word-boundary { color: #8b7d6b; font-weight: bold; }
        .translation {
            font-style: italic;
            padding: 15px 20px;
            background: #f0ede8;
            border-radius: 4px;
            color: #555;
        }
        .notes {
            padding: 15px;
            background: #faf8f5;
            border: 1px solid #e8e4df;
            border-radius: 4px;
            font-size: 14px;
        }
        .detection-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
            gap: 8px;
            margin: 15px 0;
        }
        .detection-card {
            text-align: center;
            padding: 8px 4px;
            background: #fff;
            border: 1px solid #e8e4df;
            border-radius: 4px;
        }
        .detection-card .number {
            display: inline-block;
            width: 20px;
            height: 20px;
            line-height: 20px;
            background: #5c4d6e;
            color: #fff;
            border-radius: 50%;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .detection-card img {
            width: 45px;
            height: 45px;
            object-fit: contain;
            display: block;
            margin: 4px auto;
        }
        .detection-card .glyph {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            color: #5c4d6e;
        }
        .detection-card .confidence {
            font-size: 10px;
            color: #999;
        }
        .metadata {
            font-size: 12px;
            color: #999;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e8e4df;
        }
        @media print {
            body { padding: 20px; background: #fff; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${inscriptionTitle || inscriptionSource || 'Hakli Inscription'}</h1>
        <div class="subtitle">${currentInscriptionId || ''}</div>
        <div class="date">${dateStr}</div>
    </div>
    
    ${htmlOptions.showImage && (displayImage || image) ? `
    <div class="section">
        <div class="section-title">Inscription Image${htmlOptions.showAnnotated ? ' (with numbered detections)' : ''}</div>
        <div class="image-container">
            <img src="${htmlOptions.showAnnotated && annotatedImageSrc ? annotatedImageSrc : (displayImage || image)}" alt="Inscription">
        </div>
    </div>
    ` : ''}
    
    ${htmlOptions.showTranscription && transcriptTranslit ? `
    <div class="section">
        <div class="section-title">Transliteration</div>
        ${isVertical && columns.length > 0 ? `
        <div class="vertical-transcription">
            ${columns.map(col => `
                <div class="vertical-column">
                    ${col.map(g => `
                        <span class="vertical-glyph${g.hasWordBoundary ? ' word-end' : ''}">${g.char}</span>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        ` : `
        <div class="transcription">${transcriptTranslit.replace(/\n/g, '<br>')}</div>
        `}
    </div>
    
    ${transcriptArabic ? `
    <div class="section">
        <div class="section-title">Arabic Script</div>
        ${isVertical && arabicColumns.length > 0 ? `
        <div class="vertical-transcription">
            ${arabicColumns.map(col => `
                <div class="vertical-column">
                    ${col.map(g => `
                        <span class="vertical-glyph arabic${g.hasWordBoundary ? ' word-end' : ''}">${g.char}</span>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        ` : `
        <div class="transcription arabic">${transcriptArabic.replace(/\n/g, '<br>')}</div>
        `}
    </div>
    ` : ''}
    ` : ''}
    
    ${htmlOptions.showTranslation && translationEnglish ? `
    <div class="section">
        <div class="section-title">English Translation</div>
        <div class="translation">${translationEnglish}</div>
    </div>
    ` : ''}
    
    ${htmlOptions.showTranslation && translationArabic ? `
    <div class="section">
        <div class="section-title">ترجمة عربية</div>
        <div class="translation" style="direction: rtl; text-align: right;">${translationArabic}</div>
    </div>
    ` : ''}
    
    ${inscriptionNotes ? `
    <div class="section">
        <div class="section-title">Notes</div>
        <div class="notes">${inscriptionNotes}</div>
    </div>
    ` : ''}
    
    ${htmlOptions.showDetections && hasData ? `
    <div class="section">
        <div class="section-title">Detected Glyphs (${recognitionResults.length})</div>
        <div class="detection-grid">
            ${orderedIndices.map((idx, readingIdx) => {
                const result = recognitionResults[idx];
                if (!result) return '';
                return `
                <div class="detection-card">
                    <div class="number">${readingIdx + 1}</div>
                    ${result.thumbnail ? `<img src="${result.thumbnail}" alt="${result.glyph.name}">` : ''}
                    <div class="glyph">${result.glyph.transliteration || result.glyph.name}</div>
                </div>
            `}).join('')}
        </div>
    </div>
    ` : ''}
    
    <div class="metadata">
        <strong>Reading direction:</strong> ${readingDirection || 'RTL'}<br>
        <strong>Layout:</strong> ${isVertical ? 'Vertical columns' : 'Horizontal'} (${isRtl ? 'R→L' : 'L→R'})<br>
        <strong>Total glyphs:</strong> ${recognitionResults?.length || 0}<br>
        <strong>Generated by:</strong> Hakli Glyph Recognizer
    </div>
</body>
</html>`;
    };
    
    /**
     * Export HTML report
     */
    const exportHtml = async () => {
        if (!hasData) return;
        
        setIsExporting(true);
        
        try {
            const html = await generateHtmlContent(false);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (inscriptionTitle || inscriptionSource || currentInscriptionId || 'inscription').replace(/\s+/g, '-') + '-report.html';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('HTML export error:', error);
            alert('❌ Export failed: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };
    
    /**
     * Export PDF (via print dialog)
     */
    const exportPdf = async () => {
        if (!hasData) return;
        
        setIsExporting(true);
        
        try {
            const html = await generateHtmlContent(true);
            
            // Use Blob URL for proper UTF-8 encoding (document.write can mangle Unicode)
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            const printWindow = window.open(blobUrl, '_blank');
            
            // Wait for window to load then print
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    // Clean up blob URL after a delay
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                    setIsExporting(false);
                }, 500);
            };
        } catch (error) {
            console.error('PDF export error:', error);
            alert('❌ Export failed: ' + error.message);
            setIsExporting(false);
        }
    };
    
    /**
     * Export HKI file locally (for offline backup)
     */
    const exportHki = () => {
        if (!hasData) return;
        
        try {
            // Build complete HKI data (same format as Drive save)
            const hkiData = {
                version: '2.0',
                inscriptionId: currentInscriptionId || `HKI-${Date.now().toString(36).toUpperCase()}`,
                title: inscriptionTitle || 'Untitled',
                notes: inscriptionNotes || '',
                complete: inscriptionComplete || false,
                visibility: visibility || 'draft',
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                
                // Images
                image: image,
                displayImage: displayImage,
                
                // Recognition data
                recognitionResults: recognitionResults.map(r => ({
                    glyph: {
                        id: r.glyph?.id,
                        name: r.glyph?.name,
                        transliteration: r.glyph?.transliteration,
                        arabic: r.glyph?.arabic,
                        description: r.glyph?.description
                    },
                    confidence: r.confidence,
                    position: r.position,
                    thumbnail: r.thumbnail,
                    corrected: r.corrected || false
                })),
                validations: validations || {},
                
                // Reading data
                readingData: {
                    direction: readingDirection,
                    order: readingOrder || [],
                    wordBoundaries: wordBoundaries ? Array.from(wordBoundaries) : [],
                    lineBreaks: lineBreaks ? Array.from(lineBreaks) : [],
                    columnBreaks: columnBreaks ? Array.from(columnBreaks) : []
                },
                
                // Translations
                translationEnglish: translationEnglish || '',
                translationArabic: translationArabic || '',
                
                // Preprocessing settings
                preprocessing: preprocessing || {}
            };
            
            const blob = new Blob([JSON.stringify(hkiData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (inscriptionTitle || inscriptionSource || currentInscriptionId || 'inscription').replace(/\s+/g, '-') + '.hki';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('HKI export error:', error);
            alert('❌ Export failed: ' + error.message);
        }
    };
    
    /**
     * Export JSON (for database/backup)
     */
    const exportJson = () => {
        if (!hasData) return;
        
        try {
            const exportData = {
                metadata: {
                    inscriptionId: currentInscriptionId,
                    title: inscriptionTitle,
                    notes: inscriptionNotes,
                    exportDate: new Date().toISOString(),
                    totalGlyphs: recognitionResults.length
                },
                detections: recognitionResults.map((result, index) => ({
                    index,
                    glyph: {
                        id: result.glyph.id,
                        name: result.glyph.name,
                        transliteration: result.glyph.transliteration,
                        arabic: result.glyph.arabic
                    },
                    confidence: result.confidence,
                    position: result.position,
                    validated: validations ? validations[index] : null
                })),
                reading: {
                    direction: readingDirection,
                    order: readingOrder || [],
                    wordBoundaries: wordBoundaries ? Array.from(wordBoundaries) : [],
                    lineBreaks: lineBreaks ? Array.from(lineBreaks) : [],
                    columnBreaks: columnBreaks ? Array.from(columnBreaks) : []
                },
                translations: {
                    english: translationEnglish,
                    arabic: translationArabic
                }
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (currentInscriptionId || 'inscription') + '-data.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('JSON export error:', error);
            alert('❌ Export failed: ' + error.message);
        }
    };
    
    return (
        <CollapsibleSection
            title="💾 Storage"
            isCollapsed={isCollapsed}
            onToggle={onToggleCollapse}
            className={className}
        >
            <div className="space-y-3">
                {/* Status */}
                <div className="text-sm text-gray-600">
                    {hasData ? (
                        <span className="text-patina">✅ {recognitionResults.length} glyphs ready</span>
                    ) : (
                        <span className="text-gray-400">No recognition data</span>
                    )}
                </div>
                
                {/* HKI Package - with thumbnail */}
                <div className="p-3 bg-ancient-purple/10 rounded-lg">
                    <div className="flex items-start gap-3 mb-3">
                        {/* Thumbnail */}
                        {(displayImage || image) && (
                            <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 border-ancient-purple/30 bg-gray-100">
                                <img 
                                    src={displayImage || image} 
                                    alt="Inscription thumbnail" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}
                        
                        {/* Header with title and visibility */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-gray-700 truncate">
                                    📦 {inscriptionTitle || 'Untitled'}
                                </span>
                                
                                {/* Visibility Dropdown */}
                                <div className="relative flex-shrink-0">
                                    <select
                                        value={visibility || 'draft'}
                                        onChange={(e) => onVisibilityChange && onVisibilityChange(e.target.value)}
                                        className={'text-xs px-2 py-1 rounded-full border-0 cursor-pointer appearance-none pr-6 ' + (
                                            visibility === 'draft' ? 'bg-gray-200 text-gray-700' :
                                            visibility === 'review' ? 'bg-amber-100 text-amber-700' :
                                            'bg-patina/20 text-patina'
                                        )}
                                        title={currentVisibility.desc}
                                    >
                                        {visibilityOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs">▼</span>
                                </div>
                            </div>
                            
                            {/* ID if exists */}
                            {currentInscriptionId && (
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                    {currentInscriptionId}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Save / Load buttons */}
                    <div className="space-y-2 mb-2">
                        {driveSignedIn ? (
                            <div className="flex gap-2">
                                {currentFileId && (fileOwner === driveUserEmail || typeof fileOwner === 'undefined') ? (
                                    <button
                                        onClick={() => onSaveHki && onSaveHki()}
                                        disabled={!hasData}
                                        className="flex-1 px-3 py-2 bg-ancient-purple text-white rounded-lg hover:bg-[#4a3d5a] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                    >
                                        💾 Save
                                    </button>
                                ) : null}
                                
                                <button
                                    onClick={() => onSaveAsNew && onSaveAsNew()}
                                    disabled={!hasData}
                                    className={'px-3 py-2 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium ' + 
                                        (currentFileId && fileOwner === driveUserEmail 
                                            ? 'bg-stone hover:bg-stone/80 flex-1' 
                                            : 'bg-ancient-purple hover:bg-[#4a3d5a] flex-1')}
                                >
                                    {currentFileId && fileOwner === driveUserEmail ? '📄 Save As New' : '☁️ Save to Cloud'}
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => onSignIn && onSignIn()}
                                className="w-full text-xs text-center text-ancient-purple py-2 bg-ancient-purple/10 hover:bg-ancient-purple/20 rounded border border-ancient-purple/30 cursor-pointer transition-colors font-medium"
                            >
                                🔑 Sign in to save to cloud
                            </button>
                        )}
                        
                        {/* Load buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => onOpenWarehouse && onOpenWarehouse()}
                                className="flex-1 px-3 py-2 bg-ochre text-white rounded-lg hover:bg-ochre/80 transition-colors text-sm font-medium"
                            >
                                📚 Browse Warehouse
                            </button>
                            
                            <label className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer transition-colors text-sm text-center font-medium">
                                📂
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".hki,.json"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (onLoadHki && e.target.files && e.target.files[0]) {
                                            onLoadHki(e);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        
                        {/* Download HKI for local backup */}
                        <button
                            onClick={exportHki}
                            disabled={!hasData}
                            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors text-sm font-medium border border-gray-300"
                            title="Download HKI file for offline backup"
                        >
                            ⬇️ Download HKI
                        </button>
                    </div>
                    
                    {/* Sync status */}
                    {driveSignedIn ? (
                        <div className={'text-xs text-center ' + getSyncStatusClass()}>
                            {getSyncStatusText()}
                        </div>
                    ) : (
                        <button 
                            onClick={() => onSignIn && onSignIn()}
                            className="w-full text-xs text-center text-ancient-purple hover:underline cursor-pointer"
                        >
                            ☁️ Sign in to Drive to enable sync
                        </button>
                    )}
                    
                    {/* Local save indicator */}
                    {localSaveTime && (
                        <div className="text-xs text-center text-gray-500 mt-1">
                            💾 Saved locally {getLocalSaveText()}
                        </div>
                    )}
                </div>
                
                {/* Share / Export Section */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowExportFormats(!showExportFormats)}
                        className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-sm text-gray-600"
                    >
                        <span>📤 Share & Export</span>
                        <span className={'transition-transform ' + (showExportFormats ? 'rotate-180' : '')}>▼</span>
                    </button>
                    
                    {showExportFormats && (
                        <div className="p-3 space-y-3 bg-white">
                            {/* Sharing exports */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={exportImage}
                                    disabled={!hasData || !imageRef || !imageRef.current}
                                    className="px-3 py-3 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors text-sm border border-blue-200"
                                    title="Share on social media, WhatsApp"
                                >
                                    <div className="text-lg mb-1">📷</div>
                                    <div className="font-medium">Image</div>
                                    <div className="text-xs text-gray-500">For sharing</div>
                                </button>
                                
                                <button
                                    onClick={exportPdf}
                                    disabled={!hasData || isExporting}
                                    className="px-3 py-3 bg-red-50 hover:bg-red-100 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors text-sm border border-red-200"
                                    title="Printable document for elders"
                                >
                                    <div className="text-lg mb-1">📄</div>
                                    <div className="font-medium">PDF</div>
                                    <div className="text-xs text-gray-500">For printing</div>
                                </button>
                            </div>
                            
                            {/* HTML Export with options */}
                            <div className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">🌐 HTML Report</span>
                                    <button
                                        onClick={exportHtml}
                                        disabled={!hasData || isExporting}
                                        className="px-3 py-1 bg-ochre text-white rounded hover:bg-ochre/80 disabled:bg-gray-300 text-xs"
                                    >
                                        {isExporting ? '⏳...' : 'Download'}
                                    </button>
                                </div>
                                
                                {/* HTML options */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={htmlOptions.showImage}
                                            onChange={(e) => setHtmlOptions(prev => ({...prev, showImage: e.target.checked}))}
                                            className="rounded"
                                        />
                                        <span>Image</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer" title="Show numbered detection boxes on image">
                                        <input 
                                            type="checkbox" 
                                            checked={htmlOptions.showAnnotated}
                                            onChange={(e) => setHtmlOptions(prev => ({...prev, showAnnotated: e.target.checked, showImage: e.target.checked ? true : prev.showImage}))}
                                            className="rounded"
                                        />
                                        <span>① Numbered</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={htmlOptions.showDetections}
                                            onChange={(e) => setHtmlOptions(prev => ({...prev, showDetections: e.target.checked}))}
                                            className="rounded"
                                        />
                                        <span>Glyph list</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={htmlOptions.showTranscription}
                                            onChange={(e) => setHtmlOptions(prev => ({...prev, showTranscription: e.target.checked}))}
                                            className="rounded"
                                        />
                                        <span>Transcription</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={htmlOptions.showTranslation}
                                            onChange={(e) => setHtmlOptions(prev => ({...prev, showTranslation: e.target.checked}))}
                                            className="rounded"
                                        />
                                        <span>Translation</span>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Advanced (JSON) */}
                            <div className="border-t border-gray-100 pt-2">
                                <button
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    {showAdvanced ? '▼' : '▶'} Advanced
                                </button>
                                
                                {showAdvanced && (
                                    <div className="mt-2">
                                        <button
                                            onClick={exportJson}
                                            disabled={!hasData}
                                            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors text-sm"
                                        >
                                            💾 JSON Data (for database import)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Tips */}
                {showExportFormats && (
                    <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded space-y-1">
                        <div>💡 <strong>Image</strong> for quick sharing · <strong>PDF</strong> for printing · <strong>HTML</strong> for email · <strong>HKI</strong> files contain everything needed to resume work later</div>
                        {onOpenWarehouse && (
                            <div className="pt-1 border-t border-gray-200">
                                📚 Need a <strong>multi-inscription booklet</strong> for elders?{' '}
                                <button 
                                    onClick={onOpenWarehouse}
                                    className="text-ancient-purple hover:underline font-medium"
                                >
                                    Open Warehouse → select items → Generate Booklet
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </CollapsibleSection>
    );
};

// Make globally available
window.ExportPanel = ExportPanel;

console.log('✅ ExportPanel (redesigned with HTML/PDF) loaded');
