<template>
  <main class="account-page">
    <RouterLink to="/">IntiBelajar</RouterLink>
    <p class="notice">Development dengan data sintetis saja. Identitas dan persetujuan simulasi ini tidak berlaku untuk produksi.</p>
    <p>Progres ini tersimpan di perangkat ini saja.</p>
    <p v-if="!enabled">Integrasi akun belum diaktifkan. Demo tetap dapat digunakan tanpa akun.</p>
    <p v-if="busy" role="status">Sebentar…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <template v-if="enabled">
      <section v-if="guardian">
        <h1>Persetujuan guardian sintetis</h1>
        <template v-if="view">
          <p v-if="view.learner.grade">Kelas {{ view.learner.grade }}</p>
          <p class="policy">{{ view.policyText }}</p>
          <fieldset v-for="purpose in view.purposes" :key="purpose.purpose" :disabled="busy || completed">
            <legend>{{ purpose.title }}</legend><p>{{ purpose.description }}</p>
            <label><input type="radio" :name="purpose.purpose" :value="true" v-model="choices[purpose.purpose]"> Setuju untuk simulasi</label>
            <label><input type="radio" :name="purpose.purpose" :value="false" v-model="choices[purpose.purpose]"> Tolak</label>
          </fieldset>
          <label><input type="checkbox" v-model="attestation" :disabled="completed"> Saya adalah guardian sintetis learner ini.</label>
          <button type="button" @click="decide" :disabled="busy || completed || !canDecide">Kirim keputusan</button>
        </template>
      </section>
      <section v-else-if="authPage">
        <h1>Masuk development</h1>
        <p>Google dan email eksternal belum dikonfigurasi. Gunakan alamat sintetis berakhiran .invalid dan mailbox development lokal.</p>
        <form v-if="!verificationToken" @submit.prevent="sendLink">
          <label>Email sintetis <input type="email" v-model="email" required placeholder="learner@example.invalid" autocomplete="off"></label>
          <button :disabled="busy || !transaction">Minta tautan sintetis</button>
        </form>
        <button v-else type="button" @click="verify" :disabled="busy">Gunakan tautan dan masuk</button>
        <button type="button" @click="start" :disabled="busy">Mulai sesi masuk baru</button>
      </section>
      <section v-else>
        <h1>{{ session?.learner?.status === 'ACTIVE' ? 'Akun development' : 'Menunggu persetujuan orang tua' }}</h1>
        <p>Belum ada pembelajaran yang disimpan di server pada Slice 0.</p>
        <form v-if="session?.authenticated" @submit.prevent="onboard">
          <label>Kelas <select v-model.number="grade"><option v-for="value in [7,8,9,10,11,12]" :value="value" :key="value">{{ value }}</option></select></label>
          <label>Tahun lahir sintetis <input type="number" v-model.number="birthYear" min="1990" :max="year" required></label>
          <button :disabled="busy">Simpan onboarding minimum</button>
        </form>
        <form v-if="session?.authenticated" @submit.prevent="requestConsent">
          <label>Email guardian sintetis <input type="email" v-model="guardianEmail" required placeholder="guardian@example.invalid" autocomplete="off"></label>
          <p>Tujuan yang diminta: penyimpanan data belajar. AI, unggahan dan analitik tetap mati.</p>
          <button :disabled="busy">Minta persetujuan guardian</button>
        </form>
        <button v-if="session?.authenticated" type="button" @click="logout" :disabled="busy">Keluar</button>
        <button v-else type="button" @click="start" :disabled="busy">Masuk dengan email sintetis</button>
      </section>
    </template>
    <RouterLink to="/home">Lanjut demo lokal</RouterLink>
  </main>
</template>
<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {canonicalApi,operationKey,readSession,slice0Enabled,startSyntheticSignin,type AuthState,type ConsentView} from '@/services/canonicalApi';
const route=useRoute();
const router=useRouter();
const enabled=slice0Enabled;
const guardian=computed(()=>route.path.startsWith('/guardian-consents/'));
const authPage=computed(()=>route.path.startsWith('/auth/'));
const verificationToken=ref(typeof route.query.token==='string'?route.query.token:'');
const transaction=ref(typeof route.query.transaction==='string'?route.query.transaction:'');
const email=ref('');
const guardianEmail=ref('');
const grade=ref(8);
const birthYear=ref(2012);
const year=new Date().getFullYear();
const session=ref<AuthState>();
const view=ref<ConsentView>();
const choices=ref<Record<string,boolean|undefined>>({});
const attestation=ref(false);
const busy=ref(false);
const error=ref('');
const notice=ref('');
const completed=ref(false);
const canDecide=computed(()=>attestation.value&&view.value?.purposes.every(p=>typeof choices.value[p.purpose]==='boolean'));
// A failed/retried command keeps its key. A deliberate new payload receives a new key.
const keys=new Map<string,{payload:string;key:string}>();
function keyFor(action:string,payload:unknown){const text=JSON.stringify(payload),prior=keys.get(action);if(prior?.payload===text)return prior.key;const key=operationKey();keys.set(action,{payload:text,key});return key;}
async function run(action:()=>Promise<void>){if(busy.value)return;busy.value=true;error.value='';try{await action();}catch(e){error.value=e instanceof Error?e.message:'Layanan belum tersedia.';}finally{busy.value=false;}}
const start=()=>run(async()=>{const result=await startSyntheticSignin('email','/kenalan');window.location.assign(result.redirectUrl);});
const sendLink=()=>run(async()=>{await canonicalApi('/v1/auth/email/links',{method:'POST',public:true,body:{email:email.value,transaction:transaction.value}});notice.value='Periksa mailbox development lokal. Tidak ada email eksternal yang dikirim.';});
const verify=()=>run(async()=>{const result=await canonicalApi<{continuation:{route:string}}>('/v1/auth/email/verify',{method:'POST',public:true,body:{token:verificationToken.value}});verificationToken.value='';await router.replace(result.continuation.route);});
const onboard=()=>run(async()=>{await canonicalApi('/v1/me/profile',{method:'PATCH',body:{grade:grade.value,birthYear:birthYear.value}});notice.value='Onboarding minimum tersimpan; tahun lahir tidak disimpan.';session.value=await readSession();});
const requestConsent=()=>run(async()=>{const body={guardianEmail:guardianEmail.value,purposes:['LEARNING_DATA']};await canonicalApi('/v1/me/consent-requests',{method:'POST',body,key:keyFor('request',body)});notice.value='Menunggu persetujuan orang tua. Tautan simulasi tersedia di mailbox development lokal.';keys.delete('request');});
const decide=()=>run(async()=>{if(!view.value||!canDecide.value)return;const body={decisions:view.value.purposes.map(p=>({purpose:p.purpose,granted:choices.value[p.purpose]})),policyVersion:view.value.policyVersion,policyTextSha256:view.value.policyTextSha256,attestation:true};await canonicalApi('/v1/guardian-consents/'+encodeURIComponent(String(route.params.token))+'/decision',{method:'POST',public:true,body,key:keyFor('decision',body)});completed.value=true;notice.value='Keputusan simulasi tercatat. Learner perlu masuk kembali; data belajar tetap lokal.';});
const logout=()=>run(async()=>{await canonicalApi('/v1/auth/logout',{method:'POST'});session.value={authenticated:false};notice.value='Sudah keluar.';});
let meta:HTMLMetaElement|undefined;
onMounted(()=>{meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.append(meta);if(!enabled)return;void run(async()=>{if(guardian.value)view.value=await canonicalApi<ConsentView>('/v1/guardian-consents/'+encodeURIComponent(String(route.params.token)),{public:true});else if(!authPage.value)session.value=await readSession();});});
onUnmounted(()=>meta?.remove());
</script>
<style scoped>
.account-page{max-width:640px;margin:32px auto;padding:24px;font-family:inherit;line-height:1.6}.notice{padding:16px;border:1px solid #d4aa32;background:#fff8dd;border-radius:12px}.policy{white-space:pre-wrap}form,fieldset{display:grid;gap:12px;margin:24px 0}label{display:block}input,select,button{font:inherit;padding:10px;max-width:100%;box-sizing:border-box}button{margin:12px 8px 12px 0;cursor:pointer}button:disabled{opacity:.5;cursor:default}[role=alert]{color:#a32929}
</style>
