import {readFileSync,writeFileSync} from 'node:fs';
const f='../mockup/intibelajar/src/views/Slice0AccountView.vue';
let s=readFileSync(f,'utf8');
s=s.replace('Google dan email eksternal belum dikonfigurasi. Gunakan alamat sintetis berakhiran .invalid dan mailbox development lokal.', 'Google tersedia setelah OAuth development dikonfigurasi untuk akun uji dewasa. Email masih memakai alamat sintetis .invalid dan mailbox development lokal.');
s=s.replace('Belum ada pembelajaran yang disimpan di server pada Slice 0.', 'Sesi belajar akun yang sudah eligible dapat tersimpan di server lokal. Masuk Google tidak otomatis memberikan persetujuan belajar atau AI.');
if(!s.includes('@click="startGoogle"')){
 s=s.replace('<h1>Masuk development</h1>', '<h1>Masuk development</h1>\n        <button type="button" @click="startGoogle" :disabled="busy">Lanjutkan dengan Google · akun uji</button>');
 s=s.replace('<button v-else type="button" @click="start" :disabled="busy">Masuk dengan email sintetis</button>', '<template v-else>\n          <button type="button" @click="startGoogle" :disabled="busy">Lanjutkan dengan Google · akun uji</button>\n          <button type="button" @click="start" :disabled="busy">Masuk dengan email sintetis</button>\n        </template>');
 s=s.replace("const start=()=>run(","const startGoogle=()=>run(async()=>{const result=await startSyntheticSignin('google','/kenalan');window.location.assign(result.redirectUrl);});\nconst start=()=>run(");
}
writeFileSync(f,s);
