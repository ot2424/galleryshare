// tailwind.config.js
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                gold: '#d1b584',
                beige: '#f5f5ef'
            },
            fontFamily: {
                serif: ['Merriweather', 'serif'],
                sans: ['Open Sans', 'sans-serif']
            },
	    plugins: [
		require('@tailwindcss/aspect-ratio')
	    ],
        },
    }
}
