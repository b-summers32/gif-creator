// --- Library Imports & Setup ---
const { createFFmpeg, fetchFile } = FFmpeg;
const { jsPDF } = window.jspdf;

// --- DOM Elements ---
const fileInput = document.getElementById('file-input');
const actionArea = document.getElementById('action-area');
const statusDiv = document.getElementById('status');
const outputArea = document.getElementById('output-area');

// --- Global State ---
let ffmpeg = null;
let currentFile = null;

// --- FFmpeg Initialization ---
const initializeFFmpeg = async () => {
    if (ffmpeg) return; // Already initialized
    try {
        statusDiv.textContent = 'Initializing Advanced Engine...';
        ffmpeg = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
            mainName: 'main' 
        });
        await ffmpeg.load();
        statusDiv.textContent = 'Engine Ready.';
    } catch (error) {
        console.error("FFmpeg Init Error:", error);
        statusDiv.textContent = 'Engine failed to load. Refresh and try again.';
    }
};

// --- Helper: Status Updates ---
const setStatus = (msg, type = 'info') => {
    statusDiv.textContent = msg;
    statusDiv.className = type;
};

const setLoading = (isLoading, text = 'Processing...') => {
    const btns = document.querySelectorAll('button');
    btns.forEach(b => b.disabled = isLoading);
    setStatus(isLoading ? text : 'Ready');
};

// --- Helper: Create Download Link ---
const addDownloadLink = (url, filename, linkText = 'Download Result') => {
    const wrapper = document.createElement('div');
    wrapper.className = 'download-wrapper';
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.textContent = linkText;
    a.className = 'download-link';
    
    wrapper.appendChild(a);
    outputArea.appendChild(wrapper);
};

// --- Helper: Display Result ---
const displayResult = (blob, ext) => {
    const url = URL.createObjectURL(blob);
    outputArea.innerHTML += `<img src="${url}" class="preview-img">`;
    addDownloadLink(url, `converted-${Date.now()}.${ext}`);
    setLoading(false);
};

// --- CORE: File Handling ---
fileInput.addEventListener('change', async (e) => {
    currentFile = e.target.files[0];
    if (!currentFile) return;

    // Reset UI
    actionArea.innerHTML = '';
    outputArea.innerHTML = '';
    setStatus(`Selected: ${currentFile.name}`);

    const type = currentFile.type;
    const name = currentFile.name.toLowerCase();

    // 1. Video (MP4) -> GIF
    if (type === 'video/mp4') {
        createButton('Convert to GIF', handleVideoToGif);
        if (!ffmpeg) initializeFFmpeg();
    }
    // 2. HEIC -> PNG
    else if (type === 'image/heic' || name.endsWith('.heic')) {
        createButton('Convert HEIC to PNG', handleHeicToPng);
    }
    // 3. PDF -> Images
    else if (type === 'application/pdf') {
        createButton('Convert PDF to PNGs', () => handlePdfToImages('png'));
        createButton('Convert PDF to JPGs', () => handlePdfToImages('jpeg'));
    }
    // 4. Images (PNG/JPG) -> PDF or Swap Format
    else if (type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg') {
        // Format Swapping
        if (type === 'image/png') {
            createButton('Convert to JPG', () => handleImageToImage('image/jpeg', 'jpg'));
        } else {
            createButton('Convert to PNG', () => handleImageToImage('image/png', 'png'));
        }
        
        // PDF Conversion
        createButton('Convert to PDF', handleImageToPdf);
    } 
    else {
        setStatus('File type not supported.', 'error');
    }
});

const createButton = (text, onClick) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    actionArea.appendChild(btn);
};

// --- HANDLER: Video to GIF ---
const handleVideoToGif = async () => {
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        await initializeFFmpeg();
    }
    
    setLoading(true, 'Converting Video to GIF...');
    
    try {
        const inputFile = 'input.mp4';
        const outputFile = 'output.gif';
        
        ffmpeg.FS('writeFile', inputFile, await fetchFile(currentFile));

        // Run FFmpeg: generate palette for high quality
        await ffmpeg.run(
            '-i', inputFile, 
            '-filter_complex', 'fps=15,scale=480:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse', 
            '-f', 'gif', 
            outputFile
        );
        
        const data = ffmpeg.FS('readFile', outputFile);
        const blob = new Blob([data.buffer], { type: 'image/gif' });
        
        displayResult(blob, 'gif');
    } catch (e) {
        setLoading(false);
        setStatus(`Error: ${e.message}`, 'error');
    }
};

// --- HANDLER: HEIC to PNG (Robust with Fallback) ---
const handleHeicToPng = async () => {
    setLoading(true, 'Converting HEIC to PNG...');
    try {
        // Attempt 1: Try Standard Lightweight Converter
        const resultBlob = await heic2any({
            blob: currentFile,
            toType: "image/png",
        });

        const blob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
        displayResult(blob, 'png');

    } catch (e) {
        console.warn("Standard converter failed. Attempting advanced conversion...", e);
        setStatus('Standard method failed. Engaging heavy-duty engine (this takes a moment)...');
        
        // Attempt 2: Fallback to FFmpeg
        try {
            if (!ffmpeg || !ffmpeg.isLoaded()) {
                await initializeFFmpeg();
            }

            const inputFile = 'input.heic';
            const outputFile = 'output.png';

            // Write file to memory
            ffmpeg.FS('writeFile', inputFile, await fetchFile(currentFile));

            // Convert using FFmpeg
            await ffmpeg.run('-i', inputFile, outputFile);

            // Read result
            const data = ffmpeg.FS('readFile', outputFile);
            const blob = new Blob([data.buffer], { type: 'image/png' });

            displayResult(blob, 'png');
            
        } catch (ffmpegError) {
            console.error(ffmpegError);
            setLoading(false);
            setStatus(`Conversion Failed: This HEIC file format is not supported by the browser.`, 'error');
        }
    }
};

// --- HANDLER: Image to Image (JPG <-> PNG) ---
const handleImageToImage = async (targetMime, extension) => {
    setLoading(true, `Converting to ${extension.toUpperCase()}...`);
    
    try {
        const bmp = await createImageBitmap(currentFile);
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        
        const ctx = canvas.getContext('2d');
        // Fill white background for Transparent PNGs -> JPG
        if (targetMime === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(bmp, 0, 0);
        
        canvas.toBlob((blob) => {
            displayResult(blob, extension);
        }, targetMime, 0.9); // 0.9 quality for jpg
        
    } catch (e) {
        setLoading(false);
        setStatus(`Error: ${e.message}`, 'error');
    }
};

// --- HANDLER: Image to PDF ---
const handleImageToPdf = async () => {
    setLoading(true, 'Generating PDF...');
    try {
        const bmp = await createImageBitmap(currentFile);
        const doc = new jsPDF();
        
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;
        
        const imgRatio = bmp.width / bmp.height;
        let printWidth = pageWidth - (margin * 2);
        let printHeight = printWidth / imgRatio;
        
        if (printHeight > (pageHeight - (margin * 2))) {
            printHeight = pageHeight - (margin * 2);
            printWidth = printHeight * imgRatio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const imgData = canvas.toDataURL('image/jpeg');

        doc.addImage(imgData, 'JPEG', margin, margin, printWidth, printHeight);
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.className = 'preview-pdf';
        outputArea.appendChild(iframe);
        
        addDownloadLink(url, `converted-${Date.now()}.pdf`);
        setLoading(false);
    } catch (e) {
        setLoading(false);
        setStatus(`Error: ${e.message}`, 'error');
    }
};

// --- HANDLER: PDF to Images ---
const handlePdfToImages = async (format = 'png') => {
    setLoading(true, 'Extracting images from PDF...');
    outputArea.innerHTML = ''; 
    
    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const img = document.createElement('img');
                img.src = url;
                img.className = 'preview-img';
                img.style.display = 'block';
                img.style.marginBottom = '10px';
                
                outputArea.appendChild(img);
                addDownloadLink(url, `page-${pageNum}.${format}`, `Download Page ${pageNum}`);
            }, mime);
        }
        
        setLoading(false);
    } catch (e) {
        setLoading(false);
        setStatus(`Error: ${e.message}`, 'error');
    }
};
