// Destructure the FFmpeg global provided by the script tag in index.html
const { createFFmpeg, fetchFile } = FFmpeg;

// Select HTML elements
const videoInput = document.getElementById('video-input');
const convertBtn = document.getElementById('convert-btn');
const statusDiv = document.getElementById('status');
const outputArea = document.getElementById('output-area');

// Global instance
let ffmpeg = null;

// --- Initialization Function ---
const initializeFFmpeg = async () => {
    try {
        statusDiv.textContent = 'Initializing FFmpeg... (This may take a few seconds)';
        
        // FIX: Initialize using the Single-Threaded core (core-st).
        // This version does NOT require special server headers (COOP/COEP) and works on any hosting.
        ffmpeg = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
        });

        await ffmpeg.load();
        
        statusDiv.textContent = 'Ready! Upload an MP4 file.';
        
        if (videoInput.files.length > 0) {
            convertBtn.disabled = false;
        }

    } catch (error) {
        statusDiv.textContent = `Initialization Failed: ${error.message}`;
        console.error("Init Error:", error);
    }
};

// --- Conversion Function ---
const convertToGif = async () => {
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        statusDiv.textContent = 'FFmpeg is not ready. Try refreshing the page.';
        return;
    }

    outputArea.innerHTML = '';
    const file = videoInput.files[0];
    if (!file) {
        statusDiv.textContent = 'Please select an MP4 file first.';
        return;
    }
    
    convertBtn.disabled = true;
    convertBtn.textContent = 'Converting...';

    // --- 1. Write File ---
    statusDiv.textContent = 'Reading video file...';
    try {
        const inputFile = 'input.mp4';
        const outputFile = 'output.gif';
        
        // Write the file to memory
        ffmpeg.FS('writeFile', inputFile, await fetchFile(file));

        // --- 2. Run Conversion ---
        statusDiv.textContent = 'Converting... (This is slower in single-threaded mode, please be patient)';
        
        // Run FFmpeg command
        // -vf fps=10,scale=320:-1 : Lower FPS/Resolution is recommended for single-threaded performance
        await ffmpeg.run('-i', inputFile, '-vf', 'fps=10,scale=320:-1', '-f', 'gif', outputFile);
        
        // --- 3. Read Output ---
        statusDiv.textContent = 'Reading output GIF...';
        const data = ffmpeg.FS('readFile', outputFile);
        
        // --- 4. Display ---
        const blob = new Blob([data.buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        
        outputArea.innerHTML += `<img src="${url}" alt="Converted GIF" class="converted-gif">`;
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `converted-${file.name.split('.')[0] || 'video'}.gif`;
        downloadLink.textContent = 'Click to Download GIF';
        downloadLink.className = 'download-link';
        outputArea.appendChild(downloadLink);

        statusDiv.textContent = 'Conversion successful!';
    } catch (e) {
        statusDiv.textContent = `Conversion Failed: ${e.message}`;
        console.error(e);
    } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert to GIF';
    }
};

// --- Event Listeners ---
videoInput.addEventListener('change', () => {
    if (videoInput.files.length > 0 && statusDiv.textContent.includes('Ready')) {
        convertBtn.disabled = false;
    }
});

convertBtn.addEventListener('click', convertToGif);

// Start
initializeFFmpeg();