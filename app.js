// FIX: Import FFmpeg and utilities directly from the ESM build on unpkg
// This matches the <script type="module"> in your index.html
import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/esm/index.js';
import { toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

// Global instance for FFmpeg
let ffmpeg;

// Select HTML elements
const videoInput = document.getElementById('video-input');
const convertBtn = document.getElementById('convert-btn');
const statusDiv = document.getElementById('status');
const outputArea = document.getElementById('output-area');

// --- Initialization Function ---
const initializeFFmpeg = async () => {
    try {
        statusDiv.textContent = 'Initializing FFmpeg... (This may take a few seconds)';
        
        ffmpeg = new FFmpeg();

        // Listen for log messages
        ffmpeg.on('log', ({ message }) => {
             console.log('[FFmpeg Log]:', message);
        });

        // Define the base URL for the core files
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.7/dist/esm';

        // Load the core FFmpeg files using toBlobURL to prevent loading errors
        // We use toBlobURL to bypass some strict browser security restrictions on loading scripts
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        statusDiv.textContent = 'Ready! Upload an MP4 file.';
        
        // Re-check input in case user added file while loading
        if (videoInput && videoInput.files.length > 0) {
            convertBtn.disabled = false;
        }

    } catch (error) {
        statusDiv.textContent = `Error during initialization: ${error.message}. Please check console.`;
        console.error("Initialization error:", error);
    }
};

// --- Conversion Function ---
const convertToGif = async () => {
    if (!ffmpeg) {
        statusDiv.textContent = 'FFmpeg is still initializing. Please wait.';
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

    // --- 1. Load File Data ---
    statusDiv.textContent = 'Reading video file...';
    try {
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        
        const inputFile = 'input.mp4';
        const outputFile = 'output.gif';
        
        // --- 2. Write to FFmpeg VFS ---
        statusDiv.textContent = 'Writing file to memory...';
        await ffmpeg.writeFile(inputFile, new Uint8Array(data));

        // --- 3. Run Conversion Command ---
        // -vf fps=15,scale=320:-1 : Reduce FPS to 15 and width to 320px for WebAssembly performance
        statusDiv.textContent = 'Converting video (this may take a moment)...';
        
        const command = [
            '-i', inputFile,
            '-vf', 'fps=15,scale=320:-1', 
            '-f', 'gif',
            outputFile
        ];
        
        await ffmpeg.exec(command);
        
        // --- 4. Read Output GIF ---
        statusDiv.textContent = 'Reading output GIF...';
        const outputData = await ffmpeg.readFile(outputFile);
        
        // --- 5. Display Result ---
        const blob = new Blob([outputData.buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        
        outputArea.innerHTML += `<img src="${url}" alt="Converted GIF" class="converted-gif">`;
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `converted-${file.name.split('.')[0] || 'video'}.gif`;
        downloadLink.textContent = 'Click to Download GIF';
        downloadLink.className = 'download-link';
        outputArea.appendChild(downloadLink);

        statusDiv.textContent = 'Conversion successful! Check below to download.';
    } catch (e) {
        statusDiv.textContent = `Conversion Failed! Error: ${e.message}`;
        console.error(e);
    } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert to GIF';
    }
};

// --- Event Listeners ---
if (videoInput) {
    videoInput.addEventListener('change', () => {
        // Only enable if ffmpeg is loaded
        if (videoInput.files.length > 0 && statusDiv.textContent.includes('Ready')) {
            convertBtn.disabled = false;
        }
    });
}

if (convertBtn) {
    convertBtn.addEventListener('click', convertToGif);
}

// Start initialization
initializeFFmpeg();