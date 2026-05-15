<script>
	// Svelte 5 Runes for state management
	let leftImage = $state(null);
	let rightImage = $state(null);
	let canvas = $state(null);

	// New user toggles and settings
	let isSwapped = $state(false);
	let quality = $state(100);
	let isGenerating = $state(false);

	// Load the image files
	async function handleImageUpload(event, side) {
		const file = event.target.files[0];
		if (!file) return;

		try {
			// createImageBitmap processes the raw file and explicitly applies EXIF orientation
			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

			if (side === 'left') {
				leftImage = bitmap;
			} else {
				rightImage = bitmap;
			}
		} catch (error) {
			console.error("Error processing image orientation:", error);
			alert("Failed to process image. Please try another file.");
		}
	}

	$effect(() => {
		if (leftImage && rightImage && canvas) {
			const ctx = canvas.getContext('2d');

			// Determine which image goes on which side
			const img1 = isSwapped ? rightImage : leftImage;
			const img2 = isSwapped ? leftImage : rightImage;

			// FIX: ImageBitmap uses .width and .height, NOT .naturalWidth
			const width1 = img1.width;
			const height1 = img1.height;
			const width2 = img2.width;
			const height2 = img2.height;

			// The final image width is the sum of both; the height is the max of the two
			canvas.width = width1 + width2;
			canvas.height = Math.max(height1, height2);

			// Clear and draw
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img1, 0, 0);
			ctx.drawImage(img2, width1, 0);
		}
	});

	// Export the canvas natively without auto-downloading until clicked
	function downloadImage() {
		if (!canvas) return;
		isGenerating = true;

		// Use toBlob instead of toDataURL to prevent crashing on massive native-resolution files
		canvas.toBlob((blob) => {
			if (!blob) {
				alert("Failed to process image.");
				isGenerating = false;
				return;
			}

			// Create a temporary link to trigger the manual download
			const link = document.createElement('a');
			link.download = `JointPics-WebP-${Date.now()}.webp`;
			link.href = URL.createObjectURL(blob);
			link.click();

			// Cleanup to free up memory
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
