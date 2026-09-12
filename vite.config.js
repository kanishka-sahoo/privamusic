import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// The dashboard runs behind a strict CSP (no inline scripts or styles), so the build keeps
// every script and stylesheet as an external, hashed asset under /assets.
export default defineConfig({
  root:'web',
  publicDir:'public',
  plugins:[react()],
  build:{
    outDir:'../dist',
    emptyOutDir:true,
    target:'es2022',
    modulePreload:{polyfill:false},
    rollupOptions:{
      input:{index:'web/index.html',native:'web/native.html'},
      // Both pages share React and the stylesheet; give that chunk a stable name.
      output:{advancedChunks:{groups:[{name:'shared',test:/node_modules[\\/](react|react-dom|scheduler)[\\/]|web[\\/]src[\\/](components|styles)[\\/]/}]}}
    }
  },
  server:{
    port:5173,
    // Point local development at a running dashboard container.
    proxy:{'/api':'http://127.0.0.1:18780','/healthz':'http://127.0.0.1:18780','/native':{target:'http://127.0.0.1:18780',ws:true}}
  }
});
