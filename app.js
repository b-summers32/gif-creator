// Global instance for FFmpeg
let ffmpeg;

// Select HTML elements
const videoInput = document.getElementById('video-input');
const convertBtn = document.getElementById('convert-btn');
const statusDiv = document.getElementById('status');
const outputArea = document.getElementById('output-area');

// --- Initialization Function ---
// Sets up the FFmpeg environment using WebAssembly.
const initializeFFmpeg = async () => {
    try {
        statusDiv.textContent = 'Initializing FFmpeg... (This may take a few seconds)';
        
        // FIX: The UMD build of @ffmpeg/ffmpeg 0.12.x exposes a global object named 'FFmpegWASM'.
        // We must destructure the FFmpeg class from it.
        const { FFmpeg } = FFmpegWASM;
        
        ffmpeg = new FFmpeg();

        // Optional: Listen for log messages from FFmpeg for debugging
        ffmpeg.on('log', ({ message }) => {
             console.log('[FFmpeg Log]:', message);
        });

        // Load the core FFmpeg files. 
        // We explicitly provide both coreURL and wasmURL to ensure they are found correctly on the CDN.
        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.7/dist/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.7/dist/ffmpeg-core.wasm'
        });
        
        statusDiv.textContent = 'Ready! Upload an MP4 file.';
        
    } catch (error) {
        statusDiv.textContent = `Error during initialization: ${error.message}. Please check console.`;
        console.error("Initialization error:", error);
    }
};

// --- Conversion Function ---
const convertToGif = async () => {
    // Guard clause to prevent running without initialization
    if (!ffmpeg) {
        statusDiv.textContent = 'FFmpeg is still initializing. Please wait.';
        return;
    }

    // Clear previous output
    outputArea.innerHTML = '';
    
    const file = videoInput.files[0];
    if (!file) {
        statusDiv.textContent = 'Please select an MP4 file first.';
        return;
    }
    
    // Disable button and start progress
    convertBtn.disabled = true;
    convertBtn.textContent = 'Converting...';

    // --- 1. Load File Data ---
    statusDiv.textContent = 'Reading video file...';
    try {
        // Read the file data into an ArrayBuffer
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        
        const inputFile = 'input.mp4';
        const outputFile = 'output.gif';
        
        // --- 2. Write to FFmpeg Virtual File System (VFS) ---
        statusDiv.textContent = 'Writing file to memory...';
        // Write the video file data to FFmpeg's in-memory file system
        await ffmpeg.writeFile(inputFile, new Uint8Array(data));

        // --- 3. Run Conversion Command ---
        statusDiv.textContent = 'Converting video (lower FPS and resolution used to keep file size small)...';
        
        const command = [
            '-i', inputFile,
            '-vf', 'fps=15,scale=320:-1', 
            outputFile
        ];
        
        await ffmpeg.exec(command);
        
        // --- 4. Read Output GIF ---
        statusDiv.textContent = 'Reading output GIF...';
        // Read the converted GIF data from the VFS
        const outputData = await ffmpeg.readFile(outputFile);
        
        // --- 5. Create Download Link and Display ---
        const blob = new Blob([outputData.buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        
        // Display the GIF preview
        outputArea.innerHTML += `<img src="${url}" alt="Converted GIF" class="converted-gif">`;
        
        // Create the download link
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

// Enable the convert button when a file is selected
videoInput.addEventListener('change', () => {
    if (videoInput.files.length > 0) {
        convertBtn.disabled = false;
    } else {
        convertBtn.disabled = true;
    }
});

convertBtn.addEventListener('click', convertToGif);

// Start the application by initializing FFmpeg
initializeFFmpeg();
