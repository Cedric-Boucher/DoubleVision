<script lang="ts">
	// 1. Explicit TypeScript interfaces
	interface ProcessedImage {
		bitmap: ImageBitmap;
		orientation: number;
		actualWidth: number;  // The width after orientation is applied
		actualHeight: number; // The height after orientation is applied
	}

	// 2. Svelte 5 Runes with explicit generic types
	let leftImage = $state<ProcessedImage | null>(null);
	let rightImage = $state<ProcessedImage | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);

	let isSwapped = $state<boolean>(false);
	let quality = $state<number>(100);
	let isGenerating = $state<boolean>(false);

	// 3. Robust binary parser to extract EXIF orientation (Bypasses browser decoder failures)
	async function getExifOrientation(file: File): Promise<number> {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = function(e: ProgressEvent<FileReader>) {
				const buffer = e.target?.result as ArrayBuffer;
				if (!buffer) return resolve(1);

				const view = new DataView(buffer);
				if (view.getUint16(0, false) !== 0xFFD8) return resolve(1); // Not a valid JPEG

				const length = view.byteLength;
				let offset = 2;

				while (offset < length) {
					const marker = view.getUint16(offset, false);

					// Stop searching if we hit the actual image data (Start of Scan)
					if (marker === 0xFFDA || (marker & 0xFF00) !== 0xFF00) {
						break;
					}

					// If it's an APP1 Marker (0xFFE1)
					if (marker === 0xFFE1) {
						const segmentLength = view.getUint16(offset + 2, false);

						// Check if the identifier inside this APP1 block is "Exif\0\0"
						if (view.getUint32(offset + 4, false) === 0x45786966) {
							const tiffStart = offset + 10;
							const littleEndian = view.getUint16(tiffStart, false) === 0x4949;
							const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
							const tagsCount = view.getUint16(tiffStart + ifd0Offset, littleEndian);
							const tagsStart = tiffStart + ifd0Offset + 2;

							// Loop through the tags to find Orientation (0x0112)
							for (let i = 0; i < tagsCount; i++) {
								const tagId = view.getUint16(tagsStart + (i * 12), littleEndian);
								if (tagId === 0x0112) {
									return resolve(view.getUint16(tagsStart + (i * 12) + 8, littleEndian));
								}
							}
							return resolve(1); // Found EXIF but no orientation tag
						}

						// It was an APP1 block, but NOT Exif (likely Ultra HDR/XMP data).
						// Safely skip the entire block and keep looking.
						offset += segmentLength + 2;
					} else {
						// For all other markers (APP0, APP2, etc.), skip over them.
						// FIX: Explicitly add the 2 bytes for the marker itself so we don't misalign!
						offset += view.getUint16(offset + 2, false) + 2;
					}
				}
				return resolve(1); // Default to normal orientation if nothing is found
			};

			// Read the first 128KB to safely bypass large HDR blocks and find EXIF
			reader.readAsArrayBuffer(file.slice(0, 131072));
		});
	}

	// 4. File upload handler with explicit Event typing
	async function handleImageUpload(event: Event, side: 'left' | 'right'): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			// Extract the EXIF tag manually
			const orientation = await getExifOrientation(file);

			// Force the browser to leave the raw pixels alone
			const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });

			// Swap width and height if the image is rotated 90 degrees
			const isRotated = orientation === 6 || orientation === 8;
			const actualWidth = isRotated ? bitmap.height : bitmap.width;
			const actualHeight = isRotated ? bitmap.width : bitmap.height;

			const processedData: ProcessedImage = {
				bitmap,
				orientation,
				actualWidth,
				actualHeight
			};

			if (side === 'left' && leftImage?.bitmap) {
				leftImage.bitmap.close();
			} else if (side === 'right' && rightImage?.bitmap) {
				rightImage.bitmap.close();
			}

			if (side === 'left') {
				leftImage = processedData;
			} else {
				rightImage = processedData;
			}
		} catch (error) {
			console.error("Error processing image orientation:", error);
			alert("Failed to process image. Please try another file.");
		}
	}

	// 5. Canvas drawing logic that mathematically handles rotation
	function drawOrientedImage(
		ctx: CanvasRenderingContext2D,
		img: ProcessedImage,
		x: number,
		y: number
	): void {
		ctx.save();
		const { bitmap, orientation, actualWidth, actualHeight } = img;

		// Apply translations and rotations based on EXIF data
		if (orientation === 6) { // 90° Clockwise
			ctx.translate(x + actualWidth, y);
			ctx.rotate(90 * Math.PI / 180);
			ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
		} else if (orientation === 8) { // 90° Counter-Clockwise
			ctx.translate(x, y + actualHeight);
			ctx.rotate(-90 * Math.PI / 180);
			ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
		} else if (orientation === 3) { // 180° Upside Down
			ctx.translate(x + actualWidth, y + actualHeight);
			ctx.rotate(180 * Math.PI / 180);
			ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
		} else { // Normal
			ctx.drawImage(bitmap, x, y, bitmap.width, bitmap.height);
		}

		ctx.restore();
	}

	// 6. Reactive drawing effect
	$effect(() => {
		if (leftImage && rightImage && canvas) {
			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			const img1 = isSwapped ? rightImage : leftImage;
			const img2 = isSwapped ? leftImage : rightImage;

			// Use our calculated actual dimensions
			canvas.width = img1.actualWidth + img2.actualWidth;
			canvas.height = Math.max(img1.actualHeight, img2.actualHeight);

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Draw left image, then right image offset by the first image's actual width
			drawOrientedImage(ctx, img1, 0, 0);
			drawOrientedImage(ctx, img2, img1.actualWidth, 0);
		}
	});

	// 7. Explicitly typed export function
	function downloadImage(): void {
		if (!canvas) return;
		isGenerating = true;

		canvas.toBlob((blob: Blob | null) => {
			if (!blob) {
				alert("Failed to process image.");
				isGenerating = false;
				return;
			}

			const link = document.createElement('a');
			link.download = `DoubleVision-WebP-${Date.now()}.webp`;
			link.href = URL.createObjectURL(blob);
			link.click();

			URL.revokeObjectURL(link.href);
			isGenerating = false;
		}, 'image/webp', quality / 100);
	}
</script>

<main>
	<h1>Double Vision</h1>

	<div class="controls">
		<div class="upload-box">
			<label>Left Image:</label>
			<input type="file" accept="image/*" onchange={(e) => handleImageUpload(e, 'left')} />
		</div>
		<div class="upload-box">
			<label>Right Image:</label>
			<input type="file" accept="image/*" onchange={(e) => handleImageUpload(e, 'right')} />
		</div>
	</div>

	<div class="settings">
		<label class="toggle">
			<input type="checkbox" bind:checked={isSwapped} />
			Swap Left / Right
		</label>

		<label class="slider">
			WebP Quality: {quality}%
			<input type="range" min="0" max="100" step="1" bind:value={quality} />
		</label>

		<button onclick={downloadImage} disabled={!leftImage || !rightImage || isGenerating}>
			{isGenerating ? 'Processing...' : 'Save 3D Image'}
		</button>
	</div>

	<div class="preview-container">
		<p>Preview</p>
		<canvas bind:this={canvas}></canvas>
	</div>
</main>

<style>
	main { max-width: 900px; margin: 0 auto; padding: 20px; font-family: system-ui, sans-serif; text-align: center; }
	.controls { display: flex; justify-content: center; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
	.upload-box { border: 2px dashed #ccc; padding: 20px; border-radius: 8px; flex: 1; min-width: 250px;}
	.settings { display: flex; justify-content: center; gap: 30px; margin: 20px 0; align-items: center; flex-wrap: wrap; background: #f8f9fa; padding: 15px; border-radius: 8px; }
	.toggle, .slider { display: flex; align-items: center; gap: 10px; font-weight: 500;}
	canvas { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
	button { padding: 10px 20px; font-size: 16px; font-weight: bold; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; transition: 0.2s;}
	button:hover:not(:disabled) { background: #0056b3; }
	button:disabled { background: #ccc; cursor: not-allowed; }
	.preview-container { margin-top: 30px; }
	.preview-container p { color: #666; font-size: 0.9em; margin-bottom: 10px; }
</style>
