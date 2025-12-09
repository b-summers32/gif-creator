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
        
        // FIX: Added mainName: 'main'
        // This tells the wrapper to use the single-threaded entry point ('main') 
        // instead of the multi-threaded default ('proxy_main').
        ffmpeg = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
            mainName: 'main' 
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
        statusDiv.textContent = 'Converting... (High Quality mode: Generating palette, this takes longer)';
        
        // Run FFmpeg command with Palette Generation
        // Breakdown:
        // fps=15,scale=480:-1:flags=lanczos : Set FPS to 15, Width to 480px, use high-quality scaling
        // split[s0][s1] : Split the video stream into two identical streams
        // [s0]palettegen[p] : Use the first stream to generate a custom color palette [p]
        // [s1][p]paletteuse : Use the second stream and the palette [p] to render the final GIF
        await ffmpeg.run(
            '-i', inputFile, 
            '-filter_complex', 'fps=15,scale=480:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse', 
            '-f', 'gif', 
            outputFile
        );
        
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
