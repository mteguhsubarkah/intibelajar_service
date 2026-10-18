"""Apply small additive Slice 0 integration; refuse unexpected source changes."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[2]/'mockup'/'intibelajar'
service=Path(__file__).resolve().parents[1]
changes={}
def replace(file,old,new):
    p=root/file
    text=changes.get(p,p.read_text(encoding='utf8'))
    if old not in text: raise RuntimeError('Expected source missing: '+str(p))
    changes[p]=text.replace(old,new,1)
replace('src/router/index.ts',"    { path: '/kenalan', name: 'onboarding', component: OnboardingView },", "    { path: '/auth/email', component: () => import('@/views/Slice0AccountView.vue') },\n    { path: '/auth/callback', component: () => import('@/views/Slice0AccountView.vue') },\n    { path: '/account/consent', component: () => import('@/views/Slice0AccountView.vue') },\n    { path: '/guardian-consents/:token', component: () => import('@/views/Slice0AccountView.vue') },\n    { path: '/kenalan', name: 'onboarding', component: OnboardingView },")
replace('src/views/OnboardingView.vue','  <FlowShell back-label=', '  <Slice0AccountView v-if="accountOnboarding" />\n  <FlowShell v-else back-label=')
replace('src/views/OnboardingView.vue',"import { computed, ref } from 'vue';", "import { computed, ref, onMounted } from 'vue';\nimport Slice0AccountView from './Slice0AccountView.vue';\nimport { readSession, slice0Enabled } from '@/services/canonicalApi';\nconst accountOnboarding = ref(false);\nonMounted(async () => { if (slice0Enabled) { try { accountOnboarding.value = (await readSession()).authenticated; } catch { /* Keep device demo available. */ } } });")
replace('src/components/coba/AccountOffer.vue','Tanpa daftar, progres hilang saat tab ditutup.','Progres ini tersimpan di perangkat ini saja.')
replace('src/components/coba/AccountOffer.vue','Dengan mendaftar kamu setuju dengan <b>Ketentuan</b> &amp; <b>Privasi</b>. Di bawah 13 tahun? Daftar bersama orang tua.','Akun belajar memerlukan persetujuan orang tua atau wali. Integrasi akun saat ini hanya untuk simulasi development.')
replace('src/components/coba/AccountOffer.vue',"import { startAuthWithBackend } from '@/services/learningBackend';", "import { startAuthWithBackend } from '@/services/learningBackend';\nimport { slice0Enabled, startSyntheticSignin } from '@/services/canonicalApi';")
replace('src/components/coba/AccountOffer.vue',"    const result = await startAuthWithBackend", "    if (slice0Enabled) {\n      const result = await startSyntheticSignin(provider, window.location.pathname, state.step);\n      window.location.assign(result.redirectUrl);\n      return;\n    }\n    const result = await startAuthWithBackend")
replace('vite.config.ts','  plugins: [vue()],', "  plugins: [vue()],\n  server: { proxy: { '/v1': { target: 'http://127.0.0.1:8000', changeOrigin: false } } },")
replace('src/services/track.ts', '  const url = (import.meta as { env?: Record<string, string> }).env?.VITE_TRACK_URL;', '  const env = (import.meta as { env?: Record<string, string> }).env;\n  const localOnly = env?.VITE_SLICE0 === "true" || env?.VITE_LEARNING_MODE === "demo";\n  const url = localOnly ? undefined : env?.VITE_TRACK_URL;')
changes[root/'src/services/canonicalApi.ts']=(service/'frontend-integration/canonicalApi.ts').read_text(encoding='utf8')
changes[root/'src/views/Slice0AccountView.vue']=(service/'frontend-integration/Slice0AccountView.vue').read_text(encoding='utf8')
# Backup before writing only the known files; no deletion or git reset.
for p,text in changes.items():
    if p.exists():
        backup=service/'.local/frontend-before-slice0'/p.relative_to(root)
        backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,backup)
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf8',newline='\n')
print('Applied additive Slice 0 integration to',root)
