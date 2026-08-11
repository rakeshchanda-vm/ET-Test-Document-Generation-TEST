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
            fileName.textContent = fileInput.files[0].name;
            dropZone.style.borderColor = 'var(--primary)';
            // Hide success stage if they upload a new file
            successStage.classList.add('hidden');
            editorSubmitBtn.parentElement.classList.remove('hidden');
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
        `;
        rowsContainer.appendChild(row);
    });

    // Submit Replace
    editorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fileInput.files.length) { alert('Upload a PDF'); return; }

        originalFilename = fileInput.files[0].name;

        const oldTexts = editorForm.querySelectorAll('.old-text');
        const newTexts = editorForm.querySelectorAll('.new-text');
        const rep = {};
        for(let i=0; i<oldTexts.length; i++){
            if(oldTexts[i].value) rep[oldTexts[i].value] = newTexts[i].value;
        }

        setLoading(editorSubmitBtn, true);
        successStage.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('replacements', JSON.stringify(rep));

        try {
            const res = await fetch('/api/replace', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Request failed');
            editedPdfBlob = await res.blob();
            
            // Show success stage
            editorSubmitBtn.parentElement.classList.add('hidden');
            successStage.classList.remove('hidden');
            
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(editorSubmitBtn, false, 'Replace Text');
        }
    });

    // Download Clean Edited PDF
    btnDownloadEdited.addEventListener('click', () => {
        if(editedPdfBlob) {
            downloadBlob(editedPdfBlob, originalFilename.replace('.pdf', '_edited.pdf'));
        }
    });

    // Slider value updates
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            let suffix = '';
            if(e.target.name === 'skew_angle') suffix = '°';
            else if(e.target.name === 'blur_strength') suffix = ' px';
            e.target.nextElementSibling.textContent = e.target.value + suffix;
        });
    });

    // Toggle Image upload
    document.getElementById('add-image-cb').addEventListener('change', (e) => {
        const container = document.getElementById('image-upload-container');
        if(e.target.checked) container.classList.remove('hidden');
        else container.classList.add('hidden');
    });

    // Submit Converter (Add Noise to Replaced PDF)
    scannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editedPdfBlob) return;

        setLoading(converterSubmitBtn, true);

        const formData = new FormData();
        // Send the edited PDF blob, not the original file!
        formData.append('file', editedPdfBlob, originalFilename);
        formData.append('skew', scannerForm.querySelector('[name="skew"]').checked);
        formData.append('blur', scannerForm.querySelector('[name="blur"]').checked);
        formData.append('noise', scannerForm.querySelector('[name="noise"]').checked);
        formData.append('low_dpi', scannerForm.querySelector('[name="low_dpi"]').checked);
        
        formData.append('skew_angle', scannerForm.querySelector('[name="skew_angle"]').value);
        formData.append('blur_strength', scannerForm.querySelector('[name="blur_strength"]').value);
        formData.append('noise_intensity', scannerForm.querySelector('[name="noise_intensity"]').value);
        
        const imgInput = scannerForm.querySelector('.image-file');
        if (scannerForm.querySelector('[name="add_image"]').checked && imgInput.files.length) {
            formData.append('overlay_image', imgInput.files[0]);
        }

        try {
            const res = await fetch('/api/simulate-scan', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Request failed');
            const scannedBlob = await res.blob();
            downloadBlob(scannedBlob, originalFilename.replace('.pdf', '_scanned.pdf'));
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(converterSubmitBtn, false, 'Generate & Download Scanned PDF');
        }
    });

    // Combiner Logic
    let combineFiles = [];
    const combineUploadZone = document.getElementById('combine-upload-zone');
    
    combineUploadZone.addEventListener('click', () => combineFileInput.click());
    
    combineFileInput.addEventListener('change', (e) => {
        combineFiles = Array.from(e.target.files);
        updateCombineFileList();
    });
    
    function updateCombineFileList() {
        if(combineFiles.length > 0) {
            combineFileList.classList.remove('hidden');
            combineSubmitBtn.disabled = false;
            
            combineFileList.innerHTML = combineFiles.map(file => `
                <div class="file-list-item">
                    <span class="file-list-name">📄 ${file.name}</span>
                    <span class="file-list-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
            `).join('');
        } else {
            combineFileList.classList.add('hidden');
            combineSubmitBtn.disabled = true;
            combineFileList.innerHTML = '';
        }
    }
    
    combinerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(combineFiles.length === 0) return;
        
        setLoading(combineSubmitBtn, true);
        
        const formData = new FormData();
        combineFiles.forEach(file => {
            formData.append('files', file);
        });
        
        try {
            const res = await fetch('/api/combine', { method: 'POST', body: formData });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Request failed');
            }
            
            const blob = await res.blob();
            downloadBlob(blob, "combined_document.pdf");
            
            alert('PDFs combined successfully!');
            
        } catch (error) {
            console.error('Combine error:', error);
            alert('Error combining PDFs: ' + error.message);
        } finally {
            setLoading(combineSubmitBtn, false, 'Combine PDFs');
        }
    });

    // Helpers
    function setLoading(btn, isLoading, text='') {
        const span = btn.querySelector('.btn-text');
        const spin = btn.querySelector('.spinner');
        if(isLoading) {
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
