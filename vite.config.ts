import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
export default defineConfig({
 plugins:[react()],
 resolve:{alias:{'@':resolve(root,'src')}},
 build:{
  rollupOptions:{
   output:{
    manualChunks(id){
     if(!id.includes('node_modules'))return;
     if(id.includes('react-router')||id.includes('/react/')||id.includes('react-dom'))return 'react-vendor';
     if(id.includes('@supabase'))return 'supabase';
     if(id.includes('@radix-ui'))return 'radix-ui';
     if(id.includes('@tanstack'))return 'query';
     if(id.includes('lucide-react'))return 'icons';
     if(id.includes('zod')||id.includes('react-hook-form')||id.includes('@hookform'))return 'forms';
    }
   }
  },
  chunkSizeWarningLimit:500
 }
});
