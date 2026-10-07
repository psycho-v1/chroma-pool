/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14110e', paper: '#f3eadf', clay: '#221c17', cinnabar: '#e25b2a',
        vermilion: '#e34b2d', marigold: '#e8a62a', sap: '#68752c', cerulean: '#438cae',
        indigo: '#514a88', orchid: '#a15a93', ivory: '#eee7d5', lampblack: '#171717'
      },
      fontFamily: { display: ['Fraunces', 'serif'], body: ['Outfit', 'sans-serif'] }
    }
  },
  plugins: []
}
