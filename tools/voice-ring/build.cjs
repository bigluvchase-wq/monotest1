const path=require('node:path');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'index.jsx')],bundle:true,minify:true,format:'iife',target:'safari16.4',define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(__dirname,'../../Mono/Web/vendor/voice-ring.js'),legalComments:'eof'});
