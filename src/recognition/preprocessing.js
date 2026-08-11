// ============================================
// IMAGE PREPROCESSING
// Apply adjustments to improve glyph detection
// ============================================

const Preprocessing = {
    /**
     * Apply preprocessing pipeline to source image
     * @param {cv.Mat} sourceMat - Source OpenCV Mat
     * @param {Object} settings - Preprocessing settings
     * @returns {cv.Mat} Preprocessed Mat
     */
    processImageWithSettings: (sourceMat, settings) => {
        if (!sourceMat || sourceMat.empty()) {
            throw new Error('Invalid source image for preprocessing');
        }

        let processed = sourceMat.clone();

        try {
            // 1. Rotation
            if (settings.rotation && settings.rotation !== 0) {
                const rotated = Preprocessing.rotateImage(processed, settings.rotation);
                processed.delete();
                processed = rotated;
            }

            // 2. Convert to grayscale — OR extract the pigment channel for color isolation.
            // Color isolation (decorrelation stretch on the Lab a* red–green axis) separates red
            // ochre glyphs from textured rock far better than luminance, since rock texture is
            // mostly a brightness variation and barely registers on the colour axis.
            let gray = new cv.Mat();
            if (settings.colorIsolation && processed.channels() > 1) {
                gray = Preprocessing.extractPigmentChannel(processed, settings.colorStrength);
            } else if (processed.channels() > 1) {
                cv.cvtColor(processed, gray, cv.COLOR_RGBA2GRAY);
            } else {
                gray = processed.clone();
            }
            processed.delete();
            processed = gray;

            // 3. Gaussian blur (if enabled)
            if (settings.gaussianBlur && settings.gaussianBlur > 0) {
                const blurred = new cv.Mat();
                const ksize = Math.max(3, settings.gaussianBlur * 2 + 1); // Ensure odd kernel size
                cv.GaussianBlur(processed, blurred, new cv.Size(ksize, ksize), 0);
                processed.delete();
                processed = blurred;
            }

            // 4. Thresholding
            const thresholded = new cv.Mat();
            if (settings.useAdaptiveThreshold) {
                // Adaptive thresholding
                const blockSize = Math.max(3, settings.blockSize || 11);
                const C = settings.constantOffset || 2;
                cv.adaptiveThreshold(
                    processed, 
                    thresholded, 
                    255, 
                    cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
                    cv.THRESH_BINARY, 
                    blockSize, 
                    C
                );
            } else {
                // Otsu's thresholding
                cv.threshold(processed, thresholded, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
            }
            processed.delete();
            processed = thresholded;

            // 5. Morphological operations
            if (settings.morphologyOperation && settings.morphologyOperation !== 'none') {
                const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
                const morphed = new cv.Mat();
                
                switch (settings.morphologyOperation) {
                    case 'dilate':
                        cv.dilate(processed, morphed, kernel);
                        break;
                    case 'erode':
                        cv.erode(processed, morphed, kernel);
                        break;
                    case 'open':
                        cv.morphologyEx(processed, morphed, cv.MORPH_OPEN, kernel);
                        break;
                    case 'close':
                        cv.morphologyEx(processed, morphed, cv.MORPH_CLOSE, kernel);
                        break;
                    default:
                        morphed = processed.clone();
                }
                
                kernel.delete();
                processed.delete();
                processed = morphed;
            }

            // 6. Invert colors if needed
            if (settings.invertColors) {
                const inverted = new cv.Mat();
                cv.bitwise_not(processed, inverted);
                processed.delete();
                processed = inverted;
            }

            return processed;

        } catch (error) {
            console.error('Preprocessing error:', error);
            if (processed) processed.delete();
            throw error;
        }
    },

    /**
     * Extract a "pigment" channel that isolates coloured glyphs (default: red ochre) from
     * textured rock, using the Lab a* (red–green) axis with a decorrelation-style contrast
     * stretch. Returns a single-channel Mat where pigment is DARK (matching the ink-on-light
     * convention the rest of the pipeline expects).
     * @param {cv.Mat} mat - source colour Mat (RGBA or RGB)
     * @param {number} strength - 0..100, how aggressively to stretch the colour separation
     * @returns {cv.Mat} single-channel 8-bit Mat
     */
    extractPigmentChannel: (mat, strength) => {
        // Normalise to 3-channel RGB
        const rgb = new cv.Mat();
        if (mat.channels() === 4) {
            cv.cvtColor(mat, rgb, cv.COLOR_RGBA2RGB);
        } else if (mat.channels() === 3) {
            mat.copyTo(rgb);
        } else {
            rgb.delete();
            return mat.clone(); // already single channel — nothing to isolate
        }

        // Convert to CIE Lab; the a* channel is the red(+)/green(-) axis
        const lab = new cv.Mat();
        cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
        rgb.delete();

        const channels = new cv.MatVector();
        cv.split(lab, channels);
        lab.delete();
        const L = channels.get(0);
        const a = channels.get(1); // a* — red pigment sits high, neutral rock near 128
        const b = channels.get(2);

        // Decorrelation-style stretch: expand contrast about the neutral point (128).
        // gain ranges 1 (no stretch) → ~4 (aggressive), driven by strength.
        const s = Math.max(0, Math.min(100, (typeof strength === 'number' ? strength : 50)));
        const gain = 1 + (s / 100) * 3;
        const stretched = new cv.Mat();
        // convertTo computes: dst = a*gain + (128 - 128*gain) = (a - 128)*gain + 128  (saturated 0..255)
        a.convertTo(stretched, cv.CV_8U, gain, 128 - 128 * gain);

        L.delete();
        a.delete();
        b.delete();
        channels.delete();

        // Red pigment is now bright; invert so pigment is dark (ink-on-light convention)
        const out = new cv.Mat();
        cv.bitwise_not(stretched, out);
        stretched.delete();
        return out;
    },

    /**
     * Rotate image by angle
     * @param {cv.Mat} image - Image to rotate
     * @param {number} angle - Angle in degrees
     * @returns {cv.Mat} Rotated image
     */
    rotateImage: (image, angle) => {
        const center = new cv.Point(image.cols / 2, image.rows / 2);
        const rotationMatrix = cv.getRotationMatrix2D(center, angle, 1.0);
        
        // Calculate new bounding dimensions
        const radians = Math.abs(angle) * Math.PI / 180;
        const sin = Math.sin(radians);
        const cos = Math.cos(radians);
        const newWidth = Math.round(image.cols * cos + image.rows * sin);
        const newHeight = Math.round(image.cols * sin + image.rows * cos);
        
        // Adjust rotation matrix for new dimensions
        const ptr02 = rotationMatrix.doublePtr(0, 2);
        ptr02[0] = ptr02[0] + (newWidth / 2) - center.x;
        const ptr12 = rotationMatrix.doublePtr(1, 2);
        ptr12[0] = ptr12[0] + (newHeight / 2) - center.y;
        
        const rotated = new cv.Mat();
        cv.warpAffine(
            image, 
            rotated, 
            rotationMatrix, 
            new cv.Size(newWidth, newHeight),
            cv.INTER_LINEAR,
            cv.BORDER_CONSTANT,
            new cv.Scalar(255, 255, 255, 255)
        );
        
        rotationMatrix.delete();
        return rotated;
    },

    /**
     * Apply preprocessing to canvas element
     * @param {HTMLCanvasElement} sourceCanvas - Source canvas
     * @param {Object} settings - Preprocessing settings
     * @returns {HTMLCanvasElement} Preprocessed canvas
     */
    applyToCanvas: (sourceCanvas, settings) => {
        const sourceMat = cv.imread(sourceCanvas);
        const processed = Preprocessing.processImageWithSettings(sourceMat, settings);
        
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = processed.cols;
        outputCanvas.height = processed.rows;
        cv.imshow(outputCanvas, processed);
        
        sourceMat.delete();
        processed.delete();
        
        return outputCanvas;
    },

    /**
     * Convert preprocessed canvas to data URL
     * @param {HTMLCanvasElement} canvas - Canvas to convert
     * @returns {string} Data URL
     */
    canvasToDataUrl: (canvas) => {
        return canvas.toDataURL('image/png');
    },

    /**
     * Create preview of preprocessing settings
     * @param {string} imageDataUrl - Original image data URL
     * @param {Object} settings - Preprocessing settings
     * @returns {Promise<string>} Preview image data URL
     */
    createPreview: async (imageDataUrl, settings) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const preprocessedCanvas = Preprocessing.applyToCanvas(canvas, settings);
                    resolve(preprocessedCanvas.toDataURL('image/png'));
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = reject;
            img.src = imageDataUrl;
        });
    },

    /**
     * Get default preprocessing settings
     * @returns {Object} Default settings
     */
    getDefaultSettings: () => {
        return { ...CONFIG.PREPROCESSING };
    },

    /**
     * Validate preprocessing settings
     * @param {Object} settings - Settings to validate
     * @returns {Object} Validated settings
     */
    validateSettings: (settings) => {
        const validated = { ...Preprocessing.getDefaultSettings(), ...settings };
        
        // Ensure valid ranges
        validated.rotation = Math.max(-45, Math.min(45, validated.rotation || 0));
        validated.blockSize = Math.max(3, Math.min(99, validated.blockSize || 11));
        if (validated.blockSize % 2 === 0) validated.blockSize += 1; // Must be odd
        validated.constantOffset = Math.max(-10, Math.min(10, validated.constantOffset || 2));
        validated.gaussianBlur = Math.max(0, Math.min(10, validated.gaussianBlur || 0));
        
        return validated;
    }
};

// Make globally available
window.Preprocessing = Preprocessing;
