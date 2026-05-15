import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		svelte(),
		VitePWA({
			registerType: 'autoUpdate', // Automatically updates the offline cache when you push new code
			workbox: {
				// Tells the Service Worker to cache all of these file types for offline use
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
			},
			manifest: {
				name: 'Double Vision',
				short_name: 'DoubleVision',
				description: 'Stitch photos into 3D side-by-side images offline.',
				theme_color: '#ffffff',
				background_color: '#ffffff',
				display: 'standalone', // This is what forces it to open full-screen like a native app
				icons: [
					{
						src: 'icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			}
		})
	]
});
