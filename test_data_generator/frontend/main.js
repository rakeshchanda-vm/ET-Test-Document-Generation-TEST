document.addEventListener('DOMContentLoaded', () => {
    const editorForm = document.getElementById('editor-form');
    const addRowBtn = editorForm.querySelector('.add-row-btn');
    const rowsContainer = editorForm.querySelector('.replacement-rows');
    const editorSubmitBtn = document.getElementById('editor-submit-btn');

    const successStage = document.getElementById('success-stage');
    const btnDownloadEdited = document.getElementById('btn-download-edited');
    const scannerForm = document.getElementById('scanner-form');
    const converterSubmitBtn = document.getElementById('converter-submit-btn');

    // Combiner Elements
    const combineFileInput = document.getElementById('combine-file-input');
    const combineFileList = document.getElementById('combine-file-list');
    const combineSubmitBtn = document.getElementById('combine-submit-btn');
    const combinerForm = document.getElementById('combiner-form');

    let editedPdfBlob = null;
    let originalFilename = '';
    let skippedFiles = [];

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        });
    });

    // File Upload Handlers
    const dropZone = document.querySelector('.drop-zone');
    const fileInput = dropZone.querySelector('.pdf-file');
    const fileName = dropZone.querySelector('.file-name');

    dropZone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, prevent, false);
    });
    function prevent(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));

    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateName();
        }
    });
    fileInput.addEventListener('change', updateName);

    function updateName() {
        if (fileInput.files.length) {
            const count = fileInput.files.length;
            const skipToScannerBtn = document.getElementById('skip-to-scanner-btn');
            
            if (count === 1) {
                fileName.textContent = fileInput.files[0].name;
                editorSubmitBtn.disabled = false;
                editorSubmitBtn.classList.remove('hidden');
                editorSubmitBtn.style.removeProperty('display');
                skipToScannerBtn.textContent = 'Skip to Scanner';
            } else {
                fileName.textContent = `${count} files selected`;
                editorSubmitBtn.disabled = true;
                editorSubmitBtn.classList.add('hidden');
                editorSubmitBtn.style.setProperty('display', 'none', 'important');
                skipToScannerBtn.textContent = `Skip to Scanner (${count} files)`;
            }
            
            dropZone.style.borderColor = 'var(--primary)';
            successStage.classList.add('hidden');
            editorSubmitBtn.parentElement.classList.remove('hidden');
            const successHeader = successStage.querySelector('.success-header h3');
            successHeader.textContent = 'Text Replaced Successfully!';
        }
    }

    // Dynamic Rows
    addRowBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'replacement-row';
        row.innerHTML = `
            <input type="text" class="old-text" placeholder="Target Text" required>
            <svg class="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <input type="text" class="new-text" placeholder="New Text" required>
            <button type="button" class="btn-remove-row" title="Remove row">✕</button>
        `;
        rowsContainer.appendChild(row);
    });

    // Remove Row Handler
    rowsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-row')) {
            const row = e.target.closest('.replacement-row');
            const allRows = rowsContainer.querySelectorAll('.replacement-row');
            if (allRows.length > 1) {
                row.remove();
            } else {
                row.querySelectorAll('input').forEach(input => input.value = '');
            }
        }
    });

    // Submit Replace
    editorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fileInput.files.length) { alert('Upload a PDF'); return; }

        originalFilename = fileInput.files[0].name;

        const oldTexts = editorForm.querySelectorAll('.old-text');
        const newTexts = editorForm.querySelectorAll('.new-text');
        const rep = {};
        for (let i = 0; i < oldTexts.length; i++) {
            if (oldTexts[i].value) rep[oldTexts[i].value] = newTexts[i].value;
        }

        setLoading(editorSubmitBtn, true);
        successStage.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('replacements', JSON.stringify(rep));

        try {
            const res = await fetch('/api/replace', { method: 'POST', body: formData });
            if (!res.ok) {
                let errMsg = `HTTP ${res.status}`;
                try { const j = await res.json(); errMsg = j.detail || JSON.stringify(j); } catch {}
                throw new Error(errMsg);
            }
            editedPdfBlob = await res.blob();
            skippedFiles = [];
            btnDownloadEdited.classList.remove('hidden');
            editorSubmitBtn.parentElement.classList.add('hidden');

            const successHeader = successStage.querySelector('.success-header h3');
            successHeader.textContent = 'Text Replaced Successfully!';
            successStage.classList.remove('hidden');

        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(editorSubmitBtn, false, 'Replace Text');
        }
    });

    // Download Clean Edited PDF
    btnDownloadEdited.addEventListener('click', () => {
        if (editedPdfBlob) {
            downloadBlob(editedPdfBlob, originalFilename.replace('.pdf', '_edited.pdf'));
        }
    });

    // Skip to Scanner - use original PDF
    const skipToScannerBtn = document.getElementById('skip-to-scanner-btn');
    skipToScannerBtn.addEventListener('click', async () => {
        if (!fileInput.files.length) {
            alert('Upload a PDF first');
            return;
        }

        const successHeader = successStage.querySelector('.success-header h3');
        if (fileInput.files.length === 1) {
            originalFilename = fileInput.files[0].name;
            editedPdfBlob = await fileInput.files[0].arrayBuffer().then(buf => new Blob([buf], { type: 'application/pdf' }));
            skippedFiles = [];
            btnDownloadEdited.classList.remove('hidden');
            successHeader.textContent = 'Ready to Convert to Scanned PDF';
        } else {
            originalFilename = '';
            editedPdfBlob = null;
            skippedFiles = Array.from(fileInput.files);
            btnDownloadEdited.classList.add('hidden');
            successHeader.textContent = `Ready to Convert ${skippedFiles.length} files to Scanned PDFs`;
        }

        editorSubmitBtn.parentElement.classList.add('hidden');
        successStage.classList.remove('hidden');
    });

    // Slider value updates
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            let suffix = '';
            if (e.target.name === 'skew_angle') suffix = '°';
            else if (e.target.name === 'blur_strength') suffix = ' px';
            e.target.nextElementSibling.textContent = e.target.value + suffix;
        });
    });

    // Toggle Image upload
    document.getElementById('add-image-cb').addEventListener('change', (e) => {
        const container = document.getElementById('image-upload-container');
        if (e.target.checked) container.classList.remove('hidden');
        else container.classList.add('hidden');
    });

    // Submit Converter (Add Noise to Replaced PDF)
    scannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editedPdfBlob && (!skippedFiles || skippedFiles.length === 0)) {
            alert('No PDF data to simulate.');
            return;
        }

        setLoading(converterSubmitBtn, true);

        const skew = scannerForm.querySelector('[name="skew"]').checked;
        const blur = scannerForm.querySelector('[name="blur"]').checked;
        const noise = scannerForm.querySelector('[name="noise"]').checked;
        const low_dpi = scannerForm.querySelector('[name="low_dpi"]').checked;
        const skew_angle = scannerForm.querySelector('[name="skew_angle"]').value;
        const blur_strength = scannerForm.querySelector('[name="blur_strength"]').value;
        const noise_intensity = scannerForm.querySelector('[name="noise_intensity"]').value;

        let overlayFile = null;
        const imgInput = scannerForm.querySelector('.image-file');
        if (scannerForm.querySelector('[name="add_image"]').checked && imgInput.files.length) {
            overlayFile = imgInput.files[0];
        }

        async function runSimulation(blobOrFile, filename) {
            const formData = new FormData();
            formData.append('file', blobOrFile, filename);
            formData.append('skew', skew);
            formData.append('blur', blur);
            formData.append('noise', noise);
            formData.append('low_dpi', low_dpi);
            formData.append('skew_angle', skew_angle);
            formData.append('blur_strength', blur_strength);
            formData.append('noise_intensity', noise_intensity);
            if (overlayFile) {
                formData.append('overlay_image', overlayFile);
            }

            const res = await fetch('/api/simulate-scan', { method: 'POST', body: formData });
            if (!res.ok) {
                let errMsg = `HTTP ${res.status}`;
                try { const j = await res.json(); errMsg = j.detail || JSON.stringify(j); } catch {}
                throw new Error(errMsg);
            }
            return await res.blob();
        }

        try {
            if (skippedFiles && skippedFiles.length > 0) {
                for (let i = 0; i < skippedFiles.length; i++) {
                    const file = skippedFiles[i];
                    setLoading(converterSubmitBtn, true, `Processing ${i + 1}/${skippedFiles.length}...`);
                    const scannedBlob = await runSimulation(file, file.name);
                    downloadBlob(scannedBlob, file.name.replace('.pdf', '_scanned.pdf'));
        
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            } else if (editedPdfBlob) {
                const scannedBlob = await runSimulation(editedPdfBlob, originalFilename);
                downloadBlob(scannedBlob, originalFilename.replace('.pdf', '_scanned.pdf'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(converterSubmitBtn, false, 'Generate & Download Scanned PDF');
        }
    });

    let combineFiles = [];
    let combineSegments = [];

    const combineUploadZone = document.getElementById('combine-upload-zone');
    combineUploadZone.addEventListener('click', () => combineFileInput.click());

    combineFileInput.addEventListener('change', (e) => {
        combineFiles = Array.from(e.target.files);
        combineSegments = combineFiles.map((f, i) => ({
            origIdx: i,
            pageSpec: 'all',
            fileType: f.type.startsWith('image/') ? 'image' : 'pdf'
        }));
        renderFileCards();
    });


    function saveCurrentSpecs() {
        combineFileList.querySelectorAll('.page-range-input').forEach((input, i) => {
            if (combineSegments[i]) combineSegments[i].pageSpec = input.value.trim() || 'all';
        });
    }

    function renderFileCards() {
        if (combineFiles.length === 0) {
            combineFileList.classList.add('hidden');
            combineSubmitBtn.disabled = true;
            combineFileList.innerHTML = '';
            return;
        }
        combineFileList.classList.remove('hidden');
        combineSubmitBtn.disabled = false;

        const last = combineSegments.length - 1;
        combineFileList.innerHTML = combineSegments.map(({ origIdx, pageSpec }, pos) => {
            const file = combineFiles[origIdx];
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            const isImage = file.type.startsWith('image/');
            const icon = isImage ? '🖼️' : '📄';
            const typeTag = isImage
                ? `<span class="file-type-badge file-type-image">IMAGE</span>`
                : `<span class="file-type-badge file-type-pdf">PDF</span>`;
            return `
            <div class="file-card" data-pos="${pos}">
                <div class="file-card-header">
                    <span class="file-card-name">${icon} ${file.name}</span>
                    ${typeTag}
                    <span class="file-card-size">${sizeMB} MB</span>
                    <div class="reorder-btns">
                        <button type="button" class="reorder-btn" title="Move up"
                            onclick="combineMove(${pos},-1)" ${pos === 0 ? 'disabled' : ''}>↑</button>
                        <button type="button" class="reorder-btn" title="Move down"
                            onclick="combineMove(${pos}, 1)" ${pos === last ? 'disabled' : ''}>↓</button>
                        <button type="button" class="reorder-btn" title="Duplicate this segment"
                            onclick="combineDuplicate(${pos})">⧉ Dup</button>
                        <button type="button" class="reorder-btn" title="Preview"
                            onclick="combinePreview(${origIdx})">👁 Preview</button>
                        <button type="button" class="reorder-btn reorder-btn--danger" title="Remove"
                            onclick="combineRemove(${pos})">✕</button>
                    </div>
                </div>
                ${!isImage ? `
                <div class="page-range-row">
                    <span class="page-range-label">Pages:</span>
                    <input type="text" class="page-range-input" placeholder="all"
                           value="${pageSpec}" title="e.g. 1-3, 5, 7-9">
                    <span class="page-range-hint">e.g. 1-3, 5</span>
                </div>` : `
                <div class="page-range-row" style="color:var(--text-muted);font-size:0.85rem;">
                    Image will be placed as a full page
                </div>`}
            </div>`;
        }).join('');
    }

    window.combineMove = function (pos, dir) {
        saveCurrentSpecs();
        const np = pos + dir;
        if (np < 0 || np >= combineSegments.length) return;
        [combineSegments[pos], combineSegments[np]] = [combineSegments[np], combineSegments[pos]];
        renderFileCards();
    };

    window.combineDuplicate = function (pos) {
        saveCurrentSpecs();
        const copy = { ...combineSegments[pos] };
        combineSegments.splice(pos + 1, 0, copy);
        renderFileCards();
    };

    window.combineRemove = function (pos) {
        saveCurrentSpecs();
        combineSegments.splice(pos, 1);
        renderFileCards();
    };

    window.combinePreview = function (origIdx) {
        const file = combineFiles[origIdx];
        if (!file) return;
        const blobUrl = URL.createObjectURL(file);
        const modal = document.getElementById('preview-modal');
        const iframe = document.getElementById('preview-iframe');
        const title = document.getElementById('preview-title');
        iframe.src = blobUrl;
        title.textContent = file.name;
        modal.classList.remove('hidden');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    };

    document.getElementById('preview-close').addEventListener('click', () => {
        const modal = document.getElementById('preview-modal');
        const iframe = document.getElementById('preview-iframe');
        iframe.src = '';
        modal.classList.add('hidden');
    });
    combinerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (combineFiles.length === 0 || combineSegments.length === 0) return;

        saveCurrentSpecs();
        setLoading(combineSubmitBtn, true);

        const fileOrder = combineSegments.map(s => s.origIdx);
        const pageSpecs = combineSegments.map(s => s.pageSpec);
        const fileTypes = combineFiles.map(f => f.type.startsWith('image/') ? 'image' : 'pdf');

        const formData = new FormData();
        combineFiles.forEach(file => formData.append('files', file));
        formData.append('file_order', JSON.stringify(fileOrder));
        formData.append('page_specs', JSON.stringify(pageSpecs));
        formData.append('file_types', JSON.stringify(fileTypes));

        try {
            const res = await fetch('/api/combine', { method: 'POST', body: formData });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Request failed');
            }
            downloadBlob(await res.blob(), 'combined_document.pdf');
        } catch (error) {
            console.error('Combine error:', error);
            alert('Error combining PDFs: ' + error.message);
        } finally {
            setLoading(combineSubmitBtn, false, 'Combine PDFs');
        }
    });

    // Helpers
    function setLoading(btn, isLoading, text = '') {
        const span = btn.querySelector('.btn-text');
        const spin = btn.querySelector('.spinner');
        if (isLoading) {
            span.textContent = 'Processing...';
            spin.classList.remove('hidden');
            btn.disabled = true;
        } else {
            span.textContent = text;
            spin.classList.add('hidden');
            btn.disabled = false;
        }
    }

    function downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }
});
